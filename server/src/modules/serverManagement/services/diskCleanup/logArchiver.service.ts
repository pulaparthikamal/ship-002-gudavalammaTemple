import path from 'path';
import { createHash } from 'crypto';
import { IServerConnection } from '../../models/serverConnection.model';
import { shellQuote } from '../../utils/shell.util';
import { sshService } from '../ssh.service';

const archiveRoot = '/tmp/ai-disk-cleanup-archives';

const archivePathFor = (filePath: string) => {
  const hash = createHash('sha1').update(filePath).digest('hex').slice(0, 12);
  const baseName = path.posix.basename(filePath).replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80);
  return `${archiveRoot}/${Date.now()}-${hash}-${baseName}.gz`;
};

export const logArchiverService = {
  async archive(server: IServerConnection, filePath: string) {
    const archivePath = archivePathFor(filePath);
    const command = [
      'set +e',
      `f=${shellQuote(filePath)}`,
      `a=${shellQuote(archivePath)}`,
      '[ -f "$f" ] || exit 3',
      `mkdir -p ${shellQuote(archiveRoot)} 2>/dev/null || exit 4`,
      'gzip -c -- "$f" > "$a"',
    ].join('\n');
    const result = await sshService.execute(server, command, 30000);
    if (result.code !== 0) {
      throw new Error(result.stderr || result.stdout || 'Archive command failed.');
    }
    return archivePath;
  },
};
