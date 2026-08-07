import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export type AlertType =
  | 'threshold_breach'
  | 'scan_completed'
  | 'scan_analysis_completed'
  | 'manual_action'
  | 'agent_decision'
  | 'critical_issue'
  | 'critical_log'
  | 'security_log'
  | 'repeated_error_log'
  | 'service_crash_pattern'
  | 'server_shutdown'
  | 'file_threat_detected'
  | 'remediation_completed'
  | 'remediation_failed'
  | 'ssh_login_failure';
export type AlertSeverity = 'info' | 'warning' | 'critical' | 'success';

export interface IAlert extends BaseDocument {
  server: Types.ObjectId;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata: Record<string, unknown>;
  read: boolean;
  emailedAt?: Date;
  created: Date;
}

const alertSchema = new Schema<IAlert>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    type: {
      type: String,
      enum: [
        'threshold_breach',
        'scan_completed',
        'scan_analysis_completed',
        'manual_action',
        'agent_decision',
        'critical_issue',
        'critical_log',
        'security_log',
        'repeated_error_log',
        'service_crash_pattern',
        'server_shutdown',
        'file_threat_detected',
        'remediation_completed',
        'remediation_failed',
        'ssh_login_failure',
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['info', 'warning', 'critical', 'success'], required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    read: { type: Boolean, default: false, index: true },
    emailedAt: { type: Date },
    created: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    collection: 'alerts',
  }
);

alertSchema.index({ server: 1, created: -1 });

export const Alert = model<IAlert>('Alert', alertSchema);
