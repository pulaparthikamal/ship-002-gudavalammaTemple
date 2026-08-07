import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { infrastructureMonitorService } from '../services/monitoring/infrastructureMonitor.service';
import { metricCollectorService } from '../services/monitoring/metricCollector.service';
import { monitoringReadService } from '../services/monitoring/monitoringRead.service';
import { metricSeriesService } from '../services/monitoring/metricSeries.service';
import { envConfig } from '../../../config/env.config';
import { withDashboardEndpointLog } from '../utils/dashboardEndpointLog.util';

export const metricsController = {
  async list(req: Request, res: Response) {
    if (req.params.serverId && req.query.range) {
      const result = await withDashboardEndpointLog(
        'serverAgent/metrics/history',
        'mongo',
        () => monitoringReadService.getMetricsInRange(
          String(req.params.serverId),
          String(req.query.range),
          req.query.startTime ? String(req.query.startTime) : undefined,
          req.query.endTime ? String(req.query.endTime) : undefined,
        ),
      );

      return res.json({
        success: true,
        data: result.points,
        meta: {
          featureEnabled: envConfig.lightweightMonitoringEnabled,
          collection: 'metrics_history',
          range: result.range,
          startTime: result.startTime,
          endTime: result.endTime,
          bucketMs: result.bucketMs,
          summary: result.summary,
        },
      });
    }

    const metrics = await withDashboardEndpointLog(
      'dashboard',
      'mongo',
      () => monitoringService.getMetrics(
        req.query.serverId ? String(req.query.serverId) : undefined,
        req.query.limit ? Number(req.query.limit) : 60,
      ),
    );
    return res.json({
      success: true,
      data: metrics,
    });
  },

  async collect(req: Request, res: Response) {
    if (envConfig.lightweightMonitoringEnabled) {
      return res.status(202).json({
        success: true,
        data: null,
        message: 'Legacy manual metrics collection is disabled while lightweight monitoring is enabled. Dashboard reads cached monitoring data.',
      });
    }

    const metric = await monitoringService.collectMetrics(String(req.body.serverId), 'manual');
    return res.status(202).json({
      success: true,
      data: metric,
      message: 'Metrics collected.',
    });
  },

  async metricDefinitions(_req: Request, res: Response) {
    return res.json({
      success: true,
      data: metricSeriesService.definitions(),
      meta: {
        collection: 'metric_series',
      },
    });
  },

  async querySeries(req: Request, res: Response) {
    const result = await withDashboardEndpointLog(
      'serverAgent/metrics/query',
      'mongo',
      () => metricSeriesService.query({
        serverId: String(req.query.serverId),
        namespace: req.query.namespace ? String(req.query.namespace) as any : undefined,
        metricName: String(req.query.metricName),
        aggregation: req.query.aggregation ? String(req.query.aggregation) as any : undefined,
        timeRange: req.query.timeRange ? String(req.query.timeRange) as any : undefined,
        startTime: req.query.startTime ? String(req.query.startTime) : undefined,
        endTime: req.query.endTime ? String(req.query.endTime) : undefined,
        granularity: req.query.granularity ? String(req.query.granularity) as any : undefined,
        dimensions: req.query.dimensions ? String(req.query.dimensions) : undefined,
      }),
    );

    return res.json({
      success: true,
      data: result,
      meta: {
        collection: 'metric_series',
      },
    });
  },

  async monitoringStatus(req: Request, res: Response) {
    const status = await withDashboardEndpointLog(
      'dashboard/monitoring/status',
      'mongo/cache',
      () => infrastructureMonitorService.getStatus(
        req.query.serverId ? String(req.query.serverId) : undefined,
      ),
    );
    return res.json({
      success: true,
      data: status,
    });
  },

  async monitoringHistory(req: Request, res: Response) {
    const metrics = await withDashboardEndpointLog(
      'dashboard/monitoring/history',
      'mongo',
      () => monitoringReadService.getMetricHistory(
        req.query.serverId ? String(req.query.serverId) : undefined,
        req.query.limit ? String(req.query.limit) : undefined,
      ),
    );
    return res.json({
      success: true,
      data: metrics,
      meta: {
        featureEnabled: envConfig.lightweightMonitoringEnabled,
        collection: 'metrics_history',
      },
    });
  },

  async cpuTrend(req: Request, res: Response) {
    const serverId = req.query.serverId ? String(req.query.serverId) : undefined;
    const metrics = await withDashboardEndpointLog(
      'dashboard/monitoring/cpu-trend',
      'mongo',
      () => monitoringReadService.getMetricHistory(
        serverId,
        req.query.limit ? String(req.query.limit) : undefined,
      ),
    );
    return res.json({
      success: true,
      data: metrics,
      meta: {
        featureEnabled: envConfig.lightweightMonitoringEnabled,
        collection: 'metrics_history',
        cpuOnly: true,
        dbOnly: true,
      },
    });
  },

  async cpuMetrics(req: Request, res: Response) {
    const serverId = String(req.params.serverId);
    const range = req.query.range ? String(req.query.range) : '24h';
    const result = await withDashboardEndpointLog(
      'serverAgent/metrics/cpu',
      'mongo',
      () => monitoringReadService.getCpuMetrics(
        serverId,
        range,
        req.query.startTime ? String(req.query.startTime) : undefined,
        req.query.endTime ? String(req.query.endTime) : undefined,
      ),
    );

    return res.json({
      success: true,
      data: result.points,
      meta: {
        featureEnabled: envConfig.lightweightMonitoringEnabled,
        collection: 'metrics_history',
        range: result.range,
        startTime: result.startTime,
        endTime: result.endTime,
        aggregation: '1m',
        summary: result.summary,
      },
    });
  },

  async latestHealthScore(req: Request, res: Response) {
    const score = await withDashboardEndpointLog(
      'dashboard/monitoring/health/latest',
      'mongo',
      () => req.query.serverId
        ? monitoringReadService.getLatestHealthScore(String(req.query.serverId))
        : Promise.resolve(null),
    );
    return res.json({
      success: true,
      data: score,
      meta: {
        featureEnabled: envConfig.lightweightMonitoringEnabled,
        collection: 'health_scores',
      },
    });
  },

  async healthScores(req: Request, res: Response) {
    const scores = await withDashboardEndpointLog(
      'dashboard/monitoring/health',
      'mongo',
      () => monitoringReadService.getHealthScores(
        req.query.serverId ? String(req.query.serverId) : undefined,
        req.query.limit ? String(req.query.limit) : undefined,
      ),
    );
    return res.json({
      success: true,
      data: scores,
      meta: {
        featureEnabled: envConfig.lightweightMonitoringEnabled,
        collection: 'health_scores',
      },
    });
  },

  async resourceSpikes(req: Request, res: Response) {
    const spikes = await withDashboardEndpointLog(
      'dashboard/monitoring/spikes',
      'mongo',
      () => monitoringReadService.getResourceSpikes(
        req.query.serverId ? String(req.query.serverId) : undefined,
        req.query.limit ? String(req.query.limit) : undefined,
      ),
    );
    return res.json({
      success: true,
      data: spikes,
      meta: {
        featureEnabled: envConfig.lightweightMonitoringEnabled,
        collection: 'resource_spikes',
      },
    });
  },

  async collectLightweight(req: Request, res: Response) {
    const result = await metricCollectorService.collect(
      String(req.body.serverId),
      envConfig.lightweightMonitoringBaseIntervalMs,
      { trigger: 'manual' },
    );
    return res.status(202).json({
      success: true,
      data: result,
      message: 'Manual lightweight monitoring sample collected.',
    });
  },
};
