import { IServerConnection } from '../../models/serverConnection.model';
import { shellQuote } from '../../utils/shell.util';
import { sshService } from '../ssh.service';
import { isPathWithinAllowlist } from './cleanupPolicy.service';

export type SafeDeletionResult =
  | { status: 'DELETED'; message: string }
  | { status: 'SKIPPED'; message: string }
  | { status: 'FAILED'; message: string };

const minFileAgeMs = 10 * 60 * 1000;

export const safeDeletionService = {
  async deleteFile(server: IServerConnection, filePath: string, allowlistedPaths: string[], modifiedAt?: Date): Promise<SafeDeletionResult> {
    if (!isPathWithinAllowlist(filePath, allowlistedPaths)) {
      return { status: 'SKIPPED', message: 'File is outside cleanup allowlist.' };
    }
    if (modifiedAt && Date.now() - modifiedAt.getTime() < minFileAgeMs) {
      return { status: 'SKIPPED', message: 'File was modified recently.' };
    }

    const command = [
      'set +e',
      `f=${shellQuote(filePath)}`,
      '[ -f "$f" ] || { echo "missing"; exit 3; }',
      'if command -v lsof >/dev/null 2>&1 && lsof -- "$f" >/dev/null 2>&1; then echo "open"; exit 4; fi',
      'rm -- "$f"',
    ].join('\n');
    const result = await sshService.execute(server, command, 30000);
    if (result.code === 0) {
      return { status: 'DELETED', message: 'File deleted.' };
    }
    if (result.code === 3) {
      return { status: 'SKIPPED', message: 'File no longer exists.' };
    }
    if (result.code === 4) {
      return { status: 'SKIPPED', message: 'File is currently open.' };
    }
    return { status: 'FAILED', message: result.stderr || result.stdout || 'Delete command failed.' };
  },
};
