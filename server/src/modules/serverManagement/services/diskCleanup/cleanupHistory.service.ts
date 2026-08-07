import { Types } from 'mongoose';
import {
  DiskCleanupCandidate,
  DiskCleanupDeleteStatus,
  DiskCleanupHistory,
  DiskCleanupJob,
} from '../../models/diskCleanup.model';

export const cleanupHistoryService = {
  async saveAction(input: {
    serverId: string | Types.ObjectId;
    jobId: string;
    filePath: string;
    action: DiskCleanupDeleteStatus;
    fileSizeBytes: number;
    archivePath?: string;
    message?: string;
  }) {
    return DiskCleanupHistory.create({
      serverId: new Types.ObjectId(String(input.serverId)),
      jobId: input.jobId,
      filePath: input.filePath,
      action: input.action,
      fileSizeBytes: input.fileSizeBytes,
      archivePath: input.archivePath,
      message: input.message,
      createdAt: new Date(),
    });
  },

  async saveActions(inputs: Array<{
    serverId: string | Types.ObjectId;
    jobId: string;
    filePath: string;
    action: DiskCleanupDeleteStatus;
    fileSizeBytes: number;
    archivePath?: string;
    message?: string;
  }>) {
    if (!inputs.length) return [];

    return DiskCleanupHistory.insertMany(inputs.map((input) => ({
      serverId: new Types.ObjectId(String(input.serverId)),
      jobId: input.jobId,
      filePath: input.filePath,
      action: input.action,
      fileSizeBytes: input.fileSizeBytes,
      archivePath: input.archivePath,
      message: input.message,
      createdAt: new Date(),
    })), { ordered: false });
  },

  async listHistory(serverId: string, limit = 100) {
    return DiskCleanupHistory.find({ serverId: new Types.ObjectId(serverId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 500))
      .lean();
  },

  async listJobs(serverId: string, limit = 50) {
    return DiskCleanupJob.find({ serverId: new Types.ObjectId(serverId) })
      .sort({ cleanupStartedAt: -1, createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 200))
      .lean();
  },

  async latestSummary(serverId: string) {
    return DiskCleanupJob.findOne({ serverId: new Types.ObjectId(serverId) })
      .sort({ cleanupStartedAt: -1, createdAt: -1 })
      .lean();
  },

  async listCandidates(serverId: string, jobId: string) {
    return DiskCleanupCandidate.find({ serverId: new Types.ObjectId(serverId), jobId }).sort({ fileSizeBytes: -1 }).lean();
  },
};
