import { Types } from 'mongoose';
import { IMetricSeries, MetricAggregation, MetricGranularity, MetricNamespace, MetricSeries } from '../../models/metricSeries.model';
import { IMetricsHistory } from '../../models/metricsHistory.model';

export type MetricTimeRange = '30m' | '1h' | '4h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom';
export type MetricGranularityInput = MetricGranularity | 'auto';

interface MetricDefinition {
  namespace: MetricNamespace;
  metricName: string;
  label: string;
  unit: string;
  description: string;
}

interface MetricPointInput {
  namespace: MetricNamespace;
  metricName: string;
  value: number | undefined | null;
  unit: string;
  dimensions?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface QueryMetricsInput {
  serverId: string;
  namespace?: MetricNamespace;
  metricName: string;
  aggregation?: MetricAggregation;
  timeRange?: MetricTimeRange;
  startTime?: string;
  endTime?: string;
  granularity?: MetricGranularityInput;
  dimensions?: string | Record<string, unknown>;
}

const SERIES_SAMPLE_INTERVAL_MS = 60_000;

const metricDefinitions: MetricDefinition[] = [
  { namespace: 'CPU', metricName: 'cpuUsagePercent', label: 'CPU usage', unit: '%', description: 'Average CPU utilization percentage.' },
  { namespace: 'CPU', metricName: 'cpuLoadAverage', label: 'CPU load average', unit: 'load', description: '1-minute system load average.' },
  { namespace: 'CPU', metricName: 'cpuCoreCount', label: 'CPU cores', unit: 'count', description: 'Detected CPU core count.' },
  { namespace: 'CPU', metricName: 'cpuSpikeCount', label: 'CPU spike count', unit: 'count', description: 'CPU spike events in sampled metrics.' },
  { namespace: 'Memory', metricName: 'memoryUsagePercent', label: 'Memory usage', unit: '%', description: 'Memory utilization percentage.' },
  { namespace: 'Memory', metricName: 'memoryUsed', label: 'Memory used', unit: 'B', description: 'Used memory in bytes.' },
  { namespace: 'Memory', metricName: 'memoryFree', label: 'Memory free', unit: 'B', description: 'Available memory in bytes.' },
  { namespace: 'Memory', metricName: 'swapUsagePercent', label: 'Swap usage', unit: '%', description: 'Swap utilization percentage.' },
  { namespace: 'Disk', metricName: 'diskUsagePercent', label: 'Disk usage', unit: '%', description: 'Root filesystem disk utilization percentage.' },
  { namespace: 'Disk', metricName: 'diskUsed', label: 'Disk used', unit: 'B', description: 'Root filesystem used bytes.' },
  { namespace: 'Disk', metricName: 'diskFree', label: 'Disk free', unit: 'B', description: 'Root filesystem free bytes.' },
  { namespace: 'Disk', metricName: 'diskReadBytes', label: 'Disk read', unit: 'B/s', description: 'Disk read throughput.' },
  { namespace: 'Disk', metricName: 'diskWriteBytes', label: 'Disk write', unit: 'B/s', description: 'Disk write throughput.' },
  { namespace: 'Network', metricName: 'networkRxBytes', label: 'Network received', unit: 'B/s', description: 'Network receive throughput.' },
  { namespace: 'Network', metricName: 'networkTxBytes', label: 'Network sent', unit: 'B/s', description: 'Network transmit throughput.' },
  { namespace: 'Network', metricName: 'networkErrors', label: 'Network errors', unit: 'count', description: 'Network interface error counter.' },
  { namespace: 'Network', metricName: 'networkDroppedPackets', label: 'Network dropped packets', unit: 'count', description: 'Network dropped packet counter.' },
  { namespace: 'Process', metricName: 'runningProcessCount', label: 'Running processes', unit: 'count', description: 'Total process count from sampled diagnostics.' },
  { namespace: 'Process', metricName: 'topCpuProcess', label: 'Top CPU process', unit: '%', description: 'CPU percentage of the top process.' },
  { namespace: 'Process', metricName: 'topMemoryProcess', label: 'Top memory process', unit: '%', description: 'Memory percentage of the top memory process available in sampled diagnostics.' },
  { namespace: 'Application', metricName: 'failedRequests', label: 'Failed requests', unit: 'count', description: 'Application failure count when available.' },
  { namespace: 'Application', metricName: 'requestCount', label: 'Request count', unit: 'count', description: 'Application request count when available.' },
  { namespace: 'Application', metricName: 'errorRate', label: 'Error rate', unit: '%', description: 'Application error rate when available.' },
  { namespace: 'Application', metricName: 'responseTime', label: 'Response time', unit: 'ms', description: 'Application response time when available.' },
  { namespace: 'Application', metricName: 'uptime', label: 'Uptime', unit: 'state', description: 'Availability sample based on monitoring reachability.' },
  { namespace: 'Security', metricName: 'sshAuthWarnings', label: 'SSH auth warnings', unit: 'count', description: 'Recent SSH/auth warnings from sampled diagnostics.' },
  { namespace: 'Security', metricName: 'sshEstablishedSessions', label: 'SSH sessions', unit: 'count', description: 'Established SSH sessions when network scan is enabled.' },
  { namespace: 'Docker', metricName: 'containerCount', label: 'Containers', unit: 'count', description: 'Container count when available.' },
];

const timeRangeToMs = (range: MetricTimeRange = '24h') => {
  const ranges: Record<Exclude<MetricTimeRange, 'custom'>, number> = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };

