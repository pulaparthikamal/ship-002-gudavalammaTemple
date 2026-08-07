import { Schema, Types, model } from 'mongoose';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

export interface IDeploymentLog {
  deploymentId: Types.ObjectId;
  stepName?: string;
  level: LogLevel;
  message: string;
  timestamp: Date;
}

const deploymentLogSchema = new Schema<IDeploymentLog>(
  {
    deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true, index: true },
    stepName: { type: String },
    level: { type: String, enum: ['info', 'warn', 'error', 'debug'], default: 'info' },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'deployment_logs',
  }
);

deploymentLogSchema.index({ deploymentId: 1, timestamp: 1 });

export const DeploymentLog = model<IDeploymentLog>('DeploymentLog', deploymentLogSchema);
