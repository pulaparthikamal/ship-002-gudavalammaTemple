import { Types } from 'mongoose';
import { logger } from '../../../../utils/logger.util';
import { ServerConnection } from '../../models/serverConnection.model';
import { ServerMaintenanceConfig } from '../../models/config.model';
import { alertService } from '../alert.service';
import { socketService } from '../socket.service';

type MetricLike = {
  _id?: unknown;
  cpuUsagePercent?: number;
  memoryUsagePercent?: number;
  diskUsagePercent?: number;
  collectedAt?: Date;
};

const SHUTDOWN_ERROR_PATTERN =
  /connection refused|no route to host|host is down|network is unreachable|operation timed out|timed out|econnrefused|etimedout/i;

const normalizePercent = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const metricIdString = (metric: MetricLike) =>
  metric._id && typeof metric._id === 'object' && 'toString' in metric._id
    ? String(metric._id)
    : undefined;

export const monitoringEventService = {
  async markServerConnected(serverId: string, at = new Date()) {
    const server = await ServerConnection.findByIdAndUpdate(
      serverId,
      {
        status: 'connected',
        lastMetricsAt: at,
        lastConnectedAt: at,
        connectionError: undefined,
        updated: at,
      },
      { new: true },
    );

    if (server) {
      socketService.emitToServer(serverId, 'server:status', {
        serverId,
        status: server.status,
        lastConnectedAt: server.lastConnectedAt,
        lastMetricsAt: server.lastMetricsAt,
        connectionError: server.connectionError,
      });
    }

    return server;
  },

  async markServerUnreachable(serverId: string, errorMessage: string, options: { force?: boolean } = {}) {
    const server = await ServerConnection.findById(serverId);
    if (!server || !server.active || server.status === 'disabled') {
      return null;
    }

    const lastMetricsAt = server.lastMetricsAt?.getTime() || 0;
    const recentMetricWindowMs = 90 * 1000;
    if (!options.force && lastMetricsAt && Date.now() - lastMetricsAt < recentMetricWindowMs) {
      logger.warn(
        `[MonitoringStatus] Skipped unreachable transition for ${serverId}; metrics are still fresh (${Date.now() - lastMetricsAt}ms old).`,
      );
      return server;
    }

    server.status = 'unreachable';
    server.connectionError = errorMessage;
    server.updated = new Date();
    await server.save();

    socketService.emitToServer(serverId, 'server:status', {
      serverId,
      status: server.status,
      lastConnectedAt: server.lastConnectedAt,
      lastMetricsAt: server.lastMetricsAt,
      connectionError: server.connectionError,
    });

    return server;
  },

  isLikelyShutdownError(errorMessage: string) {
    return SHUTDOWN_ERROR_PATTERN.test(errorMessage);
  },

  async evaluateThresholdAlerts(serverId: string, metric: MetricLike) {
    const config = await ServerMaintenanceConfig.findOne({ server: new Types.ObjectId(serverId) }).lean();
    if (!config) {
      return [];
    }

    const checks = [
      {
        key: 'disk',
        label: 'Disk',
        value: normalizePercent(metric.diskUsagePercent),
        threshold: config.diskThresholdPercent,
        severity: 'critical' as const,
      },
      {
        key: 'cpu',
        label: 'CPU',
        value: normalizePercent(metric.cpuUsagePercent),
        threshold: config.cpuThresholdPercent,
        severity: 'warning' as const,
      },
      {
        key: 'memory',
        label: 'Memory',
        value: normalizePercent(metric.memoryUsagePercent),
        threshold: config.memoryThresholdPercent,
        severity: 'warning' as const,
      },
    ].filter((item) => Number.isFinite(item.threshold) && item.value >= item.threshold);

    const alerts = [];
    for (const breach of checks) {
      const dedupeKey = `threshold:${breach.key}`;
      alerts.push(
        await alertService.create({
          serverId,
          type: 'threshold_breach',
          severity: breach.severity,
          title: `${breach.label} threshold breached`,
          message: `${breach.label.toLowerCase()} usage is ${breach.value.toFixed(2)}% and threshold is ${breach.threshold}%.`,
          dedupeKey,
          metadata: {
            dedupeKey,
            metricId: metricIdString(metric),
            metricKey: breach.key,
            usagePercent: breach.value,
            thresholdPercent: breach.threshold,
          },
        }),
      );
    }

    return alerts;
  },
};
