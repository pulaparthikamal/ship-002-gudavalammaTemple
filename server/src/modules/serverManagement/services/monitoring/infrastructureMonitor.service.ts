import { envConfig } from '../../../../config/env.config';
import { logger } from '../../../../utils/logger.util';
import { MetricsHistory } from '../../models/metricsHistory.model';
import { ServerConnection } from '../../models/serverConnection.model';
import { metricCollectorService } from './metricCollector.service';
import { monitoringCacheService } from './monitoringCache.service';
import { osMetricCollectorService } from './osMetricCollector.service';
import { selfHealingService } from '../selfHealing.service';
import { monitoringEventService } from './monitoringEvent.service';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

let scheduler: NodeJS.Timeout | null = null;
const nextPollAtByServer = new Map<string, number>();
const intervalByServer = new Map<string, number>();
const failureCountByServer = new Map<string, number>();
const schedulerInFlightByServer = new Set<string>();
const SELF_HEALING_UNREACHABLE_FAILURES = 3;

export const infrastructureMonitorService = {
  async start() {
    logger.info(`Lightweight monitoring enabled: ${envConfig.lightweightMonitoringEnabled}`);

    if (!envConfig.lightweightMonitoringEnabled) {
      logger.info('[LightweightMonitoring] startup skipped: LIGHTWEIGHT_MONITORING_ENABLED=false');
      return;
    }

    if (scheduler) {
      return;
    }

    const serverCount = await ServerConnection.countDocuments({
      active: true,
      status: { $ne: 'disabled' },
    });

    scheduler = setInterval(() => {
      void this.runDueMonitoring();
    }, envConfig.lightweightMonitoringSchedulerTickMs);

    setTimeout(() => {
      void this.runDueMonitoring();
    }, 5000);

    logger.info(
      `[LightweightMonitoring] startup enabled base=${envConfig.lightweightMonitoringBaseIntervalMs}ms min=${envConfig.lightweightMonitoringMinIntervalMs}ms max=${envConfig.lightweightMonitoringMaxIntervalMs}ms tick=${envConfig.lightweightMonitoringSchedulerTickMs}ms concurrency=${envConfig.lightweightMonitoringMaxConcurrency}`,
    );
    logger.info(`Background monitoring started for ${serverCount} servers`);
  },

  stop() {
    if (scheduler) {
      clearInterval(scheduler);
      scheduler = null;
    }

    nextPollAtByServer.clear();
    intervalByServer.clear();
  },

  async runDueMonitoring() {
    if (!envConfig.lightweightMonitoringEnabled) {
      return;
    }

    try {
      const now = Date.now();
      const servers = await ServerConnection.find({
        active: true,
        status: { $ne: 'disabled' },
      })
        .select('_id host name status active')
        .lean();

      const dueServers = servers.filter((server) => {
        const serverId = String(server._id);
        const nextPollAt = nextPollAtByServer.get(serverId) || 0;
        if (nextPollAt > now) {
          return false;
        }

        if (schedulerInFlightByServer.has(serverId)) {
          logger.info(`[LightweightMonitoring] collection skipped server=${serverId} reason=scheduler_run_active`);
          return false;
        }

        return true;
      });

      for (let index = 0; index < dueServers.length; index += envConfig.lightweightMonitoringMaxConcurrency) {
        const batch = dueServers.slice(index, index + envConfig.lightweightMonitoringMaxConcurrency);
        await Promise.all(batch.map(async (server) => {
          const serverId = String(server._id);
          const currentInterval = intervalByServer.get(serverId) || envConfig.lightweightMonitoringBaseIntervalMs;

          try {
            schedulerInFlightByServer.add(serverId);
            logger.info(`[LightweightMonitoring] collection start server=${serverId} intervalMs=${currentInterval}`);
            await metricCollectorService.collect(serverId, currentInterval, { trigger: 'background' });
            const updatedInterval = envConfig.lightweightMonitoringBaseIntervalMs;
            intervalByServer.set(serverId, updatedInterval);
            nextPollAtByServer.set(serverId, Date.now() + updatedInterval);
            failureCountByServer.delete(serverId);
            logger.info(
              `[LightweightMonitoring] collection success server=${serverId} nextIntervalMs=${updatedInterval}`,
            );
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const failureCount = (failureCountByServer.get(serverId) || 0) + 1;
            failureCountByServer.set(serverId, failureCount);
            logger.warn(
              `Lightweight monitoring failed for ${server.name || server.host} (${failureCount}/${SELF_HEALING_UNREACHABLE_FAILURES}): ${message}`,
            );
            await ServerConnection.updateOne(
              { _id: serverId },
              {
                $set: {
                  status: 'unreachable',
                  connectionError: message,
                  updated: new Date(),
                },
              },
            );

            if (failureCount >= SELF_HEALING_UNREACHABLE_FAILURES) {
              await monitoringEventService.markServerUnreachable(serverId, message);
              void selfHealingService.handleUnreachable(serverId, message).catch((err) => {
                logger.error(`[SelfHealing] unreachable connection trigger failed for ${serverId}:`, err);
              });
            }

            const retryInterval = clamp(
              Math.round(currentInterval * 1.5),
              envConfig.lightweightMonitoringMinIntervalMs,
              envConfig.lightweightMonitoringMaxIntervalMs,
            );
            intervalByServer.set(serverId, retryInterval);
            nextPollAtByServer.set(serverId, Date.now() + retryInterval);
          } finally {
            schedulerInFlightByServer.delete(serverId);
          }
        }));
      }
    } catch (error) {
      logger.error('Error running due monitoring in scheduler:', error);
    }
  },

  async getStatus(serverId?: string) {
    const cachedLastSampleAt = monitoringCacheService.getLastSampleAt(serverId);
    const filter = serverId ? { server: serverId } : {};
    
    const [lastSample, selfHealing] = await Promise.all([
      cachedLastSampleAt
        ? Promise.resolve(null)
        : MetricsHistory.findOne(filter)
            .sort({ collectedAt: -1 })
            .select('collectedAt')
            .lean<{ collectedAt?: Date } | null>(),
      serverId ? selfHealingService.getStatus(serverId) : Promise.resolve(undefined),
    ]);

    return {
      lightweightMonitoringEnabled: envConfig.lightweightMonitoringEnabled,
      backgroundMonitorRunning: Boolean(scheduler),
      coreOnly: envConfig.lightweightMonitoringCoreOnly,
      coreMonitoringEnabled: envConfig.lightweightMonitoringEnabled,
      deepScanEnabled:
        !envConfig.lightweightMonitoringCoreOnly &&
        (
          envConfig.lightweightMonitoringEnableProcessScan ||
          envConfig.lightweightMonitoringEnableServiceScan ||
          envConfig.lightweightMonitoringEnableAuthScan ||
          envConfig.lightweightMonitoringEnableNetworkScan
        ),
      collectors: {
        processScanEnabled: !envConfig.lightweightMonitoringCoreOnly && envConfig.lightweightMonitoringEnableProcessScan,
        serviceScanEnabled: !envConfig.lightweightMonitoringCoreOnly && envConfig.lightweightMonitoringEnableServiceScan,
        authScanEnabled: !envConfig.lightweightMonitoringCoreOnly && envConfig.lightweightMonitoringEnableAuthScan,
        networkScanEnabled: !envConfig.lightweightMonitoringCoreOnly && envConfig.lightweightMonitoringEnableNetworkScan,
      },
      pollingInterval: serverId
        ? intervalByServer.get(serverId) || envConfig.lightweightMonitoringBaseIntervalMs
        : envConfig.lightweightMonitoringBaseIntervalMs,
      lastSampleAt: cachedLastSampleAt ?? lastSample?.collectedAt ?? null,
      impact: osMetricCollectorService.getImpactStats(serverId),
      selfHealing,
    };
  },
};
