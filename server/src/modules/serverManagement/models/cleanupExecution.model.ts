import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import { FileCategory } from './scanResult.model';

export type CleanupSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SECURITY';
export type CleanupRecommendationAction = 'archive' | 'delete' | 'keep' | 'protected';
export type CleanupExecutionStatus = 'pending' | 'success' | 'failed' | 'skipped';

export interface ICleanupRecommendationRecord {
  scanResultId: Types.ObjectId;
  filePath: string;
  fileName: string;
  directory: string;
  size: number;
  sizeMb: number;
  category: FileCategory;
  tags: FileCategory[];
  severity: CleanupSeverity;
  recommendedAction: CleanupRecommendationAction;
  reason: string;
  confidence: number;
  decisionTrace: string[];
  executionStatus: CleanupExecutionStatus;
  executionReason?: string;
  backupPath?: string;
}

export interface ICleanupSummary {
  scannedFiles: number;
  severityCounts: Record<CleanupSeverity, number>;
  actionCounts: Record<CleanupRecommendationAction, number>;
  totalScannedSizeBytes: number;
  expectedReclaimableSizeBytes: number;
  scanDurationMs: number;
}

export interface ICleanupExecutionSummary {
  deletedFiles: number;
  archivedFiles: number;
  backedUpFiles: number;
  skippedFiles: number;
  failedFiles: number;
  reclaimedBytes: number;
  executionDurationMs: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface ICleanupExecution extends BaseDocument {
  server: Types.ObjectId;
  scanId: string;
  status: 'preview_ready' | 'executing' | 'completed' | 'failed';
  triggeredBy: 'manual' | 'scheduled';
  recommendations: ICleanupRecommendationRecord[];
  previewSummary: ICleanupSummary;
  executionSummary?: ICleanupExecutionSummary;
  startedAt: Date;
  completedAt?: Date;
  created: Date;
  updated: Date;
}

const recommendationSchema = new Schema<ICleanupRecommendationRecord>(
  {
    scanResultId: { type: Schema.Types.ObjectId, ref: 'ScanResult', required: true },
    filePath: { type: String, required: true },
    fileName: { type: String, required: true },
    directory: { type: String, required: true },
    size: { type: Number, required: true },
    sizeMb: { type: Number, required: true },
    category: { type: String, required: true },
    tags: { type: [String], default: [] },
    severity: { type: String, enum: ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'], required: true },
    recommendedAction: { type: String, enum: ['archive', 'delete', 'keep', 'protected'], required: true },
    reason: { type: String, required: true },
    confidence: { type: Number, required: true },
    decisionTrace: { type: [String], default: [] },
    executionStatus: { type: String, enum: ['pending', 'success', 'failed', 'skipped'], default: 'pending' },
    executionReason: { type: String },
    backupPath: { type: String },
  },
  { _id: false },
);

const cleanupExecutionSchema = new Schema<ICleanupExecution>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    scanId: { type: String, required: true, index: true },
    status: { type: String, enum: ['preview_ready', 'executing', 'completed', 'failed'], required: true },
    triggeredBy: { type: String, enum: ['manual', 'scheduled'], default: 'manual' },
    recommendations: { type: [recommendationSchema], default: [] },
    previewSummary: { type: Schema.Types.Mixed, required: true },
    executionSummary: { type: Schema.Types.Mixed },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'cleanupExecutions',
  },
);

export const CleanupExecution = model<ICleanupExecution>('CleanupExecution', cleanupExecutionSchema);
