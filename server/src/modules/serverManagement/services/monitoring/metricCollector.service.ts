import { Types } from 'mongoose';
import { ServerConnection } from '../../models/serverConnection.model';
import { HealthScore } from '../../models/healthScore.model';
import { IMetricsHistory, MetricsHistory } from '../../models/metricsHistory.model';
import { ResourceSpike } from '../../models/resourceSpike.model';
import { ServerMaintenanceConfig } from '../../models/config.model';
import { socketService } from '../socket.service';
import { envConfig } from '../../../../config/env.config';
import { logger } from '../../../../utils/logger.util';
import { osMetricCollectorService, RawOsMetricSnapshot } from './osMetricCollector.service';
import { healthScoreService } from './healthScore.service';
import { metricSpikeDetectorService } from './metricSpikeDetector.service';
import { processMonitorService } from './processMonitor.service';
import { monitoringCacheService } from './monitoringCache.service';
import { selfHealingService } from '../selfHealing.service';
import { metricSeriesService } from './metricSeries.service';
import { diskCleanupAgentService } from '../diskCleanup/diskCleanupAgent.service';
import { monitoringEventService } from './monitoringEvent.service';

export const MONITOR_UPDATE = 'MONITOR_UPDATE';
export const HEALTH_SCORE_UPDATE = 'HEALTH_SCORE_UPDATE';
export const METRIC_SPIKE_DETECTED = 'METRIC_SPIKE_DETECTED';

const sectorSizeBytes = 512;

const safeRate = (current: number, previous: number, elapsedSeconds: number) => {
  if (!Number.isFinite(current) || !Number.isFinite(previous) || elapsedSeconds <= 0) {
    return 0;
  }

  return Math.max(0, (current - previous) / elapsedSeconds);
};

const calculateCpuUsage = (
  current: RawOsMetricSnapshot['rawCounters'],
  previous?: Pick<IMetricsHistory, 'rawCounters'> | null,
) => {
  if (!previous) {
    return 0;
  }

  const totalDelta = current.cpuTotal - previous.rawCounters.cpuTotal;
  const idleDelta = current.cpuIdle - previous.rawCounters.cpuIdle;
  if (totalDelta <= 0) {
    return 0;
  }

  return Number(Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100)).toFixed(2));
};

const calculateFilesystemGrowth = (
  current: RawOsMetricSnapshot,
  previous: Pick<IMetricsHistory, 'filesystems' | 'collectedAt'> | null,
  elapsedSeconds: number,
) => {
  if (!previous || elapsedSeconds <= 0) {
    return 0;
  }

  const previousByMount = new Map(previous.filesystems.map((fs) => [fs.mount, fs.usedBytes]));
  const growthBytes = current.filesystems.reduce((sum, fs) => {
    const previousUsed = previousByMount.get(fs.mount);
    if (previousUsed === undefined) {
      return sum;
    }

    return sum + Math.max(0, fs.usedBytes - previousUsed);
  }, 0);

  return Number(((growthBytes / elapsedSeconds) * 60).toFixed(2));
};

const getPreviousMetric = (serverId: string) =>
  MetricsHistory.findOne({ server: new Types.ObjectId(serverId) })
    .sort({ collectedAt: -1 })
    .lean<Pick<
      IMetricsHistory,
      | 'os'
      | 'rawCounters'
      | 'filesystems'
      | 'serviceSummary'
      | 'processSummary'
      | 'sshSessionActivity'
      | 'collectedAt'
      | 'cpuUsagePercent'
      | 'memoryUsagePercent'
    > | null>();

const getRecentHistory = (serverId: string, limit = 10) =>
  MetricsHistory.find({ server: new Types.ObjectId(serverId) })
    .sort({ collectedAt: -1 })
    .limit(limit)
    .lean();

const inFlightByServer = new Map<string, Promise<unknown>>();
const lastManualCollectAtByServer = new Map<string, number>();
const cpuTrendInFlightByServer = new Map<string, Promise<IMetricsHistory[]>>();
const lastCpuTrendCollectAtByServer = new Map<string, number>();
const cpuTrendMinIntervalMs = 950;
const cpuTrendPollIntervalMs = 1000;
const cpuTrendMaxCollectorIntervalMs = Number.MAX_SAFE_INTEGER;

