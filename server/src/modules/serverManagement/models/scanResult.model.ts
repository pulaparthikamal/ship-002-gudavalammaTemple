import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export const fileCategories = [
  'unused',
  'large',
  'logs',
  'temp',
  'duplicate',
  'system',
  'config',
  'application',
  'crash',
  'service',
  'other',
] as const;

export const scanSeverityLevels = ['low', 'medium', 'high', 'critical'] as const;

export type FileCategory = (typeof fileCategories)[number];
export type ScanSeverity = (typeof scanSeverityLevels)[number];
export type FileAction = 'delete' | 'archive' | 'ignore' | 'review';
export type ReviewStatus = 'pending_review' | 'reviewed';
export type ActionStatus = 'none' | 'queued' | 'completed' | 'failed' | 'ignored';
export type AnalysisStatus = 'pending' | 'completed' | 'failed';

export interface IAiRecommendation {
  action: FileAction;
  confidence: number;
  reason: string;
  decisionTrace: string[];
}

export interface IScanResult extends BaseDocument {
  server: Types.ObjectId;
  scanId: string;
  fileName: string;
  path: string;
  directory: string;
  scanRoot: string;
  size: number;
  sizeMb: number;
  contentHash?: string;
  lastAccessed: Date;
  modifiedAt?: Date;
  category: FileCategory;
  tags: FileCategory[];
  severity: ScanSeverity;
  analysisStatus: AnalysisStatus;
  rootCauseAnalysis?: string;
  impactedServices: string[];
  impactedDirectories: string[];
  remediationSteps: string[];
  devOpsRecommendations: string[];
  aiRecommendation: IAiRecommendation;
  reviewStatus: ReviewStatus;
  reviewedAt?: Date;
  reviewedBy?: Types.ObjectId;
  actionStatus: ActionStatus;
  actionTaken?: FileAction;
  actionReason?: string;
  actionError?: string;
  discoveredAt: Date;
  created: Date;
  updated: Date;
}

const aiRecommendationSchema = new Schema<IAiRecommendation>(
  {
    action: { type: String, enum: ['delete', 'archive', 'ignore', 'review'], required: true },
    confidence: { type: Number, min: 0, max: 1, required: true },
    reason: { type: String, required: true },
    decisionTrace: { type: [String], default: [] },
  },
  { _id: false }
);

const scanResultSchema = new Schema<IScanResult>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    scanId: { type: String, required: true, index: true },
    fileName: { type: String, required: true },
    path: { type: String, required: true },
    directory: { type: String, required: true, index: true },
    scanRoot: { type: String, required: true, index: true },
    size: { type: Number, required: true },
    sizeMb: { type: Number, required: true },
    contentHash: { type: String, index: true },
    lastAccessed: { type: Date, required: true },
    modifiedAt: { type: Date },
    category: { type: String, enum: fileCategories, required: true, index: true },
    tags: { type: [String], enum: fileCategories, default: [] },
    severity: { type: String, enum: scanSeverityLevels, default: 'low', index: true },
    analysisStatus: {
      type: String,
      enum: ['pending', 'completed', 'failed'],
      default: 'pending',
      index: true,
    },
    rootCauseAnalysis: { type: String },
    impactedServices: { type: [String], default: [] },
    impactedDirectories: { type: [String], default: [] },
    remediationSteps: { type: [String], default: [] },
    devOpsRecommendations: { type: [String], default: [] },
    aiRecommendation: { type: aiRecommendationSchema, required: true },
    reviewStatus: { type: String, enum: ['pending_review', 'reviewed'], default: 'pending_review', index: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    actionStatus: {
      type: String,
      enum: ['none', 'queued', 'completed', 'failed', 'ignored'],
      default: 'none',
      index: true,
    },
    actionTaken: { type: String, enum: ['delete', 'archive', 'ignore', 'review'] },
    actionReason: { type: String },
    actionError: { type: String },
    discoveredAt: { type: Date, default: Date.now, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'scanResults',
  }
);

scanResultSchema.index({ server: 1, path: 1, scanId: 1 });
scanResultSchema.index({ server: 1, discoveredAt: -1, category: 1 });
scanResultSchema.index({ server: 1, scanId: 1, discoveredAt: -1 });
scanResultSchema.index({ server: 1, actionStatus: 1, scanId: 1 });
scanResultSchema.index({ server: 1, reviewStatus: 1 });
// Optimises the cleaned-files $facet branch: filter by actionStatus after server+date match
scanResultSchema.index({ server: 1, discoveredAt: -1, actionStatus: 1 });

export const ScanResult = model<IScanResult>('ScanResult', scanResultSchema);
