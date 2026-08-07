import path from 'path';
import { Types } from 'mongoose';
import { FileAction, IScanResult, ScanResult } from '../models/scanResult.model';
import { ServerConnection } from '../models/serverConnection.model';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { DeletedFile, DeletedFileTrigger } from '../models/deletedFile.model';
import { configService } from './config.service';
import { sshService } from './ssh.service';
import { shellQuote } from '../utils/shell.util';
import { ragMemoryService } from './ragMemory.service';
import { alertService } from './alert.service';
import { socketService } from './socket.service';

interface ExecuteScanResultOptions {
  allowPendingReviewAutomation?: boolean;
  triggeredBy?: DeletedFileTrigger;
  backupDirectoryOverride?: string;
}

interface ExecutionCommand {
  command: string;
  archiveDestination?: string;
  archiveVerified?: boolean;
  deleteVerified?: boolean;
  auditLogId?: string;
}

const automaticDeleteCategories: Array<IScanResult['category']> = ['logs', 'unused'];
const protectedDeleteCategories: Array<IScanResult['category']> = [
  'system',
  'config',
  'application',
  'service',
];

const isAutomaticDeleteCandidate = (scanResult: IScanResult) =>
  automaticDeleteCategories.some(
    (category) => scanResult.category === category || scanResult.tags.includes(category),
  );

const hasAnyCategory = (scanResult: IScanResult, categories: Array<IScanResult['category']>) =>
  categories.some(
    (category) => scanResult.category === category || scanResult.tags.includes(category),
  );

const isInsidePath = (filePath: string, directory: string) => {
  const normalizedDirectory = directory.replace(/\/+$/, '');
  return normalizedDirectory && (filePath === normalizedDirectory || filePath.startsWith(`${normalizedDirectory}/`));
};

const ageInDays = (date: Date) =>
  Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));

const getMostRecentActivity = (scanResult: IScanResult) => {
  const timestamps = [
    scanResult.lastAccessed?.getTime(),
    scanResult.modifiedAt?.getTime(),
  ].filter((value): value is number => typeof value === 'number' && Number.isFinite(value));

  return new Date(Math.max(...timestamps));
};

const assertSafeToDelete = async (scanResult: IScanResult) => {
  const config = await configService.get(String(scanResult.server));

  if (hasAnyCategory(scanResult, protectedDeleteCategories)) {
    throw new Error('Delete blocked because protected operational files cannot be deleted.');
  }

  if (config.archiveDirectory && isInsidePath(scanResult.path, config.archiveDirectory)) {
    throw new Error('Delete blocked because archive directory contents are protected.');
  }

  const mostRecentActivity = getMostRecentActivity(scanResult);
  const activeAgeDays = ageInDays(mostRecentActivity);
  if (activeAgeDays < config.deleteOlderThanDays) {
    throw new Error(
      `Delete blocked because the file is active: latest access or modification is ${activeAgeDays} days old, below deleteOlderThanDays=${config.deleteOlderThanDays}.`,
    );
  }

  return config;
};

const buildArchiveCommand = (filePath: string, archiveDirectory: string): ExecutionCommand => {
  const dirName = path.posix.dirname(filePath);
  const baseName = path.posix.basename(filePath);
  const archiveName = `${baseName.replace(/[^a-zA-Z0-9._-]/g, '_')}-${Date.now()}.tar.gz`;
  const destination = path.posix.join(archiveDirectory, archiveName);

  const command = [
    `mkdir -p ${shellQuote(archiveDirectory)}`,
    `tar -czf ${shellQuote(destination)} -C ${shellQuote(dirName)} ${shellQuote(baseName)}`,
    `test -s ${shellQuote(destination)}`,
    `tar -tzf ${shellQuote(destination)} >/dev/null`,
  ].join(' && ');

  return { command, archiveDestination: destination };
};

const buildDeleteCommand = (filePath: string) => [
  `rm -f -- ${shellQuote(filePath)}`,
  `test ! -e ${shellQuote(filePath)}`,
].join(' && ');

const buildCommand = async (scanResult: IScanResult, action: FileAction): Promise<ExecutionCommand> => {
  if (action === 'delete') {
    return { command: buildDeleteCommand(scanResult.path) };
  }

  if (action === 'archive') {
    const config = await configService.get(String(scanResult.server));
    return buildArchiveCommand(scanResult.path, config.archiveDirectory);
  }

  return { command: '' };
};

