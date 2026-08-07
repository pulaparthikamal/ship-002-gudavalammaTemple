import { ResourceSpikeMetric } from '../../models/resourceSpike.model';
import { IMetricsHistory } from '../../models/metricsHistory.model';

export interface MetricSpike {
  metric: ResourceSpikeMetric;
  severity: 'info' | 'warning' | 'critical';
  value: number;
  baseline: number;
  threshold: number;
  message: string;
  metadata?: Record<string, unknown>;
}

const avg = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const detectPercentSpike = (
  metric: ResourceSpikeMetric,
  value: number,
  baseline: number,
  warningThreshold: number,
  criticalThreshold: number,
): MetricSpike | undefined => {
  const dynamicThreshold = Math.max(warningThreshold, baseline + 25);
  if (value >= criticalThreshold) {
    return {
      metric,
      severity: 'critical',
      value,
      baseline,
      threshold: criticalThreshold,
      message: `${metric} reached ${value.toFixed(1)}%.`,
    };
  }

  if (value >= dynamicThreshold) {
    return {
      metric,
      severity: 'warning',
      value,
      baseline,
      threshold: dynamicThreshold,
      message: `${metric} spiked from ${baseline.toFixed(1)}% to ${value.toFixed(1)}%.`,
    };
  }

  return undefined;
};

export const metricSpikeDetectorService = {
  detect(
    current: Pick<
      IMetricsHistory,
      | 'cpuUsagePercent'
      | 'memoryUsagePercent'
      | 'swapUsagePercent'
      | 'diskUsagePercent'
      | 'loadAverage'
      | 'diskReadBytesPerSecond'
      | 'diskWriteBytesPerSecond'
      | 'filesystemGrowthBytesPerMinute'
      | 'networkRxBytesPerSecond'
      | 'networkTxBytesPerSecond'
      | 'serviceSummary'
      | 'processSummary'
      | 'sshSessionActivity'
    >,
    history: Array<Pick<
      IMetricsHistory,
      | 'cpuUsagePercent'
      | 'memoryUsagePercent'
      | 'swapUsagePercent'
      | 'diskUsagePercent'
      | 'diskReadBytesPerSecond'
      | 'diskWriteBytesPerSecond'
      | 'networkRxBytesPerSecond'
      | 'networkTxBytesPerSecond'
    >> = [],
  ): MetricSpike[] {
    const spikes: MetricSpike[] = [];
    const percentCandidates = [
      detectPercentSpike('cpu', current.cpuUsagePercent, avg(history.map((item) => item.cpuUsagePercent)), 75, 92),
      detectPercentSpike('memory', current.memoryUsagePercent, avg(history.map((item) => item.memoryUsagePercent)), 80, 94),
      detectPercentSpike('swap', current.swapUsagePercent, 0, 50, 80),
      detectPercentSpike('disk', current.diskUsagePercent, avg(history.map((item) => item.diskUsagePercent)), 82, 94),
    ].filter((item): item is MetricSpike => Boolean(item));
    spikes.push(...percentCandidates);

    const diskIo = current.diskReadBytesPerSecond + current.diskWriteBytesPerSecond;
    const diskBaseline = avg(
      history.map((item) => item.diskReadBytesPerSecond + item.diskWriteBytesPerSecond),
    );
    if (diskIo > Math.max(20 * 1024 * 1024, diskBaseline * 4)) {
      spikes.push({
        metric: 'disk_io',
        severity: diskIo > 80 * 1024 * 1024 ? 'critical' : 'warning',
        value: diskIo,
        baseline: diskBaseline,
        threshold: Math.max(20 * 1024 * 1024, diskBaseline * 4),
        message: 'Disk IO throughput spiked above baseline.',
      });
    }

    const network = current.networkRxBytesPerSecond + current.networkTxBytesPerSecond;
    const networkBaseline = avg(
      history.map((item) => item.networkRxBytesPerSecond + item.networkTxBytesPerSecond),
    );
    if (network > Math.max(25 * 1024 * 1024, networkBaseline * 4)) {
      spikes.push({
        metric: 'network',
        severity: network > 100 * 1024 * 1024 ? 'critical' : 'warning',
        value: network,
        baseline: networkBaseline,
        threshold: Math.max(25 * 1024 * 1024, networkBaseline * 4),
        message: 'Network throughput spiked above baseline.',
      });
    }

    if (current.filesystemGrowthBytesPerMinute > 500 * 1024 * 1024) {
      spikes.push({
        metric: 'filesystem_growth',
        severity: 'warning',
        value: current.filesystemGrowthBytesPerMinute,
        baseline: 0,
        threshold: 500 * 1024 * 1024,
        message: 'Filesystem usage is growing rapidly.',
      });
    }

    if (current.serviceSummary.failed > 0) {
      spikes.push({
        metric: 'services',
        severity: current.serviceSummary.failed >= 3 ? 'critical' : 'warning',
        value: current.serviceSummary.failed,
        baseline: 0,
        threshold: 1,
        message: `${current.serviceSummary.failed} failed services detected.`,
        metadata: { failedServices: current.serviceSummary.failedServices },
      });
    }

    if (current.processSummary.zombies > 0 || current.processSummary.blocked > 0) {
      spikes.push({
        metric: 'processes',
        severity: current.processSummary.blocked > 0 ? 'critical' : 'warning',
        value: current.processSummary.zombies + current.processSummary.blocked,
        baseline: 0,
        threshold: 1,
        message: 'Unhealthy process states detected.',
        metadata: {
          zombies: current.processSummary.zombies,
          blocked: current.processSummary.blocked,
        },
      });
    }

    if (current.sshSessionActivity.recentAuthWarnings > 0) {
      spikes.push({
        metric: 'ssh',
        severity: current.sshSessionActivity.recentAuthWarnings >= 5 ? 'critical' : 'warning',
        value: current.sshSessionActivity.recentAuthWarnings,
        baseline: 0,
        threshold: 1,
        message: 'Recent SSH authentication warnings detected.',
      });
    }

    return spikes;
  },
};
