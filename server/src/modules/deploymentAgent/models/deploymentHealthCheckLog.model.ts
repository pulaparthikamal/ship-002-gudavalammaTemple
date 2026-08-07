import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface IDeploymentHealthCheckLog extends BaseDocument {
  applicationId: Types.ObjectId;
  componentKey: string;
  targetId: Types.ObjectId;
  url: string;
  status: 'success' | 'failed';
  httpCode?: number;
  responseTimeMs?: number;
  error?: string;
  timestamp: Date;
}

const deploymentHealthCheckLogSchema = new Schema<IDeploymentHealthCheckLog>(
  {
    applicationId: { type: Schema.Types.ObjectId, ref: 'Application', required: true },
    componentKey: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, ref: 'DeploymentTarget', required: true },
    url: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    httpCode: { type: Number },
    responseTimeMs: { type: Number },
    error: { type: String },
    timestamp: { type: Date, default: Date.now, required: true },
  },
  {
    timestamps: false,
    versionKey: false,
  }
);

// Indexes for fast reporting and sorting
deploymentHealthCheckLogSchema.index({ applicationId: 1, targetId: 1, timestamp: -1 });
deploymentHealthCheckLogSchema.index({ timestamp: -1 });

export const DeploymentHealthCheckLog = model<IDeploymentHealthCheckLog>(
  'DeploymentHealthCheckLog',
  deploymentHealthCheckLogSchema,
  'deployment_health_check_logs'
);
