import { describe, expect, it, jest, afterEach } from '@jest/globals';
import { safeDeletionService } from './safeDeletion.service';
import { sshService } from '../ssh.service';

describe('safeDeletionService', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const server = { _id: 'server-1', host: '127.0.0.1', port: 22, username: 'ops' } as any;

  it('skips files outside the allowlist without issuing SSH delete commands', async () => {
    const executeSpy = jest.spyOn(sshService, 'execute');
    const result = await safeDeletionService.deleteFile(server, '/etc/passwd', ['/tmp']);
    expect(result.status).toBe('SKIPPED');
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('skips recently modified files', async () => {
    const executeSpy = jest.spyOn(sshService, 'execute');
    const result = await safeDeletionService.deleteFile(server, '/tmp/recent.log', ['/tmp'], new Date());
    expect(result.status).toBe('SKIPPED');
    expect(result.message).toContain('recently');
    expect(executeSpy).not.toHaveBeenCalled();
  });

  it('deletes one validated file with rm -- and no recursive flags', async () => {
    const executeSpy = jest.spyOn(sshService, 'execute').mockResolvedValue({ stdout: '', stderr: '', code: 0 });
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await safeDeletionService.deleteFile(server, '/tmp/old.log', ['/tmp'], oldDate);
    expect(result.status).toBe('DELETED');
    const command = executeSpy.mock.calls[0][1];
    expect(command).toContain('rm -- "$f"');
    expect(command).not.toContain('rm -rf');
  });

  it('skips open files when lsof reports usage', async () => {
    jest.spyOn(sshService, 'execute').mockResolvedValue({ stdout: 'open\n', stderr: '', code: 4 });
    const oldDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const result = await safeDeletionService.deleteFile(server, '/tmp/open.log', ['/tmp'], oldDate);
    expect(result.status).toBe('SKIPPED');
    expect(result.message).toContain('open');
  });
});
