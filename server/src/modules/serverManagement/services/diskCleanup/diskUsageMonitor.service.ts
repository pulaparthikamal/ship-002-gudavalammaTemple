import { IServerConnection } from '../../models/serverConnection.model';
import { sshService } from '../ssh.service';

export interface DiskUsageSnapshot {
  filesystem: string;
  mount: string;
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
  usagePercent: number;
}

const toNumber = (value: string | undefined) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDf = (stdout: string): DiskUsageSnapshot => {
  const line = stdout.split('\n').filter(Boolean).at(-1) || '';
  const [filesystem, total, used, available, percent, mount] = line.trim().split(/\s+/);
  return {
    filesystem: filesystem || '',
    mount: mount || '/',
    totalBytes: toNumber(total),
    usedBytes: toNumber(used),
    availableBytes: toNumber(available),
    usagePercent: toNumber((percent || '').replace('%', '')),
  };
};

export const diskUsageMonitorService = {
  async getDiskUsage(server: IServerConnection) {
    const result = await sshService.execute(server, 'df -P -B1 / 2>/dev/null | tail -n 1', 15000);
    return parseDf(result.stdout);
  },

  isThresholdCrossed(usagePercent: number, policy: {
    warningThresholdPercent: number;
    criticalThresholdPercent: number;
    emergencyThresholdPercent: number;
  }) {
    return usagePercent >= policy.warningThresholdPercent;
  },

  thresholdLevel(usagePercent: number, policy: {
    warningThresholdPercent: number;
    criticalThresholdPercent: number;
    emergencyThresholdPercent: number;
  }) {
    if (usagePercent >= policy.emergencyThresholdPercent) return 'emergency';
    if (usagePercent >= policy.criticalThresholdPercent) return 'critical';
    if (usagePercent >= policy.warningThresholdPercent) return 'warning';
    return 'normal';
  },
};
