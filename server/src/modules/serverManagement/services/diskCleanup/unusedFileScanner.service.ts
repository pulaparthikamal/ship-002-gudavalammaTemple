import { IServerConnection } from '../../models/serverConnection.model';
import { DiskCleanupFileCategory } from '../../models/diskCleanup.model';
import { shellQuote } from '../../utils/shell.util';
import { sshService } from '../ssh.service';
import { isPathWithinAllowlist, normalizeCleanupPath } from './cleanupPolicy.service';
import { CleanupCandidateInput } from './logFileScanner.service';

const tempRoots = ['/tmp', '/var/tmp'];

const categoryForPath = (filePath: string): DiskCleanupFileCategory =>
  tempRoots.some((root) => {
    const normalized = normalizeCleanupPath(filePath);
    return normalized === root || normalized.startsWith(`${root}/`);
  })
    ? 'TEMP'
    : 'UNUSED';

const parseFindRows = (stdout: string, allowlistedPaths: string[]) =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line): CleanupCandidateInput | undefined => {
      const [filePath, sizeRaw, modifiedRaw] = line.split('\t');
      if (!filePath) return undefined;
      const isAllowed = isPathWithinAllowlist(filePath, allowlistedPaths);
      return {
        filePath,
        fileSizeBytes: Number(sizeRaw) || 0,
        modifiedAt: new Date((Number(modifiedRaw) || 0) * 1000),
        fileCategory: categoryForPath(filePath),
        isAllowed,
        skipReason: isAllowed ? undefined : 'Path is not allowed by cleanup policy.',
      };
    })
    .filter((item): item is CleanupCandidateInput => Boolean(item));

export const unusedFileScannerService = {
  async scan(server: IServerConnection, allowlistedPaths: string[], tempRetentionDays: number) {
    const roots = allowlistedPaths.map(shellQuote).join(' ');
    const command = [
      'set +e',
      `for root in ${roots}; do`,
      '  [ -d "$root" ] || continue',
      `  find "$root" -type f -mtime +${Math.max(1, tempRetentionDays)} \\( -path ${shellQuote('/tmp/*')} -o -path ${shellQuote('/var/tmp/*')} -o -name ${shellQuote('*.tmp')} -o -name ${shellQuote('*.temp')} -o -name ${shellQuote('*.cache')} \\) -printf '%p\\t%s\\t%T@\\n' 2>/dev/null`,
      'done',
    ].join('\n');
    const result = await sshService.execute(server, command, 60000);
    return parseFindRows(result.stdout, allowlistedPaths);
  },
};
