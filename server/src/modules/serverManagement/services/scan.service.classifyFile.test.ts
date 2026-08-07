import { describe, expect, it } from '@jest/globals';
import { classifyFile } from './scan.service';
import { FileCategory } from '../models/scanResult.model';

// Mirrors execution.service.ts / agent.service.ts protected categories. A file
// carrying any of these (as category or tag) can never be auto-deleted.
const protectedCategories: FileCategory[] = ['system', 'config', 'application', 'service'];
const isProtected = (result: { category: FileCategory; tags: FileCategory[] }) =>
  protectedCategories.some((c) => result.category === c || result.tags.includes(c));

// A very old access time — the exact condition that previously flagged stable
// source files as "unused" and made them auto-delete candidates.
const staleAccess = new Date(Date.now() - 365 * 86400000);
const config = { unusedFileDays: 30, largeFileMb: 100, logPatterns: [], tempPatterns: [] };

describe('classifyFile source-code protection', () => {
  it('protects the reported CRM source files regardless of stale access time', () => {
    const cases = [
      '/home/deploy/crm/server/models/employee.model.js',
      '/home/deploy/crm/server/unitTest/lib/utils/serviceUtils.js',
    ];
    for (const filePath of cases) {
      const result = classifyFile(filePath, 0.01, staleAccess, config);
      expect(result.tags).toContain('application');
      expect(result.tags).not.toContain('unused');
      expect(isProtected(result)).toBe(true);
    }
  });

  it('protects generic Node/Express project source files anywhere on disk', () => {
    const cases = [
      '/srv/app/src/controllers/user.controller.js',
      '/opt/api/src/middleware/auth.middleware.ts',
      '/random/location/services/billing.service.ts',
      '/var/data/project/routes/index.js',
      '/x/utils/helpers.mjs',
      '/x/models/order.model.cjs',
    ];
    for (const filePath of cases) {
      const result = classifyFile(filePath, 0.01, staleAccess, config);
      expect(isProtected(result)).toBe(true);
      expect(result.tags).not.toContain('unused');
    }
  });

  it('still flags genuinely stale non-source files as unused (behavior unchanged)', () => {
    const result = classifyFile('/var/data/reports/old-report.dat', 0.01, staleAccess, config);
    expect(result.tags).toContain('unused');
    expect(isProtected(result)).toBe(false);
  });

  it('still classifies real logs as logs, not protected', () => {
    const result = classifyFile('/var/log/app/access.log', 0.01, staleAccess, config);
    expect(result.tags).toContain('logs');
  });
});
