import { IMetricsHistory } from '../../models/metricsHistory.model';

export interface HealthScoreResult {
  score: number;
  status: 'healthy' | 'watch' | 'degraded' | 'critical';
  reasons: string[];
  components: {
    cpu: number;
    memory: number;
    disk: number;
    services: number;
    process: number;
    network: number;
    ssh: number;
  };
}

const scoreFromPercent = (value: number, warning: number, critical: number) => {
  if (value >= critical) {
    return 25;
  }
  if (value >= warning) {
    return 65;
  }
  return 100;
};

const weightedAverage = (values: Array<[number, number]>) => {
  const totalWeight = values.reduce((sum, [, weight]) => sum + weight, 0);
  const total = values.reduce((sum, [value, weight]) => sum + value * weight, 0);
  return Math.round(total / totalWeight);
};

const statusFromScore = (score: number): HealthScoreResult['status'] => {
  if (score < 40) return 'critical';
  if (score < 65) return 'degraded';
  if (score < 85) return 'watch';
  return 'healthy';
};

export const healthScoreService = {
  calculate(metric: Pick<
    IMetricsHistory,
    | 'cpuUsagePercent'
    | 'memoryUsagePercent'
    | 'swapUsagePercent'
    | 'diskUsagePercent'
    | 'loadAverage'
    | 'serviceSummary'
    | 'processSummary'
    | 'networkRxBytesPerSecond'
    | 'networkTxBytesPerSecond'
    | 'sshSessionActivity'
  >): HealthScoreResult {
    const reasons: string[] = [];
    const cpu = Math.min(
      scoreFromPercent(metric.cpuUsagePercent, 75, 92),
      metric.loadAverage >= 8 ? 55 : 100,
    );
    const memory = Math.min(
      scoreFromPercent(metric.memoryUsagePercent, 80, 94),
      metric.swapUsagePercent >= 50 ? 50 : 100,
    );
    const disk = scoreFromPercent(metric.diskUsagePercent, 78, 92);
    const services = metric.serviceSummary.failed > 0
      ? metric.serviceSummary.failed >= 3 ? 35 : 65
      : 100;
    const process = metric.processSummary.zombies || metric.processSummary.blocked
      ? Math.max(40, 100 - metric.processSummary.zombies * 10 - metric.processSummary.blocked * 15)
      : 100;
    const network = metric.networkRxBytesPerSecond > 50 * 1024 * 1024 ||
      metric.networkTxBytesPerSecond > 50 * 1024 * 1024
      ? 75
      : 100;
    const ssh = metric.sshSessionActivity.recentAuthWarnings > 0
      ? metric.sshSessionActivity.recentAuthWarnings >= 5 ? 40 : 75
      : 100;

    if (metric.cpuUsagePercent >= 75) reasons.push(`CPU usage is ${metric.cpuUsagePercent.toFixed(1)}%.`);
    if (metric.memoryUsagePercent >= 80) reasons.push(`Memory usage is ${metric.memoryUsagePercent.toFixed(1)}%.`);
    if (metric.swapUsagePercent >= 50) reasons.push(`Swap usage is ${metric.swapUsagePercent.toFixed(1)}%.`);
    if (metric.diskUsagePercent >= 78) reasons.push(`Root disk usage is ${metric.diskUsagePercent.toFixed(1)}%.`);
    if (metric.serviceSummary.failed > 0) reasons.push(`${metric.serviceSummary.failed} systemd services are failed.`);
    if (metric.processSummary.zombies > 0) reasons.push(`${metric.processSummary.zombies} zombie processes detected.`);
    if (metric.processSummary.blocked > 0) reasons.push(`${metric.processSummary.blocked} blocked processes detected.`);
    if (metric.sshSessionActivity.recentAuthWarnings > 0) {
      reasons.push(`${metric.sshSessionActivity.recentAuthWarnings} recent SSH auth warnings detected.`);
    }

    const weightedScore = weightedAverage([
      [cpu, 0.2],
      [memory, 0.2],
      [disk, 0.2],
      [services, 0.15],
      [process, 0.1],
      [network, 0.05],
      [ssh, 0.1],
    ]);
    const criticalComponentCount = [cpu, memory, disk, services, process, network, ssh].filter(
      (value) => value <= 40,
    ).length;
    const score = criticalComponentCount >= 3 ? Math.min(weightedScore, 35) : weightedScore;

    return {
      score,
      status: statusFromScore(score),
      reasons,
      components: { cpu, memory, disk, services, process, network, ssh },
    };
  },
};
