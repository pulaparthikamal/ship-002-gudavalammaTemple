import { randomUUID } from 'crypto';
import { Types } from 'mongoose';
import { logger } from '../../../../utils/logger.util';
import { ServerConnection } from '../../models/serverConnection.model';
import {
  DiskCleanupCandidate,
  DiskCleanupJob,
  DiskCleanupTriggerType,
  IDiskCleanupPolicy,
} from '../../models/diskCleanup.model';
import { alertService } from '../alert.service';
import { cleanupPolicyService, isPathWithinAllowlist } from './cleanupPolicy.service';
import { diskUsageMonitorService } from './diskUsageMonitor.service';
import { logFileScannerService } from './logFileScanner.service';
import { unusedFileScannerService } from './unusedFileScanner.service';
import { logArchiverService } from './logArchiver.service';
import { safeDeletionService } from './safeDeletion.service';
import { cleanupHistoryService } from './cleanupHistory.service';
import { ProjectLogScope, projectLogScopeService } from './projectLogScope.service';

const roundMb = (bytes: number) => Number((bytes / 1024 / 1024).toFixed(2));
const roundGb = (bytes: number) => Number((bytes / 1024 / 1024 / 1024).toFixed(2));
const storageSpikeCooldownMs = Math.max(
  60000,
  Number(process.env.DISK_CLEANUP_STORAGE_SPIKE_COOLDOWN_MS) || 15 * 60 * 1000,
);
const maxDeleteFilesPerRun = Math.max(
  1,
  Math.min(Number(process.env.DISK_CLEANUP_MAX_DELETE_FILES_PER_RUN) || 50, 1000),
);
const storageSpikeLastRunByServer = new Map<string, number>();

const uniqueCandidates = <T extends { filePath: string }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.filePath)) return false;
    seen.add(item.filePath);
    return true;
  });
};

const candidateId = (candidate: { _id: Types.ObjectId }) => String(candidate._id);
type CleanupRunOptions = { dryRun?: boolean; triggerType?: DiskCleanupTriggerType; domainName?: string };

const buildProjectPolicy = (policy: IDiskCleanupPolicy, scope?: ProjectLogScope) => {
  if (!scope) return policy;
  const basePolicy = typeof (policy as IDiskCleanupPolicy & { toObject?: () => IDiskCleanupPolicy }).toObject === 'function'
    ? (policy as IDiskCleanupPolicy & { toObject: () => IDiskCleanupPolicy }).toObject()
    : policy;
  return {
    ...basePolicy,
    allowlistedPaths: scope.allowlistedPaths,
  } as IDiskCleanupPolicy;
};

