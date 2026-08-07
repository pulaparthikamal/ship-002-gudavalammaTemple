import { describe, expect, it } from '@jest/globals';
import { parseOsMetricSnapshot } from './osMetricCollector.service';

describe('parseOsMetricSnapshot', () => {
  it('parses lightweight Linux collector output', () => {
    const parsed = parseOsMetricSnapshot(`
__SECTION__ os
hostname=server-1
kernel=6.1.0
id=ubuntu
name=Ubuntu 24.04
version=24.04
systemdAvailable=true
journaldAvailable=true
__SECTION__ cpu
total=1000
idle=700
loadAverage=0.42
__SECTION__ memory
memoryUsagePercent=55.5
swapUsagePercent=2.5
memoryCachedBytes=104857600
__SECTION__ filesystems
/dev/sda1|/|500|1000|50
__SECTION__ diskstats
readSectors=10
writeSectors=20
__SECTION__ netdev
rxBytes=100
txBytes=200
__SECTION__ services
running=20
failed=1
inactive=3
runningService=nginx.service
inactiveService=api.service
serviceIssue=api.service|systemd|failed|service crashed
__SECTION__ processes
total=80
zombies=0
blocked=1
top=123|1|R|12.5|3.1|node
__SECTION__ ssh
loggedInUsers=1
establishedSessions=2
recentAuthWarnings=0
`);

    expect(parsed.os.id).toBe('ubuntu');
    expect(parsed.memoryCachedBytes).toBe(104857600);
    expect(parsed.diskUsagePercent).toBe(50);
    expect(parsed.serviceSummary.failedServices).toEqual(['api.service']);
    expect(parsed.serviceSummary.serviceIssues?.[0]).toEqual({
      service: 'api.service',
      manager: 'systemd',
      status: 'failed',
      reason: 'service crashed',
    });
    expect(parsed.processSummary.topCpu[0].name).toBe('node');
    expect(parsed.rawCounters.networkTxBytes).toBe(200);
  });

  it('detects a previously running systemd unit that became inactive', () => {
    const parsed = parseOsMetricSnapshot(`
__SECTION__ services
running=19
failed=0
inactive=4
runningService=postgresql.service
inactiveService=nginx.service
`, {
      os: { id: 'ubuntu', name: 'Ubuntu', systemdAvailable: true, journaldAvailable: true },
      filesystems: [],
      rawCounters: {
        cpuTotal: 0,
        cpuIdle: 0,
        diskReadSectors: 0,
        diskWriteSectors: 0,
        networkRxBytes: 0,
        networkTxBytes: 0,
      },
      processSummary: { total: 0, zombies: 0, blocked: 0, topCpu: [] },
      sshSessionActivity: { loggedInUsers: 0, establishedSessions: 0, recentAuthWarnings: 0 },
      serviceSummary: {
        running: 20,
        failed: 0,
        inactive: 3,
        failedServices: [],
        runningServices: ['nginx.service', 'postgresql.service'],
        inactiveServices: [],
        serviceIssues: [],
      },
    });

    expect(parsed.serviceSummary.failedServices).toEqual(['nginx.service']);
    expect(parsed.serviceSummary.serviceIssues?.[0]?.reason).toBe('user manually stopped the service');
  });
});