export const executionService = {
  async executeScanResult(
    scanResult: IScanResult,
    action: FileAction,
    reason: string,
    decisionTrace: string[],
    options: ExecuteScanResultOptions = {},
  ) {
    const allowPendingReviewAutomation =
      options.allowPendingReviewAutomation &&
      action === 'delete' &&
      isAutomaticDeleteCandidate(scanResult);

    if (scanResult.reviewStatus !== 'reviewed' && !allowPendingReviewAutomation) {
      scanResult.actionStatus = 'failed';
      scanResult.actionError =
        'Automation blocked because this file has not been reviewed in the UI.';
      scanResult.updated = new Date();
      await scanResult.save();

      return {
        fileId: scanResult._id,
        action,
        status: 'failed',
        reason: scanResult.actionError,
      };
    }

    if (allowPendingReviewAutomation && scanResult.reviewStatus !== 'reviewed') {
      scanResult.reviewStatus = 'reviewed';
      scanResult.reviewedAt = new Date();
    }

    if (action === 'ignore') {
      scanResult.actionStatus = 'ignored';
      scanResult.actionTaken = 'ignore';
      scanResult.actionReason = reason;
      scanResult.updated = new Date();
      await scanResult.save();

      const log = await MaintenanceLog.create({
        server: scanResult.server,
        scanResult: scanResult._id,
        action: 'ignore',
        status: 'success',
        reason,
        aiDecisionTrace: decisionTrace,
        metadata: {
          path: scanResult.path,
          sizeMb: scanResult.sizeMb,
          extension: scanResult.fileName.split('.').pop(),
        },
        created: new Date(),
      });

      await ragMemoryService.rememberAction({
        id: String(log._id),
        scanResult,
        action,
        reason,
        status: 'success',
      });

      socketService.emitToServer(String(scanResult.server), 'action:completed', {
        fileId: scanResult._id,
        action,
        status: 'success',
      });

      return { fileId: scanResult._id, action, status: 'success', reason };
    }

    const server = await ServerConnection.findById(scanResult.server);
    if (!server) {
      throw new Error('Server not found for execution.');
    }

    scanResult.actionStatus = 'queued';
    scanResult.actionTaken = action;
    scanResult.actionReason = reason;
    scanResult.updated = new Date();
    await scanResult.save();

    let execution: ExecutionCommand | undefined;

    try {
      if (action === 'delete') {
        const config = await assertSafeToDelete(scanResult);
        const archiveExecution = buildArchiveCommand(
          scanResult.path,
          options.backupDirectoryOverride || config.archiveDirectory,
        );
        const archiveResult = await sshService.execute(server, archiveExecution.command, 60000);
        if (archiveResult.code !== 0) {
          throw new Error(archiveResult.stderr || `Archive verification failed with ${archiveResult.code}`);
        }
        archiveExecution.archiveVerified = true;

        const auditLog = await MaintenanceLog.create({
          server: scanResult.server,
          scanResult: scanResult._id,
          action: 'delete',
          status: 'preview',
          reason: 'Delete audit prepared after archive verification and before file deletion.',
          aiDecisionTrace: [
            ...decisionTrace,
            'Delete flow verified the file is not active before archive/delete execution.',
            'Archive was created and verified before delete execution.',
            'Audit was written before delete execution.',
          ],
          metadata: {
            path: scanResult.path,
            sizeMb: scanResult.sizeMb,
            extension: scanResult.fileName.split('.').pop(),
            archiveCommand: archiveExecution.command,
            archiveDestination: archiveExecution.archiveDestination,
            archiveVerified: true,
            auditVerified: false,
            deleteVerified: false,
            sourceRetained: true,
          },
          created: new Date(),
        });
        const persistedAudit = await MaintenanceLog.findById(auditLog._id).select('_id').lean();
        if (!persistedAudit) {
          throw new Error('Delete blocked because pre-delete audit verification failed.');
        }

        const deleteCommand = buildDeleteCommand(scanResult.path);
        execution = {
          command: deleteCommand,
          archiveDestination: archiveExecution.archiveDestination,
          archiveVerified: true,
          auditLogId: String(auditLog._id),
        };
        await MaintenanceLog.findByIdAndUpdate(auditLog._id, {
          $set: {
            'metadata.auditVerified': true,
          },
        });

        const deleteResult = await sshService.execute(server, deleteCommand, 60000);
        if (deleteResult.code !== 0) {
          throw new Error(deleteResult.stderr || `Delete verification failed with ${deleteResult.code}`);
        }
        execution.deleteVerified = true;

        scanResult.actionStatus = 'completed';
        scanResult.actionError = undefined;
        scanResult.updated = new Date();
        await scanResult.save();

        const deletedAt = new Date();
        await DeletedFile.create({
          server: scanResult.server,
          scanResult: scanResult._id,
          scanId: scanResult.scanId,
          fileName: scanResult.fileName,
          path: scanResult.path,
          size: scanResult.size,
          sizeMb: scanResult.sizeMb,
          category: scanResult.category,
          tags: scanResult.tags,
          lastAccessed: scanResult.lastAccessed,
          modifiedAt: scanResult.modifiedAt,
          reason,
          aiDecisionTrace: decisionTrace,
          command: deleteCommand,
          triggeredBy: options.triggeredBy || 'agent',
          deletedAt,
          created: deletedAt,
        });

        await MaintenanceLog.findByIdAndUpdate(auditLog._id, {
          $set: {
            status: 'success',
            reason,
            'metadata.deleteCommand': deleteCommand,
            'metadata.deleteVerified': true,
            'metadata.sourceRetained': false,
            'metadata.deletedAt': deletedAt,
          },
        });

        await ragMemoryService.rememberAction({
          id: String(auditLog._id),
          scanResult,
          action,
          reason,
          status: 'success',
        });

        socketService.emitToServer(String(scanResult.server), 'action:completed', {
          fileId: scanResult._id,
          action,
          status: 'success',
        });

        return {
          fileId: scanResult._id,
          action,
          status: 'success',
          reason,
          backupPath: execution.archiveDestination,
          archiveDestination: execution.archiveDestination,
          archiveVerified: execution.archiveVerified,
          auditVerified: true,
          deleteVerified: execution.deleteVerified,
        };
      }

      execution = await buildCommand(scanResult, action);
      const result = await sshService.execute(server, execution.command, 60000);
      if (result.code !== 0) {
        throw new Error(result.stderr || `Remote command exited with ${result.code}`);
      }
      if (action === 'archive') {
        execution.archiveVerified = true;
      }

      scanResult.actionStatus = 'completed';
      scanResult.actionError = undefined;
      scanResult.updated = new Date();
      await scanResult.save();

      const log = await MaintenanceLog.create({
        server: scanResult.server,
        scanResult: scanResult._id,
        action,
        status: 'success',
        reason,
        aiDecisionTrace: decisionTrace,
        metadata: {
          path: scanResult.path,
          sizeMb: scanResult.sizeMb,
          extension: scanResult.fileName.split('.').pop(),
          command: execution.command,
          archiveDestination: execution.archiveDestination,
          archiveVerified: execution.archiveVerified,
          sourceRetained: action === 'archive' ? true : undefined,
        },
        created: new Date(),
      });

      await ragMemoryService.rememberAction({
        id: String(log._id),
        scanResult,
        action,
        reason,
        status: 'success',
      });

      socketService.emitToServer(String(scanResult.server), 'action:completed', {
        fileId: scanResult._id,
        action,
        status: 'success',
      });

      return {
        fileId: scanResult._id,
        action,
        status: 'success',
        reason,
        archiveDestination: execution.archiveDestination,
        archiveVerified: execution.archiveVerified,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Execution failed.';
      scanResult.actionStatus = 'failed';
      scanResult.actionError = message;
      scanResult.updated = new Date();
      await scanResult.save();

      if (execution?.auditLogId) {
        await MaintenanceLog.findByIdAndUpdate(execution.auditLogId, {
          $set: {
            status: 'failed',
            reason: message,
            'metadata.deleteVerified': execution.deleteVerified ?? false,
            'metadata.archiveVerified': execution.archiveVerified ?? false,
            'metadata.sourceRetained': true,
          },
        });
      }

      await MaintenanceLog.create({
        server: scanResult.server,
        scanResult: scanResult._id,
        action,
        status: 'failed',
        reason: message,
        aiDecisionTrace: decisionTrace,
        metadata: {
          path: scanResult.path,
          sizeMb: scanResult.sizeMb,
          command: execution?.command,
          archiveDestination: execution?.archiveDestination,
          archiveVerified: false,
          sourceRetained: action === 'archive' ? true : undefined,
        },
        created: new Date(),
      });

      socketService.emitToServer(String(scanResult.server), 'action:failed', {
        fileId: scanResult._id,
        action,
        status: 'failed',
        reason: message,
      });

      return { fileId: scanResult._id, action, status: 'failed', reason: message };
    }
  },

  async executeManualAction(
    serverId: string,
    fileIds: string[],
    action: FileAction,
    reason?: string,
  ) {
    const results = await Promise.all(
      fileIds.map(async (fileId) => {
        const scanResult = await ScanResult.findOne({
          _id: new Types.ObjectId(fileId),
          server: new Types.ObjectId(serverId),
        });
        if (!scanResult) {
          return {
            fileId,
            action,
            status: 'failed',
            reason: 'File result not found.',
          };
        }

        scanResult.reviewStatus = 'reviewed';
        scanResult.reviewedAt = new Date();
        scanResult.updated = new Date();

        return this.executeScanResult(
          scanResult,
          action,
          reason || `Manual ${action} action from dashboard.`,
          [
            'Manual override selected by user from dashboard.',
            'Manual action is allowed before automation because the user selected the file explicitly.',
          ],
          { triggeredBy: 'manual' },
        );
      }),
    );

    await alertService.create({
      serverId,
      type: 'manual_action',
      severity: 'info',
      title: 'Manual maintenance action completed',
      message: `${results.length} files processed with ${action}.`,
      metadata: {
        action,
        fileIds,
        results,
      },
      email: false,
    });

    return results;
  },
};
