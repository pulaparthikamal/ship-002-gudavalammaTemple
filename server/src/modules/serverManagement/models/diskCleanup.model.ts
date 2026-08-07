import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type DiskCleanupTriggerType = 'DAILY_CRON' | 'STORAGE_SPIKE' | 'MANUAL';
export type DiskCleanupJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED';
export type DiskCleanupFileCategory = 'LOG' | 'TEMP' | 'UNUSED';
export type DiskCleanupDeleteStatus = 'PENDING' | 'DELETED' | 'ARCHIVED' | 'SKIPPED' | 'FAILED' | 'DRY_RUN';

export interface IDiskCleanupPolicy extends BaseDocument {
  serverId: Types.ObjectId;
  enabled: boolean;
  allowlistedPaths: string[];
  logRetentionDays: number;
  tempRetentionDays: number;
  warningThresholdPercent: number;
  criticalThresholdPercent: number;
  emergencyThresholdPercent: number;
  archiveBeforeDelete: boolean;
  dryRun: boolean;
  maxDeleteSizePerRun: number;
  cronEnabled: boolean;
  cronExpression: string;
  lastCronRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiskCleanupJob extends BaseDocument {
  serverId: Types.ObjectId;
  jobId: string;
  triggerType: DiskCleanupTriggerType;
  status: DiskCleanupJobStatus;
  storageBeforeCleanupBytes: number;
  storageAfterCleanupBytes: number;
  storageReducedBytes: number;
  storageReducedMB: number;
  storageReducedGB: number;
  diskUsagePercentBefore: number;
  diskUsagePercentAfter: number;
  diskUsagePercentReduced: number;
  filesScanned: number;
  filesDeleted: number;
  filesSkipped: number;
  failedFiles: number;
  archivedFiles: number;
  bytesFreed: number;
  cleanupStartedAt?: Date;
  cleanupCompletedAt?: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiskCleanupCandidate extends BaseDocument {
  serverId: Types.ObjectId;
  jobId: string;
  filePath: string;
  fileSizeBytes: number;
  modifiedAt: Date;
  fileCategory: DiskCleanupFileCategory;
  isAllowed: boolean;
  skipReason?: string;
  deleteStatus: DiskCleanupDeleteStatus;
  archivePath?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDiskCleanupHistory extends BaseDocument {
  serverId: Types.ObjectId;
  jobId: string;
  filePath: string;
  action: DiskCleanupDeleteStatus;
  fileSizeBytes: number;
  archivePath?: string;
  message?: string;
  createdAt: Date;
}

const policySchema = new Schema<IDiskCleanupPolicy>(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, unique: true, index: true },
    enabled: { type: Boolean, default: true, index: true },
    allowlistedPaths: { type: [String], default: ['/var/log', '/tmp', '/var/tmp'] },
    logRetentionDays: { type: Number, default: 7 },
    tempRetentionDays: { type: Number, default: 3 },
    warningThresholdPercent: { type: Number, default: 75 },
    criticalThresholdPercent: { type: Number, default: 85 },
    emergencyThresholdPercent: { type: Number, default: 90 },
    archiveBeforeDelete: { type: Boolean, default: false },
    dryRun: { type: Boolean, default: true },
    maxDeleteSizePerRun: { type: Number, default: 2 * 1024 * 1024 * 1024 },
    cronEnabled: { type: Boolean, default: true },
    cronExpression: { type: String, default: '0 2 * * *' },
    lastCronRunAt: { type: Date },
  },
  { timestamps: true, collection: 'disk_cleanup_policies' },
);

const jobSchema = new Schema<IDiskCleanupJob>(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    jobId: { type: String, required: true, unique: true, index: true },
    triggerType: { type: String, enum: ['DAILY_CRON', 'STORAGE_SPIKE', 'MANUAL'], required: true, index: true },
    status: { type: String, enum: ['PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL_FAILED', 'FAILED'], default: 'PENDING', index: true },
    storageBeforeCleanupBytes: { type: Number, default: 0 },
    storageAfterCleanupBytes: { type: Number, default: 0 },
    storageReducedBytes: { type: Number, default: 0 },
    storageReducedMB: { type: Number, default: 0 },
    storageReducedGB: { type: Number, default: 0 },
    diskUsagePercentBefore: { type: Number, default: 0 },
    diskUsagePercentAfter: { type: Number, default: 0 },
    diskUsagePercentReduced: { type: Number, default: 0 },
    filesScanned: { type: Number, default: 0 },
    filesDeleted: { type: Number, default: 0 },
    filesSkipped: { type: Number, default: 0 },
    failedFiles: { type: Number, default: 0 },
    archivedFiles: { type: Number, default: 0 },
    bytesFreed: { type: Number, default: 0 },
    cleanupStartedAt: { type: Date },
    cleanupCompletedAt: { type: Date },
    errorMessage: { type: String },
  },
  { timestamps: true, collection: 'disk_cleanup_jobs' },
);

const candidateSchema = new Schema<IDiskCleanupCandidate>(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    jobId: { type: String, required: true, index: true },
    filePath: { type: String, required: true, index: true },
    fileSizeBytes: { type: Number, default: 0 },
    modifiedAt: { type: Date, index: true },
    fileCategory: { type: String, enum: ['LOG', 'TEMP', 'UNUSED'], required: true, index: true },
    isAllowed: { type: Boolean, default: false },
    skipReason: { type: String },
    deleteStatus: { type: String, enum: ['PENDING', 'DELETED', 'ARCHIVED', 'SKIPPED', 'FAILED', 'DRY_RUN'], default: 'PENDING' },
    archivePath: { type: String },
  },
  { timestamps: true, collection: 'disk_cleanup_candidates' },
);

const historySchema = new Schema<IDiskCleanupHistory>(
  {
    serverId: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    jobId: { type: String, required: true, index: true },
    filePath: { type: String, required: true },
    action: { type: String, enum: ['PENDING', 'DELETED', 'ARCHIVED', 'SKIPPED', 'FAILED', 'DRY_RUN'], required: true },
    fileSizeBytes: { type: Number, default: 0 },
    archivePath: { type: String },
    message: { type: String },
    createdAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: false, collection: 'disk_cleanup_history' },
);

jobSchema.index({ serverId: 1, cleanupStartedAt: -1 });
candidateSchema.index({ serverId: 1, jobId: 1 });
historySchema.index({ serverId: 1, createdAt: -1 });

export const DiskCleanupPolicy = model<IDiskCleanupPolicy>('DiskCleanupPolicy', policySchema);
export const DiskCleanupJob = model<IDiskCleanupJob>('DiskCleanupJob', jobSchema);
export const DiskCleanupCandidate = model<IDiskCleanupCandidate>('DiskCleanupCandidate', candidateSchema);
export const DiskCleanupHistory = model<IDiskCleanupHistory>('DiskCleanupHistory', historySchema);