  return range === 'custom' ? ranges['24h'] : ranges[range];
};

const granularityToMs = (granularity: MetricGranularity) => {
  const values: Record<MetricGranularity, number> = {
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '1d': 24 * 60 * 60 * 1000,
  };
  return values[granularity];
};

const resolveAutoGranularity = (timeRange: MetricTimeRange = '24h'): MetricGranularity => {
  if (timeRange === '30m' || timeRange === '1h') return '1m';
  if (timeRange === '4h') return '5m';
  if (timeRange === '12h' || timeRange === '24h' || timeRange === '48h') return '15m';
  if (timeRange === '7d') return '1h';
  if (timeRange === '30d') return '1d';
  return '15m';
};

const bucketTimestamp = (date: Date, granularity: MetricGranularity) =>
  new Date(Math.floor(date.getTime() / granularityToMs(granularity)) * granularityToMs(granularity));

const average = (values: number[]) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const aggregateValues = (values: number[], aggregation: MetricAggregation) => {
  if (!values.length) return 0;
  if (aggregation === 'min') return Math.min(...values);
  if (aggregation === 'max') return Math.max(...values);
  if (aggregation === 'sum') return values.reduce((sum, value) => sum + value, 0);
  if (aggregation === 'count') return values.length;
  return average(values);
};

const normalizeNumber = (value: number | undefined | null) =>
  Number.isFinite(Number(value)) ? Number(value) : undefined;

const metricPointsFromHistory = (metric: IMetricsHistory): MetricPointInput[] => {
  const topCpu = metric.processSummary?.topCpu?.[0];
  const topMemory = [...(metric.processSummary?.topCpu || [])].sort((first, second) => second.memoryPercent - first.memoryPercent)[0];
  const rootFs = metric.filesystems?.find((fs) => fs.mount === '/') || metric.filesystems?.[0];
  const diskFreeBytes = rootFs ? Math.max(0, rootFs.totalBytes - rootFs.usedBytes) : undefined;

  return [
    { namespace: 'CPU', metricName: 'cpuUsagePercent', value: metric.cpuUsagePercent, unit: '%', metadata: { trend: metric.trend, probableReason: metric.probableReason } },
    { namespace: 'CPU', metricName: 'cpuLoadAverage', value: metric.loadAverage, unit: 'load' },
    { namespace: 'CPU', metricName: 'cpuCoreCount', value: metric.cpuCoreCount, unit: 'count' },
    { namespace: 'CPU', metricName: 'cpuSpikeCount', value: metric.isSpike ? 1 : 0, unit: 'count', metadata: { severity: metric.spikeSeverity } },
    { namespace: 'Memory', metricName: 'memoryUsagePercent', value: metric.memoryUsagePercent, unit: '%' },
    { namespace: 'Memory', metricName: 'memoryUsed', value: metric.memoryUsedBytes, unit: 'B' },
    { namespace: 'Memory', metricName: 'memoryFree', value: metric.memoryFreeBytes, unit: 'B' },
    { namespace: 'Memory', metricName: 'swapUsagePercent', value: metric.swapUsagePercent, unit: '%' },
    { namespace: 'Disk', metricName: 'diskUsagePercent', value: metric.diskUsagePercent, unit: '%' },
    { namespace: 'Disk', metricName: 'diskUsed', value: rootFs?.usedBytes, unit: 'B', dimensions: rootFs ? { mount: rootFs.mount } : {} },
    { namespace: 'Disk', metricName: 'diskFree', value: diskFreeBytes, unit: 'B', dimensions: rootFs ? { mount: rootFs.mount } : {} },
    { namespace: 'Disk', metricName: 'diskReadBytes', value: metric.diskReadBytesPerSecond, unit: 'B/s' },
    { namespace: 'Disk', metricName: 'diskWriteBytes', value: metric.diskWriteBytesPerSecond, unit: 'B/s' },
    { namespace: 'Network', metricName: 'networkRxBytes', value: metric.networkRxBytesPerSecond, unit: 'B/s' },
    { namespace: 'Network', metricName: 'networkTxBytes', value: metric.networkTxBytesPerSecond, unit: 'B/s' },
    { namespace: 'Network', metricName: 'networkErrors', value: metric.networkErrors, unit: 'count' },
    { namespace: 'Network', metricName: 'networkDroppedPackets', value: metric.networkDroppedPackets, unit: 'count' },
    { namespace: 'Process', metricName: 'runningProcessCount', value: metric.processSummary?.total || 0, unit: 'count' },
    {
      namespace: 'Process',
      metricName: 'topCpuProcess',
      value: topCpu?.cpuPercent || 0,
      unit: '%',
      dimensions: topCpu ? { processName: topCpu.name, pid: topCpu.pid } : {},
      metadata: topCpu ? { ...topCpu } : {},
    },
    {
      namespace: 'Process',
      metricName: 'topMemoryProcess',
      value: topMemory?.memoryPercent || 0,
      unit: '%',
      dimensions: topMemory ? { processName: topMemory.name, pid: topMemory.pid } : {},
      metadata: topMemory ? { ...topMemory } : {},
    },
    { namespace: 'Application', metricName: 'uptime', value: 1, unit: 'state' },
    { namespace: 'Security', metricName: 'sshAuthWarnings', value: metric.sshSessionActivity?.recentAuthWarnings || 0, unit: 'count' },
    { namespace: 'Security', metricName: 'sshEstablishedSessions', value: metric.sshSessionActivity?.establishedSessions || 0, unit: 'count' },
  ];
};