export const diskCleanupAgentService = {
  async scan(serverId: string, options: CleanupRunOptions = {}) {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new Error('Server not found.');
    }
    const policy = await cleanupPolicyService.get(serverId);
    const projectScope = options.domainName ? await projectLogScopeService.resolve(server, options.domainName) : undefined;
    const effectivePolicy = buildProjectPolicy(policy, projectScope);
    const diskUsage = await diskUsageMonitorService.getDiskUsage(server);
    const [logs, temp, issues, projectLogFiles] = await Promise.all([
      logFileScannerService.scan(
        server,
        effectivePolicy.allowlistedPaths,
        policy.logRetentionDays,
        projectScope?.nginxLogFiles || [],
      ),
      projectScope ? Promise.resolve([]) : unusedFileScannerService.scan(server, policy.allowlistedPaths, policy.tempRetentionDays),
      projectScope ? projectLogScopeService.scanIssues(server, projectScope) : Promise.resolve([]),
      projectScope ? projectLogScopeService.listLogFiles(server, projectScope) : Promise.resolve([]),
    ]);
    server.lastScanAt = new Date();
    server.updated = new Date();
    await server.save();

    const candidates = uniqueCandidates([...logs, ...temp]).map((candidate) => ({
      ...candidate,
      isAllowed: candidate.isAllowed && isPathWithinAllowlist(candidate.filePath, effectivePolicy.allowlistedPaths),
      deleteStatus: options.dryRun ?? true ? 'DRY_RUN' : 'PENDING',
    }));
    const reclaimableStorageBytes = candidates
      .filter((candidate) => candidate.isAllowed)
      .reduce((sum, candidate) => sum + candidate.fileSizeBytes, 0);

    return {
      serverId,
      triggerType: options.triggerType || 'MANUAL',
      dryRun: options.dryRun ?? true,
      currentDiskUsage: diskUsage,
      reclaimableStorageBytes,
      reclaimableStorageMB: roundMb(reclaimableStorageBytes),
      reclaimableStorageGB: roundGb(reclaimableStorageBytes),
      candidates,
      filesScanned: projectScope ? projectLogFiles.length : candidates.length,
      projectScope,
      issues,
      projectLogFiles,
    };
  },

  async execute(serverId: string, triggerType: DiskCleanupTriggerType = 'MANUAL', overrides: { dryRun?: boolean; domainName?: string } = {}) {
    const server = await ServerConnection.findOne({ _id: serverId, active: true });
    if (!server) {
      throw new Error('Server not found.');
    }
    const policy = await cleanupPolicyService.get(serverId);
    const projectScope = overrides.domainName ? await projectLogScopeService.resolve(server, overrides.domainName) : undefined;
    const effectivePolicy = buildProjectPolicy(policy, projectScope);
    const dryRun = overrides.dryRun ?? policy.dryRun;
    const jobId = randomUUID();
    const startedAt = new Date();
    const before = await diskUsageMonitorService.getDiskUsage(server);
    const job = await DiskCleanupJob.create({
      serverId: server._id,
      jobId,
      triggerType,
      status: 'RUNNING',
      storageBeforeCleanupBytes: before.usedBytes,
      diskUsagePercentBefore: before.usagePercent,
      cleanupStartedAt: startedAt,
    });

    let filesDeleted = 0;
    let filesSkipped = 0;
    let failedFiles = 0;
    let archivedFiles = 0;
    let bytesFreed = 0;
    let selectedBytes = 0;
    let errorMessage = '';

    try {
      const scan = await this.scan(serverId, { dryRun, triggerType, domainName: projectScope?.domainName });
      const candidateDocs = await DiskCleanupCandidate.insertMany(scan.candidates.map((candidate) => ({
        serverId: new Types.ObjectId(serverId),
        jobId,
        filePath: candidate.filePath,
        fileSizeBytes: candidate.fileSizeBytes,
        modifiedAt: candidate.modifiedAt,
        fileCategory: candidate.fileCategory,
        isAllowed: candidate.isAllowed,
        skipReason: candidate.skipReason,
        deleteStatus: candidate.deleteStatus,
      })));

      if (dryRun) {
        filesSkipped = candidateDocs.length;
        await cleanupHistoryService.saveActions(candidateDocs.map((candidate) => ({
          serverId,
          jobId,
          filePath: candidate.filePath,
          action: 'DRY_RUN' as const,
          fileSizeBytes: candidate.fileSizeBytes,
          message: 'Dry run enabled; file was not deleted.',
        })));

        const after = await diskUsageMonitorService.getDiskUsage(server);
        job.set({
          status: 'COMPLETED',
          storageAfterCleanupBytes: after.usedBytes,
          storageReducedBytes: 0,
          storageReducedMB: 0,
          storageReducedGB: 0,
          diskUsagePercentAfter: after.usagePercent,
          diskUsagePercentReduced: Math.max(0, before.usagePercent - after.usagePercent),
          filesScanned: scan.filesScanned,
          filesDeleted,
          filesSkipped,
          failedFiles,
          archivedFiles,
          bytesFreed,
          cleanupCompletedAt: new Date(),
          updatedAt: new Date(),
        });
        await job.save();
        return job.toObject();
      }

      const sortedCandidates = [...candidateDocs].sort((a, b) => b.fileSizeBytes - a.fileSizeBytes);
      const selectedCandidateIds = new Set<string>();
      const selectedCandidates = [];
      const skippedBeforeDelete = [];
      for (const candidate of sortedCandidates) {
        if (!candidate.isAllowed) {
          candidate.deleteStatus = 'SKIPPED';
          candidate.skipReason = candidate.skipReason || 'Candidate is outside allowlist.';
          skippedBeforeDelete.push(candidate);
          continue;
        }

        if (selectedBytes + candidate.fileSizeBytes > policy.maxDeleteSizePerRun) {
          candidate.deleteStatus = 'SKIPPED';
          candidate.skipReason = 'Skipped because maxDeleteSizePerRun would be exceeded.';
          skippedBeforeDelete.push(candidate);
          continue;
        }

        if (selectedCandidates.length >= maxDeleteFilesPerRun) {
          candidate.deleteStatus = 'SKIPPED';
          candidate.skipReason = 'Skipped because max delete files per run would be exceeded.';
          skippedBeforeDelete.push(candidate);
          continue;
        }

        selectedBytes += candidate.fileSizeBytes;
        selectedCandidateIds.add(candidateId(candidate));
        selectedCandidates.push(candidate);
      }

      if (skippedBeforeDelete.length) {
        filesSkipped += skippedBeforeDelete.length;
        await DiskCleanupCandidate.bulkWrite(skippedBeforeDelete.map((candidate) => ({
          updateOne: {
            filter: { _id: candidate._id },
            update: {
              $set: {
                deleteStatus: 'SKIPPED',
                skipReason: candidate.skipReason,
                updatedAt: new Date(),
              },
            },
          },
        })));
        await cleanupHistoryService.saveActions(skippedBeforeDelete.map((candidate) => ({
          serverId,
          jobId,
          filePath: candidate.filePath,
          action: 'SKIPPED' as const,
          fileSizeBytes: candidate.fileSizeBytes,
          message: candidate.skipReason,
        })));
      }

      for (const candidate of selectedCandidates) {
        if (!selectedCandidateIds.has(candidateId(candidate))) {
          continue;
        }

        let archivePath: string | undefined;
        if (policy.archiveBeforeDelete && candidate.fileCategory === 'LOG') {
          try {
            archivePath = await logArchiverService.archive(server, candidate.filePath);
            archivedFiles += 1;
            candidate.archivePath = archivePath;
          } catch (error) {
            failedFiles += 1;
            candidate.deleteStatus = 'FAILED';
            candidate.skipReason = error instanceof Error ? error.message : 'Archive failed.';
            await candidate.save();
            await cleanupHistoryService.saveAction({
              serverId,
              jobId,
              filePath: candidate.filePath,
              action: 'FAILED',
              fileSizeBytes: candidate.fileSizeBytes,
              message: candidate.skipReason,
            });
            continue;
          }
        }

        const deletion = await safeDeletionService.deleteFile(server, candidate.filePath, effectivePolicy.allowlistedPaths, candidate.modifiedAt);
        candidate.deleteStatus = deletion.status;
        candidate.skipReason = deletion.status === 'DELETED' ? undefined : deletion.message;
        await candidate.save();
        if (deletion.status === 'DELETED') {
          filesDeleted += 1;
          bytesFreed += candidate.fileSizeBytes;
        } else if (deletion.status === 'SKIPPED') {
          filesSkipped += 1;
        } else {
          failedFiles += 1;
        }
        await cleanupHistoryService.saveAction({
          serverId,
          jobId,
          filePath: candidate.filePath,
          action: deletion.status,
          fileSizeBytes: candidate.fileSizeBytes,
          archivePath,
          message: deletion.message,
        });
      }

      const after = await diskUsageMonitorService.getDiskUsage(server);
      const storageReducedBytes = Math.max(0, before.usedBytes - after.usedBytes);
      job.set({
        status: failedFiles ? 'PARTIAL_FAILED' : 'COMPLETED',
        storageAfterCleanupBytes: after.usedBytes,
        storageReducedBytes,
        storageReducedMB: roundMb(storageReducedBytes),
        storageReducedGB: roundGb(storageReducedBytes),
        diskUsagePercentAfter: after.usagePercent,
        diskUsagePercentReduced: Math.max(0, before.usagePercent - after.usagePercent),
        filesScanned: scan.filesScanned,
        filesDeleted,
        filesSkipped,
        failedFiles,
        archivedFiles,
        bytesFreed,
        cleanupCompletedAt: new Date(),
        updatedAt: new Date(),
      });
      await job.save();

      if (triggerType === 'STORAGE_SPIKE') {
        await alertService.create({
          serverId,
          type: after.usagePercent >= policy.criticalThresholdPercent ? 'threshold_breach' : 'remediation_completed',
          severity: after.usagePercent >= policy.criticalThresholdPercent ? 'critical' : 'success',
          title: 'Storage spike cleanup executed',
          message: `Disk cleanup reduced usage from ${before.usagePercent}% to ${after.usagePercent}%.`,
          metadata: { jobId, storageReducedBytes, filesDeleted, archivedFiles, resolved: after.usagePercent < policy.criticalThresholdPercent },
          email: false,
        }).catch((alertError) => {
          logger.warn(
            `[DiskCleanup] storage spike alert skipped server=${serverId} job=${jobId}: ${
              alertError instanceof Error ? alertError.message : String(alertError)
            }`,
          );
        });
      }

      return job.toObject();
    } catch (error) {
      errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(`[DiskCleanup] job failed server=${serverId} job=${jobId}: ${errorMessage}`);
      const after = await diskUsageMonitorService.getDiskUsage(server).catch(() => before);
      await DiskCleanupCandidate.updateMany(
        { serverId: new Types.ObjectId(serverId), jobId, deleteStatus: 'PENDING' },
        {
          $set: {
            deleteStatus: 'SKIPPED',
            skipReason: 'Cleanup interrupted before this candidate was processed.',
            updatedAt: new Date(),
          },
        },
      ).catch((candidateError) => {
        logger.warn(
          `[DiskCleanup] pending candidate update skipped server=${serverId} job=${jobId}: ${
            candidateError instanceof Error ? candidateError.message : String(candidateError)
          }`,
        );
      });
      const statusCounts = await DiskCleanupCandidate.aggregate([
        { $match: { serverId: new Types.ObjectId(serverId), jobId } },
        {
          $group: {
            _id: '$deleteStatus',
            count: { $sum: 1 },
            bytes: { $sum: '$fileSizeBytes' },
          },
        },
      ]).catch(() => []);
      const countFor = (status: string) => statusCounts.find((item) => item._id === status)?.count || 0;
      const bytesFor = (status: string) => statusCounts.find((item) => item._id === status)?.bytes || 0;
      filesDeleted = Math.max(filesDeleted, countFor('DELETED'));
      filesSkipped = Math.max(filesSkipped, countFor('SKIPPED') + countFor('DRY_RUN'));
      failedFiles = Math.max(failedFiles, countFor('FAILED'));
      bytesFreed = Math.max(bytesFreed, bytesFor('DELETED'));
      const filesScanned = statusCounts.reduce((sum, item) => sum + (item.count || 0), 0);
      const storageReducedBytes = Math.max(0, before.usedBytes - after.usedBytes);
      job.set({
        status: failedFiles || filesDeleted || filesSkipped ? 'PARTIAL_FAILED' : 'FAILED',
        storageAfterCleanupBytes: after.usedBytes,
        storageReducedBytes,
        storageReducedMB: roundMb(storageReducedBytes),
        storageReducedGB: roundGb(storageReducedBytes),
        diskUsagePercentAfter: after.usagePercent,
        diskUsagePercentReduced: Math.max(0, before.usagePercent - after.usagePercent),
        filesScanned,
        filesDeleted,
        filesSkipped,
        failedFiles,
        archivedFiles,
        bytesFreed,
        errorMessage,
        cleanupCompletedAt: new Date(),
        updatedAt: new Date(),
      });
      await job.save();
      return job.toObject();
    }
  },

  async maybeRunForStorageSpike(serverId: string, usagePercent: number, policy?: IDiskCleanupPolicy) {
    const cleanupPolicy = policy || await cleanupPolicyService.get(serverId);
    if (!cleanupPolicy.enabled || !diskUsageMonitorService.isThresholdCrossed(usagePercent, cleanupPolicy)) {
      return null;
    }
    const lastRunAt = storageSpikeLastRunByServer.get(serverId) || 0;
    if (Date.now() - lastRunAt < storageSpikeCooldownMs) {
      // logger.info(`[DiskCleanup] storage spike cleanup skipped server=${serverId} reason=cooldown`);
      return null;
    }
    storageSpikeLastRunByServer.set(serverId, Date.now());
    return this.execute(serverId, 'STORAGE_SPIKE').finally(() => {
      storageSpikeLastRunByServer.set(serverId, Date.now());
    });
  },
};
