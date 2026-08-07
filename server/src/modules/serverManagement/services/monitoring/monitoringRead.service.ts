import { Types } from 'mongoose';
import { HealthScore } from '../../models/healthScore.model';
import { IMetricsHistory, MetricsHistory } from '../../models/metricsHistory.model';
import { ResourceSpike } from '../../models/resourceSpike.model';

const buildServerFilter = (serverId?: string) =>
  serverId ? { server: new Types.ObjectId(serverId) } : {};

const normalizeLimit = (limit?: string | number, fallback = 60, max = 500) =>
  Math.min(Math.max(Number(limit) || fallback, 1), max);

const rangeToMs = (range?: string) => {
  if (range === '30m') return 30 * 60 * 1000;
  if (range === '1h') return 60 * 60 * 1000;
  if (range === '4h') return 4 * 60 * 60 * 1000;
  if (range === '6h') return 6 * 60 * 60 * 1000;
  if (range === '12h') return 12 * 60 * 60 * 1000;
  if (range === '48h') return 48 * 60 * 60 * 1000;
  if (range === '7d') return 7 * 24 * 60 * 60 * 1000;
  if (range === '30d') return 30 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
};

const rangeToBucketMs = (range?: string) => {
  if (range === '30m' || range === '1h') return 60 * 1000;
  if (range === '4h' || range === '6h' || range === '12h' || range === '24h') return 5 * 60 * 1000;
  if (range === '48h' || range === '7d') return 15 * 60 * 1000;
  return 60 * 60 * 1000;
};

const resolveCpuMetricWindow = (range = '24h', startTime?: string, endTime?: string) => {
  const end = range === 'custom' && endTime ? new Date(endTime) : new Date();
  const start = range === 'custom' && startTime
    ? new Date(startTime)
    : new Date(end.getTime() - rangeToMs(range));

  return { start, end };
};

const roundToMinute = (date: Date) => {
  const rounded = new Date(date);
  rounded.setSeconds(0, 0);
  return rounded.toISOString();
};

const roundToBucket = (date: Date, bucketMs: number) =>
  new Date(Math.floor(date.getTime() / bucketMs) * bucketMs).toISOString();

