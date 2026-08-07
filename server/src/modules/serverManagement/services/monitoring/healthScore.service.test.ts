import { describe, expect, it } from '@jest/globals';
import { healthScoreService } from './healthScore.service';

const baseMetric = {
  cpuUsagePercent: 12,
  memoryUsagePercent: 35,
  swapUsagePercent: 0,
  diskUsagePercent: 42,
  loadAverage: 0.4,
  serviceSummary: {
    running: 12,
    failed: 0,
    inactive: 3,
    failedServices: [],
  },
  processSummary: {
    total: 100,
    zombies: 0,
    blocked: 0,
    topCpu: [],
  },
  networkRxBytesPerSecond: 1024,
  networkTxBytesPerSecond: 1024,
  sshSessionActivity: {
    loggedInUsers: 1,
    establishedSessions: 1,
    recentAuthWarnings: 0,
  },
};

describe('healthScoreService', () => {
  it('returns a healthy score for low-impact metrics', () => {
    const result = healthScoreService.calculate(baseMetric);

    expect(result.status).toBe('healthy');
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.reasons).toEqual([]);
  });

  it('degrades the score when services and resource pressure are unhealthy', () => {
    const result = healthScoreService.calculate({
      ...baseMetric,
      cpuUsagePercent: 95,
      memoryUsagePercent: 96,
      diskUsagePercent: 95,
      serviceSummary: {
        running: 8,
        failed: 4,
        inactive: 3,
        failedServices: ['api.service'],
      },
      processSummary: {
        total: 100,
        zombies: 2,
        blocked: 1,
        topCpu: [],
      },
    });

    expect(result.status).toBe('critical');
    expect(result.score).toBeLessThan(40);
    expect(result.reasons.join(' ')).toContain('systemd services');
  });
});
