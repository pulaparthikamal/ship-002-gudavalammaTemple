import { Schema, Types, model } from 'mongoose';

export interface IDeploymentEmailLog {
  deploymentId: Types.ObjectId;
  eventType: 'deployment_started' | 'deployment_success' | 'deployment_failed' | 'deployment_rollback';
  recipient: string;
  subject: string;
  status: 'success' | 'failed';
  sentAt: Date;
  errorMessage?: string;
}

const deploymentEmailLogSchema = new Schema<IDeploymentEmailLog>(
  {
    deploymentId: { type: Schema.Types.ObjectId, ref: 'Deployment', required: true, index: true },
    eventType: {
      type: String,
      enum: ['deployment_started', 'deployment_success', 'deployment_failed', 'deployment_rollback'],
      required: true
    },
    recipient: { type: String, required: true },
    subject: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    sentAt: { type: Date, default: Date.now },
    errorMessage: { type: String },
  },
  {
    timestamps: false,
    collection: 'deployment_email_logs',
  }
);

deploymentEmailLogSchema.index({ deploymentId: 1, eventType: 1 });

export const DeploymentEmailLog = model<IDeploymentEmailLog>('DeploymentEmailLog', deploymentEmailLogSchema);