export const monitoringReadService = {
  getMetricHistory(serverId?: string, limit?: string | number) {
    return MetricsHistory.find(buildServerFilter(serverId))
      .sort({ collectedAt: -1 })
      .limit(normalizeLimit(limit, 60, 500));
  },

  getLatestHealthScore(serverId: string) {
    return HealthScore.findOne(buildServerFilter(serverId)).sort({ calculatedAt: -1 });
  },

  getHealthScores(serverId?: string, limit?: string | number) {
    return HealthScore.find(buildServerFilter(serverId))
      .sort({ calculatedAt: -1 })
      .limit(normalizeLimit(limit, 60, 500));
  },

  getResourceSpikes(serverId?: string, limit?: string | number) {
    return ResourceSpike.find(buildServerFilter(serverId))
      .sort({ detectedAt: -1 })
      .limit(normalizeLimit(limit, 25, 200));
  },

  async getMetricsInRange(serverId: string, range = '24h', startTime?: string, endTime?: string) {
    const { start, end } = resolveCpuMetricWindow(range, startTime, endTime);
    const bucketMs = rangeToBucketMs(range);
    const metrics = await MetricsHistory.find({
      ...buildServerFilter(serverId),
      collectedAt: { $gte: start, $lte: end },
    })
      .sort({ collectedAt: 1 })
      .select(
        [
          'cpuUsagePercent',
          'cpuDeltaPercent',
          'trend',
          'isSpike',
          'spikeSeverity',
          'probableReason',
          'cpuCoreCount',
          'loadAverage',
          'memoryUsagePercent',
          'memoryUsedBytes',
          'memoryFreeBytes',
          'swapUsagePercent',
          'diskUsagePercent',
          'diskReadBytesPerSecond',
          'diskWriteBytesPerSecond',
          'filesystemGrowthBytesPerMinute',
          'networkRxBytesPerSecond',
          'networkTxBytesPerSecond',
          'networkErrors',
          'networkDroppedPackets',
          'serviceSummary',
          'processSummary',
          'sshSessionActivity',
          'filesystems',
          'collectedAt',
          'pollIntervalMs',
        ].join(' '),
      )
      .lean<IMetricsHistory[]>();

    type Bucket = {
      timestamp: string;
      count: number;
      latest: IMetricsHistory;
      totals: Record<
        | 'cpuUsagePercent'
        | 'loadAverage'
        | 'memoryUsagePercent'
        | 'swapUsagePercent'
        | 'diskUsagePercent'
        | 'diskReadBytesPerSecond'
        | 'diskWriteBytesPerSecond'
        | 'filesystemGrowthBytesPerMinute'
        | 'networkRxBytesPerSecond'
        | 'networkTxBytesPerSecond',
        number
      >;
    };

    const buckets = new Map<string, Bucket>();
    metrics.forEach((metric) => {
      const timestamp = roundToBucket(metric.collectedAt, bucketMs);
      const bucket = buckets.get(timestamp);
      const initialTotals = {
        cpuUsagePercent: 0,
        loadAverage: 0,
        memoryUsagePercent: 0,
        swapUsagePercent: 0,
        diskUsagePercent: 0,
        diskReadBytesPerSecond: 0,
        diskWriteBytesPerSecond: 0,
        filesystemGrowthBytesPerMinute: 0,
        networkRxBytesPerSecond: 0,
        networkTxBytesPerSecond: 0,
      };
      const target = bucket || {
        timestamp,
        count: 0,
        latest: metric,
        totals: initialTotals,
      };

      target.count += 1;
      target.latest = metric;
      Object.keys(initialTotals).forEach((key) => {
        const metricKey = key as keyof typeof initialTotals;
        target.totals[metricKey] += Number(metric[metricKey] || 0);
      });
      buckets.set(timestamp, target);
    });

    const points = [...buckets.values()].map((bucket) => {
      const latest = bucket.latest;
      const average = (key: keyof Bucket['totals']) =>
        Number((bucket.totals[key] / bucket.count).toFixed(2));

      return {
        _id: String(latest._id),
        server: String(latest.server),
        os: latest.os,
        cpuUsagePercent: average('cpuUsagePercent'),
        cpuDeltaPercent: Number((latest.cpuDeltaPercent || 0).toFixed(2)),
        trend: latest.trend || 'stable',
        isSpike: Boolean(latest.isSpike),
        spikeSeverity: latest.spikeSeverity || 'low',
        probableReason: latest.probableReason || 'No clear process-level cause found.',
        cpuCoreCount: latest.cpuCoreCount,
        loadAverage: average('loadAverage'),
        memoryUsagePercent: average('memoryUsagePercent'),
        memoryUsedBytes: latest.memoryUsedBytes,
        memoryFreeBytes: latest.memoryFreeBytes,
        swapUsagePercent: average('swapUsagePercent'),
        diskUsagePercent: average('diskUsagePercent'),
        diskReadBytesPerSecond: average('diskReadBytesPerSecond'),
        diskWriteBytesPerSecond: average('diskWriteBytesPerSecond'),
        filesystemGrowthBytesPerMinute: average('filesystemGrowthBytesPerMinute'),
        networkRxBytesPerSecond: average('networkRxBytesPerSecond'),
        networkTxBytesPerSecond: average('networkTxBytesPerSecond'),
        networkErrors: latest.networkErrors || 0,
        networkDroppedPackets: latest.networkDroppedPackets || 0,
        serviceSummary: latest.serviceSummary,
        processSummary: latest.processSummary,
        sshSessionActivity: latest.sshSessionActivity,
        filesystems: latest.filesystems,
        collectedAt: bucket.timestamp,
        pollIntervalMs: latest.pollIntervalMs,
        sampleCount: bucket.count,
      };
    });

    return {
      points,
      range,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      bucketMs,
      summary: {
        sampleCount: metrics.length,
        pointCount: points.length,
      },
    };
  },

  async getCpuMetrics(serverId: string, range = '24h', startTime?: string, endTime?: string) {
    const { start, end } = resolveCpuMetricWindow(range, startTime, endTime);
    const metrics = await MetricsHistory.find({
      ...buildServerFilter(serverId),
      collectedAt: { $gte: start, $lte: end },
    })
      .sort({ collectedAt: 1 })
      .select(
        [
          'cpuUsagePercent',
          'cpuDeltaPercent',
          'trend',
          'isSpike',
          'spikeSeverity',
          'probableReason',
          'memoryUsagePercent',
          'loadAverage',
          'diskReadBytesPerSecond',
          'diskWriteBytesPerSecond',
          'networkRxBytesPerSecond',
          'networkTxBytesPerSecond',
          'processSummary',
          'collectedAt',
        ].join(' '),
      )
      .lean<IMetricsHistory[]>();

    const byMinute = new Map<
      string,
      {
        timestamp: string;
        total: number;
        count: number;
        min: number;
        max: number;
        latest: IMetricsHistory;
      }
    >();

    metrics.forEach((metric) => {
      const timestamp = roundToMinute(metric.collectedAt);
      const bucket = byMinute.get(timestamp);
      const value = Number(metric.cpuUsagePercent || 0);
      if (!bucket) {
        byMinute.set(timestamp, {
          timestamp,
          total: value,
          count: 1,
          min: value,
          max: value,
          latest: metric,
        });
        return;
      }

      bucket.total += value;
      bucket.count += 1;
      bucket.min = Math.min(bucket.min, value);
      bucket.max = Math.max(bucket.max, value);
      bucket.latest = metric;
    });

    const points = [...byMinute.values()].map((bucket) => {
      const metric = bucket.latest;
      const averageCpu = Number((bucket.total / bucket.count).toFixed(2));
      const topProcesses = (metric.processSummary?.topCpu || []).slice(0, 5);

      return {
        timestamp: bucket.timestamp,
        cpuUsagePercent: averageCpu,
        cpuDeltaPercent: Number((metric.cpuDeltaPercent || 0).toFixed(2)),
        trend: metric.trend || 'stable',
        isSpike: Boolean(metric.isSpike),
        spikeSeverity: metric.spikeSeverity || 'low',
        probableReason: metric.probableReason || 'No clear process-level cause found.',
        topProcesses,
        runningProcessCount: metric.processSummary?.total || 0,
        memoryUsagePercent: Number((metric.memoryUsagePercent || 0).toFixed(2)),
        loadAverage: Number((metric.loadAverage || 0).toFixed(2)),
        diskReadBytesPerSecond: Number((metric.diskReadBytesPerSecond || 0).toFixed(2)),
        diskWriteBytesPerSecond: Number((metric.diskWriteBytesPerSecond || 0).toFixed(2)),
        networkRxBytesPerSecond: Number((metric.networkRxBytesPerSecond || 0).toFixed(2)),
        networkTxBytesPerSecond: Number((metric.networkTxBytesPerSecond || 0).toFixed(2)),
        min: Number(bucket.min.toFixed(2)),
        max: Number(bucket.max.toFixed(2)),
        sampleCount: bucket.count,
      };
    });

    const values = points.map((point) => point.cpuUsagePercent);
    const summary = values.length
      ? {
          average: Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2)),
          min: Number(Math.min(...values).toFixed(2)),
          max: Number(Math.max(...values).toFixed(2)),
          sampleCount: metrics.length,
          pointCount: points.length,
        }
      : {
          average: 0,
          min: 0,
          max: 0,
          sampleCount: 0,
          pointCount: 0,
        };

    return { points, summary, range, startTime: start.toISOString(), endTime: end.toISOString() };
  },
};
