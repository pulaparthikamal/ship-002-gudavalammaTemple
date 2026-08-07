import { describe, expect, it } from '@jest/globals';
import { metricSpikeDetectorService } from './metricSpikeDetector.service';

const current = {
  cpuUsagePercent: 90,
  memoryUsagePercent: 30,
  swapUsagePercent: 0,
  diskUsagePercent: 45,
  loadAverage: 1,
  diskReadBytesPerSecond: 1024,
  diskWriteBytesPerSecond: 1024,
  filesystemGrowthBytesPerMinute: 0,
  networkRxBytesPerSecond: 1024,
  networkTxBytesPerSecond: 1024,
  serviceSummary: {
    running: 10,
    failed: 0,
    inactive: 1,
    failedServices: [],
  },
  processSummary: {
    total: 90,
    zombies: 0,
    blocked: 0,
    topCpu: [],
  },
  sshSessionActivity: {
    loggedInUsers: 1,
    establishedSessions: 1,
    recentAuthWarnings: 0,
  },
};

describe('metricSpikeDetectorService', () => {
  it('detects a CPU spike against recent baseline', () => {
    const spikes = metricSpikeDetectorService.detect(current, [
      {
        cpuUsagePercent: 20,
        memoryUsagePercent: 30,
        swapUsagePercent: 0,
        diskUsagePercent: 45,
        diskReadBytesPerSecond: 1024,
        diskWriteBytesPerSecond: 1024,
        networkRxBytesPerSecond: 1024,
        networkTxBytesPerSecond: 1024,
      },
    ] as any);

    expect(spikes.some((spike) => spike.metric === 'cpu')).toBe(true);
  });

  it('detects failed services even without resource pressure', () => {
    const spikes = metricSpikeDetectorService.detect({
      ...current,
      cpuUsagePercent: 10,
      serviceSummary: {
        running: 8,
        failed: 2,
        inactive: 1,
        failedServices: ['nginx.service'],
      },
    });

    expect(spikes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          metric: 'services',
          severity: 'warning',
        }),
      ]),
    );
  });
});
