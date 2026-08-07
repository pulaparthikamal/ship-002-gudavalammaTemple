import { describe, expect, it } from '@jest/globals';
import {
  cleanupPolicyService,
  isPathWithinAllowlist,
  isValidCleanupPath,
} from './cleanupPolicy.service';

describe('cleanupPolicyService safety validation', () => {
  it('rejects broad, relative, traversal, and dynamic cleanup paths', () => {
    expect(isValidCleanupPath('/')).toBe(false);
    expect(isValidCleanupPath('tmp')).toBe(false);
    expect(isValidCleanupPath('/tmp/../etc')).toBe(false);
    expect(isValidCleanupPath('/tmp/*')).toBe(false);
    expect(isValidCleanupPath('/var/log')).toBe(true);
  });

  it('validates thresholds and defaults retention safely', () => {
    const policy = cleanupPolicyService.validate({ serverId: 'server-1' });
    expect(policy.logRetentionDays).toBe(7);
    expect(policy.tempRetentionDays).toBe(3);
    expect(policy.warningThresholdPercent).toBe(75);
    expect(policy.allowlistedPaths).toEqual(['/var/log', '/tmp', '/var/tmp']);
  });

  it('only allows files inside exact allowlisted roots', () => {
    expect(isPathWithinAllowlist('/var/log/app/old.log', ['/var/log'])).toBe(true);
    expect(isPathWithinAllowlist('/var/logs/app/old.log', ['/var/log'])).toBe(false);
    expect(isPathWithinAllowlist('/etc/passwd', ['/var/log', '/tmp'])).toBe(false);
  });

  it('rejects unordered thresholds', () => {
    expect(() =>
      cleanupPolicyService.validate({
        serverId: 'server-1',
        warningThresholdPercent: 90,
        criticalThresholdPercent: 85,
        emergencyThresholdPercent: 95,
      }),
    ).toThrow('thresholds');
  });
});
