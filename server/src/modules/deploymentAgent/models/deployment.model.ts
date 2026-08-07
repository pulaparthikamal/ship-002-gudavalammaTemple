import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type DeploymentStatus =
  | 'pending'
  | 'running'
  | 'success'
  | 'failed'
  | 'rolling_back'
  | 'rolled_back'
  | 'cancelled';

export type DeploymentTrigger = 'manual' | 'webhook' | 'rollback';

export interface ICommitInfo {
  sha?: string;
  message?: string;
  author?: string;
  ref?: string;
}

export type StepStatus = 'pending' | 'running' | 'success' | 'skipped' | 'failed';

export interface IDeploymentStepResult {
  stepName: string;
  status: StepStatus;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
}

export interface IVersionRecord {
  version: string;
  buildNumber?: string;
  commitHash?: string;
  environment?: string;
  deploymentDate: Date;
  status: string;
  releaseDir?: string;
}

export interface IRollbackRecord {
  sourceVersion?: string;
  targetVersion?: string;
  rollbackReason?: string;
  confidenceScore?: number;
  riskLevel?: string;
  status: 'success' | 'failed';
  triggeredBy?: Types.ObjectId;
  startedAt: Date;
  completedAt?: Date;
  recoveryResult?: string;
}

export interface IDeployment extends BaseDocument {
  applicationId: Types.ObjectId;
  targetId: Types.ObjectId;
  status: DeploymentStatus;
  steps: IDeploymentStepResult[];
  releaseDir?: string;
  previousReleaseDir?: string;
  commitSha?: string;
  branch?: string;
  trigger?: DeploymentTrigger;
  commit?: ICommitInfo;
  deliveryId?: string;
  rolledBack?: boolean;
  triggeredBy?: Types.ObjectId;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
  rollbackReason?: string;
  versionHistory: IVersionRecord[];
  rollbackHistory: IRollbackRecord[];
  active: boolean;
  created: Date;
  updated: Date;
}

const stepResultSchema = new Schema<IDeploymentStepResult>(
  {
    stepName: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'success', 'skipped', 'failed'], default: 'pending' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationMs: { type: Number },
    error: { type: String },
  },
  { _id: false }
);

const commitInfoSchema = new Schema<ICommitInfo>(
  {
    sha: { type: String, trim: true },
    message: { type: String, trim: true },
    author: { type: String, trim: true },
    ref: { type: String, trim: true },
  },
  { _id: false }
);

const versionRecordSchema = new Schema<IVersionRecord>(
  {
    version: { type: String, required: true },
    buildNumber: { type: String },
    commitHash: { type: String },
    environment: { type: String },
    deploymentDate: { type: Date, required: true },
    status: { type: String, required: true },
    releaseDir: { type: String },
  },
  { _id: false },
);

const rollbackRecordSchema = new Schema<IRollbackRecord>(
  {
    sourceVersion: { type: String },
    targetVersion: { type: String },
    rollbackReason: { type: String },
    confidenceScore: { type: Number },
    riskLevel: { type: String },
    status: { type: String, enum: ['success', 'failed'], required: true },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    recoveryResult: { type: String },
  },
  { _id: false },
);

const deploymentSchema = new Schema<IDeployment>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true, index: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'DeploymentTarget', required: true, index: true },
    status: {
      type: String,
      enum: ['pending', 'running', 'success', 'failed', 'rolling_back', 'rolled_back', 'cancelled'],
      default: 'pending',
      index: true,
    },
    steps: { type: [stepResultSchema], default: [] },
    releaseDir: { type: String },
    previousReleaseDir: { type: String },
    commitSha: { type: String, trim: true },
    branch: { type: String, trim: true },
    trigger: { type: String, enum: ['manual', 'webhook', 'rollback'], default: 'manual' },
    commit: { type: commitInfoSchema },
    deliveryId: { type: String, trim: true },
    rolledBack: { type: Boolean, default: false },
    triggeredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    durationMs: { type: Number },
    error: { type: String },
    rollbackReason: { type: String },
    versionHistory: { type: [versionRecordSchema], default: [] },
    rollbackHistory: { type: [rollbackRecordSchema], default: [] },
    active: { type: Boolean, default: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deployments',
  }
);

deploymentSchema.index({ applicationId: 1, status: 1 });
deploymentSchema.index({ applicationId: 1, created: -1 });

export const Deployment = model<IDeployment>('Deployment', deploymentSchema);
