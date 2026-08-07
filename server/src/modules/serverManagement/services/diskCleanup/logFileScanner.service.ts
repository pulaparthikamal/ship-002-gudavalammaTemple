import path from 'path';
import { IServerConnection } from '../../models/serverConnection.model';
import { DiskCleanupFileCategory } from '../../models/diskCleanup.model';
import { shellQuote } from '../../utils/shell.util';
import { sshService } from '../ssh.service';
import { isPathWithinAllowlist } from './cleanupPolicy.service';

export interface CleanupCandidateInput {
  filePath: string;
  fileSizeBytes: number;
  modifiedAt: Date;
  fileCategory: DiskCleanupFileCategory;
  isAllowed: boolean;
  skipReason?: string;
}

const parseFindRows = (stdout: string, fileCategory: DiskCleanupFileCategory, allowlistedPaths: string[]) =>
  stdout
    .split('\n')
    .filter(Boolean)
    .map((line): CleanupCandidateInput | undefined => {
      const [filePath, sizeRaw, modifiedRaw] = line.split('\t');
      if (!filePath) return undefined;
      const baseName = path.posix.basename(filePath).toLowerCase();
      const looksLikeLog = fileCategory !== 'LOG' || baseName.endsWith('.log') || baseName.endsWith('.out') || baseName.endsWith('.err') || baseName.includes('log');
      const isAllowed = looksLikeLog && isPathWithinAllowlist(filePath, allowlistedPaths);
      return {
        filePath,
        fileSizeBytes: Number(sizeRaw) || 0,
        modifiedAt: new Date((Number(modifiedRaw) || 0) * 1000),
        fileCategory,
        isAllowed,
        skipReason: isAllowed ? undefined : 'Path or file type is not allowed by cleanup policy.',
      };
    })
    .filter((item): item is CleanupCandidateInput => Boolean(item));

export const logFileScannerService = {
  async scan(server: IServerConnection, allowlistedPaths: string[], logRetentionDays: number, explicitFiles: string[] = []) {
    const roots = allowlistedPaths.map(shellQuote).join(' ');
    const files = explicitFiles.map(shellQuote).join(' ');
    const command = [
      'set +e',
      `for root in ${roots}; do`,
      '  [ -d "$root" ] || continue',
      `  find "$root" -type f -mtime +${Math.max(1, logRetentionDays)} \\( -name '*.log' -o -name '*.out' -o -name '*.err' -o -name '*log*' \\) -printf '%p\\t%s\\t%T@\\n' 2>/dev/null`,
      'done',
      `for file in ${files}; do`,
      '  [ -f "$file" ] || continue',
      `  find "$file" -maxdepth 0 -type f -mtime +${Math.max(1, logRetentionDays)} -printf '%p\\t%s\\t%T@\\n' 2>/dev/null`,
      'done',
    ].join('\n');
    const result = await sshService.execute(server, command, 60000);
    return parseFindRows(result.stdout, 'LOG', allowlistedPaths);
  },
};
