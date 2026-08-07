import { describe, expect, it, jest, beforeEach, afterEach } from '@jest/globals';
import { Types } from 'mongoose';
import { fileScannerService } from './fileScanner.service';
import { ServerConnection } from '../models/serverConnection.model';
import { FileScanResult, QuarantinedFile, FileBackupHistory } from '../models/fileScanner.model';
import { sshService } from './ssh.service';

describe('FileScanner restore (quarantine & backup)', () => {
  const serverId = new Types.ObjectId();
  const resultId = new Types.ObjectId();

  const mockServer = { _id: serverId, host: '127.0.0.1', port: 22, active: true, status: 'connected' };

  const buildResult = (overrides: Record<string, unknown> = {}) => ({
    _id: resultId,
    server: serverId,
    filePath: '/tmp/test-script.sh',
    fileName: 'test-script.sh',
    fileSize: 42,
    fileHash: 'ORIGINALHASH',
    permissions: '640',
    owner: 'root:root',
    riskLevel: 'critical',
    riskScore: 90,
    riskReasons: ['bad'],
    detectedPatterns: ['x'],
    harmfulBehaviors: ['destructive_command'],
    recommendedAction: 'quarantine',
    scanStatus: 'completed',
    backupStatus: 'backup_completed',
    backupPath: '/var/backups/server-agent/file-scanner/1-1-test-script.sh.tar.gz',
    compressedBackupPath: '/var/backups/server-agent/file-scanner/1-1-test-script.sh.tar.gz',
    quarantineStatus: 'quarantined',
    quarantinePath: '/var/quarantine/server-agent/1-1-test-script.sh',
    actionStatus: 'quarantined',
    save: (jest.fn() as any).mockResolvedValue(true),
    ...overrides,
  });

  let execSpy: any;
  let historyCreateSpy: any;
  let quarantineUpdateSpy: any;

  beforeEach(() => {
    jest.spyOn(ServerConnection, 'findById').mockResolvedValue(mockServer as any);
    quarantineUpdateSpy = jest.spyOn(QuarantinedFile, 'updateMany').mockResolvedValue({} as any);
    historyCreateSpy = jest.spyOn(FileBackupHistory, 'create').mockResolvedValue({} as any);
    execSpy = jest.spyOn(sshService, 'executeNoRetry');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('restores a quarantined file to its original path and marks it safe', async () => {
    const result = buildResult();
    jest.spyOn(FileScanResult, 'findById').mockResolvedValue(result as any);
    execSpy.mockResolvedValue({
      code: 0,
      stdout: 'restoredHash=ORIGINALHASH\nrestoredSize=42\nrestoredMtime=1700000000\n',
      stderr: '',
    } as any);

    const restored = await fileScannerService.restore(String(resultId));

    // Command targeted the correct source (backup) and destination (original path)
    const command = execSpy.mock.calls[0][1] as string;
    expect(command).toContain(result.backupPath);
    expect(command).toContain(result.filePath);

    expect(restored.riskLevel).toBe('safe');
    expect(restored.actionStatus).toBe('restore_completed');
    expect(restored.quarantineStatus).toBe('restore_completed');
    expect(restored.scanStatus).toBe('marked_safe');
    expect(result.save).toHaveBeenCalled();
    // Quarantine status cleared + audit trail written
    expect(quarantineUpdateSpy).toHaveBeenCalledWith(
      { scanResult: resultId },
      expect.objectContaining({ $set: expect.objectContaining({ status: 'restored' }) }),
    );
    expect(historyCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
  });

  it('rejects an invalid scan result id', async () => {
    await expect(fileScannerService.restore('not-an-id')).rejects.toThrow(/Invalid scan result id/);
  });

  it('throws a clear error when the scan result does not exist', async () => {
    jest.spyOn(FileScanResult, 'findById').mockResolvedValue(null as any);
    await expect(fileScannerService.restore(String(resultId))).rejects.toThrow(/Scan result not found/);
  });

  it('throws when no backup is available for the file', async () => {
    const result = buildResult({ backupPath: undefined, compressedBackupPath: undefined });
    jest.spyOn(FileScanResult, 'findById').mockResolvedValue(result as any);
    await expect(fileScannerService.restore(String(resultId))).rejects.toThrow(/No backup is available/);
  });

  it('surfaces server-side filesystem errors and records a failed audit entry', async () => {
    const result = buildResult();
    jest.spyOn(FileScanResult, 'findById').mockResolvedValue(result as any);
    execSpy.mockResolvedValue({
      code: 14,
      stdout: '',
      stderr: 'failed to write restored file to destination: /tmp/test-script.sh',
    } as any);

    await expect(fileScannerService.restore(String(resultId))).rejects.toThrow(/failed to write restored file/);
    expect(historyCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
    // DB status must NOT be flipped to restored on failure
    expect(result.save).not.toHaveBeenCalled();
    expect(quarantineUpdateSpy).not.toHaveBeenCalled();
  });

  it('fails verification when the restored hash does not match the original scan hash', async () => {
    const result = buildResult();
    jest.spyOn(FileScanResult, 'findById').mockResolvedValue(result as any);
    execSpy.mockResolvedValue({
      code: 0,
      stdout: 'restoredHash=DIFFERENTHASH\nrestoredSize=42\nrestoredMtime=1700000000\n',
      stderr: '',
    } as any);

    await expect(fileScannerService.restore(String(resultId))).rejects.toThrow(/verification failed/i);
    expect(historyCreateSpy).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed' }));
  });
});