export const metricCollectorService = {
  async collect(
    serverId: string,
    pollIntervalMs: number,
    options: { trigger?: 'background' | 'manual'; force?: boolean } = {},
  ) {
    const existing = inFlightByServer.get(serverId);
    if (existing) {
      const latestMetric = monitoringCacheService.getLatestMetric(serverId);
      if (options.trigger !== 'manual' && latestMetric) {
        logger.info(`[LightweightMonitoring] collection skipped server=${serverId} reason=previous_run_active`);
        return {
          metric: latestMetric,
          healthScore: await HealthScore.findOne({ server: new Types.ObjectId(serverId) }).sort({ calculatedAt: -1 }),
          spikes: [],
          cached: true,
        };
      }

      const error = new Error('Lightweight collection skipped because a previous run is still active.');
      (error as Error & { statusCode?: number }).statusCode = 429;
      throw error;
    }

    if (options.trigger === 'manual') {
      const now = Date.now();
      const lastManualCollectAt = lastManualCollectAtByServer.get(serverId) || 0;
      const waitMs = envConfig.lightweightMonitoringManualMinIntervalMs - (now - lastManualCollectAt);
      if (waitMs > 0 && !options.force) {
        const error = new Error(`Manual lightweight collection is rate-limited. Try again in ${Math.ceil(waitMs / 1000)} seconds.`);
        (error as Error & { statusCode?: number }).statusCode = 429;
        throw error;
      }
      lastManualCollectAtByServer.set(serverId, now);
    }

    const collection = this.collectUnlocked(serverId, pollIntervalMs, options.trigger || 'background');
    inFlightByServer.set(serverId, collection);
    try {
      return await collection;
    } finally {
      inFlightByServer.delete(serverId);
    }
  },

  async collectUnlocked(serverId: string, pollIntervalMs: number, trigger: 'background' | 'manual') {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new Error('Server not found for lightweight monitoring.');
    }

    const [previousMetric, recentHistory] = await Promise.all([
      getPreviousMetric(serverId),
      getRecentHistory(serverId),
    ]);

    const isHighLoad = previousMetric && (
      (previousMetric.cpuUsagePercent !== undefined && previousMetric.cpuUsagePercent >= 70) ||
      (previousMetric.memoryUsagePercent !== undefined && previousMetric.memoryUsagePercent >= 85)
    );

    const now = new Date();
    if (
      trigger === 'background' &&
      previousMetric?.collectedAt &&
      now.getTime() - previousMetric.collectedAt.getTime() < Math.max(1000, pollIntervalMs * 0.8)
    ) {
      const latestMetric = monitoringCacheService.getLatestMetric(serverId) || previousMetric;
      logger.info(
        `[LightweightMonitoring] collection skipped server=${serverId} reason=recent_sample ageMs=${now.getTime() - previousMetric.collectedAt.getTime()}`,
      );
      return {
        metric: latestMetric,
        healthScore: await HealthScore.findOne({ server: new Types.ObjectId(serverId) }).sort({ calculatedAt: -1 }),
        spikes: [],
        cached: true,
      };
    }

    const rawSnapshot = await osMetricCollectorService.collect(server, {
      previousMetric,
      diskIntervalMs: trigger === 'manual' ? 0 : envConfig.lightweightMonitoringDiskIntervalMs,
      processIntervalMs: (trigger === 'manual' || isHighLoad) ? 0 : envConfig.lightweightMonitoringProcessIntervalMs,
      serviceIntervalMs: trigger === 'manual' ? 0 : envConfig.lightweightMonitoringServiceIntervalMs,
      sshIntervalMs: trigger === 'manual' ? 0 : envConfig.lightweightMonitoringSshIntervalMs,
      networkScanIntervalMs: trigger === 'manual' ? 0 : envConfig.lightweightMonitoringNetworkScanIntervalMs,
      commandTimeoutMs: envConfig.lightweightMonitoringCommandTimeoutMs,
      coreOnly: envConfig.lightweightMonitoringCoreOnly,
      enableProcessScan: envConfig.lightweightMonitoringEnableProcessScan,
      enableServiceScan: envConfig.lightweightMonitoringEnableServiceScan,
      enableAuthScan: envConfig.lightweightMonitoringEnableAuthScan,
      enableNetworkScan: envConfig.lightweightMonitoringEnableNetworkScan,
    });

    // Load config and dynamically register / inject expected monitored services
    try {
      const config = await ServerMaintenanceConfig.findOne({ server: server._id });
      if (config) {
        const runningServices = rawSnapshot.serviceSummary?.runningServices || [];
        const currentMonitored = new Set(config.monitoredServices || []);
        let configUpdated = false;

        for (const service of runningServices) {
          // Filter out transient systemd scopes, slices, and noise
          if (
            service &&
            !service.startsWith('session-') &&
            !service.endsWith('.scope') &&
            !service.endsWith('.slice') &&
            !service.endsWith('.mount') &&
            !currentMonitored.has(service)
          ) {
            config.monitoredServices.push(service);
            currentMonitored.add(service);
            configUpdated = true;
          }
        }

        if (configUpdated) {
          config.updated = new Date();
          await config.save();
          logger.info(
            `[SelfHealing] Automatically registered running services to monitored list on server ${serverId}: ${JSON.stringify(
              config.monitoredServices,
            )}`,
          );
        }

        // Inject missing services into failedServices / serviceIssues
        if (rawSnapshot.serviceSummary) {
          rawSnapshot.serviceSummary.serviceIssues = rawSnapshot.serviceSummary.serviceIssues || [];
          rawSnapshot.serviceSummary.failedServices = rawSnapshot.serviceSummary.failedServices || [];
          const runningSet = new Set(runningServices);
          const existingIssues = new Set(
            rawSnapshot.serviceSummary.serviceIssues.map((issue: any) => issue.service),
          );

          for (const service of config.monitoredServices) {
            if (!runningSet.has(service) && !existingIssues.has(service)) {
              const manager = service.startsWith('docker:')
                ? 'docker'
                : service.startsWith('pm2:')
                ? 'pm2'
                : 'systemd';
              
              rawSnapshot.serviceSummary.failedServices.push(service);
              rawSnapshot.serviceSummary.serviceIssues ??= [];
              rawSnapshot.serviceSummary.serviceIssues.push({
                service,
                manager,
                status: 'failed',
                reason: 'service is stopped or offline (expected to be running)',
              });
              rawSnapshot.serviceSummary.failed = (rawSnapshot.serviceSummary.failed || 0) + 1;
              logger.warn(
                `[SelfHealing] Service "${service}" is expected to be running but is offline. Injected failed status for self-healing recovery.`,
              );
            }
          }
        }
      }
    } catch (err) {
      logger.error(`[SelfHealing] Failed to process monitored services registration/injection:`, err);
    }
    const collectedAt = new Date();
    const elapsedSeconds = previousMetric?.collectedAt
      ? Math.max(1, (collectedAt.getTime() - previousMetric.collectedAt.getTime()) / 1000)
      : Math.max(1, pollIntervalMs / 1000);
    const cpuUsagePercent = calculateCpuUsage(rawSnapshot.rawCounters, previousMetric);
    const processAssessment = processMonitorService.assess(rawSnapshot.processSummary);

    const metric = await MetricsHistory.create({
      server: server._id,
      os: rawSnapshot.os,
      cpuUsagePercent,
      cpuCoreCount: rawSnapshot.cpuCoreCount,
      loadAverage: rawSnapshot.loadAverage,
      memoryUsagePercent: rawSnapshot.memoryUsagePercent,
      memoryUsedBytes: rawSnapshot.memoryUsedBytes,
      memoryFreeBytes: rawSnapshot.memoryFreeBytes,
      memoryCachedBytes: rawSnapshot.memoryCachedBytes,
      swapUsagePercent: rawSnapshot.swapUsagePercent,
      diskUsagePercent: rawSnapshot.diskUsagePercent,
      diskReadBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.diskReadSectors * sectorSizeBytes,
        (previousMetric?.rawCounters.diskReadSectors || 0) * sectorSizeBytes,
        previousMetric ? elapsedSeconds : 0,
      ),
      diskWriteBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.diskWriteSectors * sectorSizeBytes,
        (previousMetric?.rawCounters.diskWriteSectors || 0) * sectorSizeBytes,
        previousMetric ? elapsedSeconds : 0,
      ),
      filesystemGrowthBytesPerMinute: calculateFilesystemGrowth(
        rawSnapshot,
        previousMetric,
        elapsedSeconds,
      ),
      networkRxBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.networkRxBytes,
        previousMetric?.rawCounters.networkRxBytes || 0,
        previousMetric ? elapsedSeconds : 0,
      ),
      networkTxBytesPerSecond: safeRate(
        rawSnapshot.rawCounters.networkTxBytes,
        previousMetric?.rawCounters.networkTxBytes || 0,
        previousMetric ? elapsedSeconds : 0,
      ),
      networkErrors: rawSnapshot.networkErrors,
      networkDroppedPackets: rawSnapshot.networkDroppedPackets,
      serviceSummary: rawSnapshot.serviceSummary,
      processSummary: {
        ...rawSnapshot.processSummary,
        topCpu: processAssessment.topCpu,
      },
      sshSessionActivity: rawSnapshot.sshSessionActivity,
      filesystems: rawSnapshot.filesystems,
      rawCounters: rawSnapshot.rawCounters,
      collectedAt,
      pollIntervalMs,
      trigger,
      created: collectedAt,
    });
    monitoringCacheService.setLatestMetric(serverId, metric);
    void metricSeriesService.persistFromHistory(metric).catch((error) => {
      logger.warn(
        `[MetricSeries] sampled monitoring metric skipped server=${serverId} error=${error instanceof Error ? error.message : 'unknown'}`,
      );
    });
    // logger.debug(
    //   `[LightweightMonitoring] metrics_history write server=${serverId} trigger=${trigger} metric=${metric._id} cpu=${metric.cpuUsagePercent} memory=${metric.memoryUsagePercent} disk=${metric.diskUsagePercent}`,
    // );

    const health = healthScoreService.calculate(metric);
    const healthScore = await HealthScore.create({
      server: server._id,
      ...health,
      calculatedAt: collectedAt,
      created: collectedAt,
    });
    // logger.debug(
    //   `[LightweightMonitoring] health_scores write server=${serverId} healthScore=${healthScore._id} score=${healthScore.score} status=${healthScore.status}`,
    // );

    const spikes = metricSpikeDetectorService.detect(metric, recentHistory);
    const resourceSpikes = spikes.length
      ? await ResourceSpike.insertMany(
          spikes.map((spike) => ({
            server: server._id,
            metric: spike.metric,
            severity: spike.severity,
            value: spike.value,
            baseline: spike.baseline,
            threshold: spike.threshold,
            message: spike.message,
            metadata: spike.metadata || {},
            detectedAt: collectedAt,
            created: collectedAt,
          })),
          { ordered: false },
        )
      : [];
    if (resourceSpikes.length) {
      // logger.debug(
      //   `[LightweightMonitoring] resource_spikes write server=${serverId} count=${resourceSpikes.length}`,
      // );
    }
    const diskSpike = resourceSpikes.find((spike) => spike.metric === 'disk' || spike.metric === 'filesystem_growth');
    if (diskSpike) {
      void diskCleanupAgentService.maybeRunForStorageSpike(serverId, metric.diskUsagePercent).catch((error) => {
        logger.error(`[DiskCleanup] storage spike cleanup failed for server ${serverId}:`, error);
      });
    }

    await monitoringEventService.markServerConnected(serverId, collectedAt);
    await monitoringEventService.evaluateThresholdAlerts(serverId, metric);

    // Trigger intelligent self-healing evaluations asynchronously
    void selfHealingService.evaluate(serverId, metric, healthScore).catch((err) => {
      logger.error(`[SelfHealing] Background evaluation failed for server ${serverId}:`, err);
    });

    socketService.emitToServer(serverId, MONITOR_UPDATE, metric);
    // logger.debug(`[LightweightMonitoring] websocket emit ${MONITOR_UPDATE} server=${serverId}`);
    socketService.emitToServer(serverId, HEALTH_SCORE_UPDATE, healthScore);
    // logger.debug(`[LightweightMonitoring] websocket emit ${HEALTH_SCORE_UPDATE} server=${serverId}`);
    resourceSpikes.forEach((spike) => {
      socketService.emitToServer(serverId, METRIC_SPIKE_DETECTED, spike);
      // logger.debug(
      //   `[LightweightMonitoring] websocket emit ${METRIC_SPIKE_DETECTED} server=${serverId} spike=${spike._id}`,
      // );
    });

    return {
      metric,
      healthScore,
      spikes: resourceSpikes,
    };
  },

  async collectCpuTrend(serverId: string, limit = 60) {
    const existing = cpuTrendInFlightByServer.get(serverId);
    if (existing) {
      return existing;
    }

    const collection = this.collectCpuTrendUnlocked(serverId, limit);
    cpuTrendInFlightByServer.set(serverId, collection);
    try {
      return await collection;
    } finally {
      cpuTrendInFlightByServer.delete(serverId);
    }
  },

  async collectCpuTrendUnlocked(serverId: string, limit = 60) {
    const now = Date.now();
    const previousCpuTrendCollectAt = lastCpuTrendCollectAtByServer.get(serverId) || 0;
    const normalizedLimit = Math.min(Math.max(Number(limit) || 60, 1), 180);

    if (now - previousCpuTrendCollectAt >= cpuTrendMinIntervalMs) {
      lastCpuTrendCollectAtByServer.set(serverId, now);
      const server = await ServerConnection.findOne({ _id: serverId, active: true });
      if (!server) {
        throw new Error('Server not found for CPU trend monitoring.');
      }

      const previousMetric = await getPreviousMetric(serverId);
      const rawSnapshot = await osMetricCollectorService.collect(server, {
        previousMetric,
        diskIntervalMs: cpuTrendMaxCollectorIntervalMs,
        processIntervalMs: cpuTrendMaxCollectorIntervalMs,
        serviceIntervalMs: cpuTrendMaxCollectorIntervalMs,
        sshIntervalMs: cpuTrendMaxCollectorIntervalMs,
        networkScanIntervalMs: cpuTrendMaxCollectorIntervalMs,
        commandTimeoutMs: Math.min(envConfig.lightweightMonitoringCommandTimeoutMs, 10000),
        coreOnly: true,
        enableProcessScan: false,
        enableServiceScan: false,
        enableAuthScan: false,
        enableNetworkScan: false,
      });
      const collectedAt = new Date();
      const elapsedSeconds = previousMetric?.collectedAt
        ? Math.max(1, (collectedAt.getTime() - previousMetric.collectedAt.getTime()) / 1000)
        : 1;
      const cpuUsagePercent = calculateCpuUsage(rawSnapshot.rawCounters, previousMetric);

      const metric = await MetricsHistory.create({
        server: server._id,
        os: rawSnapshot.os,
        cpuUsagePercent,
        cpuCoreCount: rawSnapshot.cpuCoreCount,
        loadAverage: rawSnapshot.loadAverage,
        memoryUsagePercent: rawSnapshot.memoryUsagePercent,
        memoryUsedBytes: rawSnapshot.memoryUsedBytes,
        memoryFreeBytes: rawSnapshot.memoryFreeBytes,
        memoryCachedBytes: rawSnapshot.memoryCachedBytes,
        swapUsagePercent: rawSnapshot.swapUsagePercent,
        diskUsagePercent: rawSnapshot.diskUsagePercent,
        diskReadBytesPerSecond: safeRate(
          rawSnapshot.rawCounters.diskReadSectors * sectorSizeBytes,
          (previousMetric?.rawCounters.diskReadSectors || 0) * sectorSizeBytes,
          previousMetric ? elapsedSeconds : 0,
        ),
        diskWriteBytesPerSecond: safeRate(
          rawSnapshot.rawCounters.diskWriteSectors * sectorSizeBytes,
          (previousMetric?.rawCounters.diskWriteSectors || 0) * sectorSizeBytes,
          previousMetric ? elapsedSeconds : 0,
        ),
        filesystemGrowthBytesPerMinute: calculateFilesystemGrowth(
          rawSnapshot,
          previousMetric,
          elapsedSeconds,
        ),
        networkRxBytesPerSecond: safeRate(
          rawSnapshot.rawCounters.networkRxBytes,
          previousMetric?.rawCounters.networkRxBytes || 0,
          previousMetric ? elapsedSeconds : 0,
        ),
        networkTxBytesPerSecond: safeRate(
          rawSnapshot.rawCounters.networkTxBytes,
          previousMetric?.rawCounters.networkTxBytes || 0,
          previousMetric ? elapsedSeconds : 0,
        ),
        networkErrors: rawSnapshot.networkErrors,
        networkDroppedPackets: rawSnapshot.networkDroppedPackets,
        serviceSummary: rawSnapshot.serviceSummary,
        processSummary: rawSnapshot.processSummary,
        sshSessionActivity: rawSnapshot.sshSessionActivity,
        filesystems: rawSnapshot.filesystems,
        rawCounters: rawSnapshot.rawCounters,
        collectedAt,
        pollIntervalMs: cpuTrendPollIntervalMs,
        created: collectedAt,
      });

      monitoringCacheService.setLatestMetric(serverId, metric);
      void metricSeriesService.persistFromHistory(metric).catch((error) => {
        logger.warn(
          `[MetricSeries] sampled CPU trend metric skipped server=${serverId} error=${error instanceof Error ? error.message : 'unknown'}`,
        );
      });
      await monitoringEventService.markServerConnected(serverId, collectedAt);
      await monitoringEventService.evaluateThresholdAlerts(serverId, metric);
      logger.info(
        `[CpuTrendMonitoring] metrics_history write server=${serverId} metric=${metric._id} cpu=${metric.cpuUsagePercent}`,
      );
    }

    return MetricsHistory.find({ server: new Types.ObjectId(serverId) })
      .sort({ collectedAt: -1 })
      .limit(normalizedLimit);
  },
};