const parseDimensions = (dimensions?: string | Record<string, unknown>) => {
  if (!dimensions) return {};
  if (typeof dimensions === 'object') return dimensions;
  try {
    return JSON.parse(dimensions);
  } catch {
    return dimensions.split(',').reduce<Record<string, string>>((acc, pair) => {
      const [key, value] = pair.split('=').map((item) => item?.trim());
      if (key && value) acc[key] = value;
      return acc;
    }, {});
  }
};

export const metricSeriesService = {
  definitions() {
    const namespaces = Array.from(new Set(metricDefinitions.map((metric) => metric.namespace)));
    return { namespaces, metrics: metricDefinitions };
  },

  async persistFromHistory(metric: IMetricsHistory) {
    const serverId = String(metric.server);
    const collectedAt = metric.collectedAt || new Date();
    const points = metricPointsFromHistory(metric).filter((point) => normalizeNumber(point.value) !== undefined);

    await Promise.all(points.map(async (point) => {
      const value = normalizeNumber(point.value);
      if (value === undefined) {
        return;
      }

      const latest = await MetricSeries.findOne({
        server: metric.server,
        metricName: point.metricName,
      })
        .sort({ collectedAt: -1 })
        .select('collectedAt')
        .lean<Pick<IMetricSeries, 'collectedAt'> | null>();

      if (latest?.collectedAt && collectedAt.getTime() - latest.collectedAt.getTime() < SERIES_SAMPLE_INTERVAL_MS) {
        return;
      }

      await MetricSeries.create({
        server: new Types.ObjectId(serverId),
        namespace: point.namespace,
        metricName: point.metricName,
        value,
        unit: point.unit,
        dimensions: point.dimensions || {},
        collectedAt,
        granularity: '1m',
        metadata: point.metadata || {},
        createdAt: new Date(),
      });
    }));
  },

  async query(input: QueryMetricsInput) {
    const timeRange = input.timeRange || '24h';
    const endTime = input.timeRange === 'custom' && input.endTime ? new Date(input.endTime) : new Date();
    const startTime = input.timeRange === 'custom' && input.startTime
      ? new Date(input.startTime)
      : new Date(endTime.getTime() - timeRangeToMs(timeRange));
    const granularity = input.granularity && input.granularity !== 'auto'
      ? input.granularity
      : resolveAutoGranularity(timeRange);
    const aggregation = input.aggregation || 'avg';
    const dimensions = parseDimensions(input.dimensions);
    const filter: Record<string, unknown> = {
      server: new Types.ObjectId(input.serverId),
      metricName: input.metricName,
      collectedAt: { $gte: startTime, $lte: endTime },
    };
    if (input.namespace) filter.namespace = input.namespace;
    Object.entries(dimensions).forEach(([key, value]) => {
      filter[`dimensions.${key}`] = value;
    });

    const docs = await MetricSeries.find(filter)
      .sort({ collectedAt: 1 })
      .lean<IMetricSeries[]>();

    const buckets = new Map<string, number[]>();
    docs.forEach((doc) => {
      const timestamp = bucketTimestamp(doc.collectedAt, granularity).toISOString();
      buckets.set(timestamp, [...(buckets.get(timestamp) || []), doc.value]);
    });

    const points = [...buckets.entries()].map(([timestamp, values]) => ({
      timestamp,
      value: Number(aggregateValues(values, aggregation).toFixed(2)),
    }));
    const pointValues = points.map((point) => point.value);
    const latest = docs[docs.length - 1]?.value ?? null;
    const unit = docs[docs.length - 1]?.unit || metricDefinitions.find((metric) => metric.metricName === input.metricName)?.unit || '';

    return {
      metricName: input.metricName,
      unit,
      aggregation,
      granularity,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      points,
      summary: {
        min: pointValues.length ? Number(Math.min(...pointValues).toFixed(2)) : 0,
        max: pointValues.length ? Number(Math.max(...pointValues).toFixed(2)) : 0,
        avg: pointValues.length ? Number(average(pointValues).toFixed(2)) : 0,
        latest: latest === null ? null : Number(Number(latest).toFixed(2)),
        count: docs.length,
      },
    };
  },
};
