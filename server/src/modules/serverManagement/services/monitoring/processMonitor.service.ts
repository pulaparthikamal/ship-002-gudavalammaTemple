import { IMetricsHistory, IProcessHealthSnapshot } from '../../models/metricsHistory.model';

export interface ProcessHealthAssessment {
  total: number;
  zombies: number;
  blocked: number;
  topCpu: IProcessHealthSnapshot[];
  unhealthy: boolean;
  notes: string[];
}

export const processMonitorService = {
  assess(
    processSummary: Pick<
      IMetricsHistory['processSummary'],
      'total' | 'zombies' | 'blocked' | 'topCpu'
    >,
  ): ProcessHealthAssessment {
    const notes: string[] = [];

    if (processSummary.zombies > 0) {
      notes.push(`${processSummary.zombies} zombie processes found.`);
    }

    if (processSummary.blocked > 0) {
      notes.push(`${processSummary.blocked} uninterruptible sleep processes found.`);
    }

    const highCpuProcesses = processSummary.topCpu.filter((process) => process.cpuPercent >= 80);
    if (highCpuProcesses.length) {
      notes.push(`${highCpuProcesses.length} processes are above 80% CPU.`);
    }

    return {
      total: processSummary.total,
      zombies: processSummary.zombies,
      blocked: processSummary.blocked,
      topCpu: processSummary.topCpu,
      unhealthy: processSummary.zombies > 0 || processSummary.blocked > 0,
      notes,
    };
  },
};
