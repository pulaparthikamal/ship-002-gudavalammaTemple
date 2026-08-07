import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IDeploymentAuditLog extends BaseDocument {
  timestamp: Date;
  userId?: Types.ObjectId;
  userName: string;
  applicationId?: Types.ObjectId;
  appName?: string;
  targetId?: Types.ObjectId;
  targetName?: string;
  environment?: string;
  action: string;
  result: 'success' | 'failed' | 'skipped' | 'info';
  details?: string;
}

const deploymentAuditLogSchema = new Schema<IDeploymentAuditLog>(
  {
    timestamp: { type: Date, default: Date.now, required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userName: { type: String, required: true },
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application' },
    appName: { type: String },
    targetId: { type: Schema.Types.ObjectId, ref: 'DeploymentTarget' },
    targetName: { type: String },
    environment: { type: String },
    action: { type: String, required: true },
    result: { type: String, enum: ['success', 'failed', 'skipped', 'info'], required: true },
    details: { type: String },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Indexes for pagination and filtering
deploymentAuditLogSchema.index({ userId: 1, timestamp: -1 });
deploymentAuditLogSchema.index({ applicationId: 1, timestamp: -1 });
deploymentAuditLogSchema.index({ targetId: 1, timestamp: -1 });
deploymentAuditLogSchema.index({ timestamp: -1 });

export const DeploymentAuditLog = model<IDeploymentAuditLog>(
  'DeploymentAuditLog',
  deploymentAuditLogSchema,
  'deployment_audit_logs'
);
