import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import { FileAction } from './scanResult.model';

export interface IMaintenanceLog extends BaseDocument {
  server: Types.ObjectId;
  scanResult?: Types.ObjectId;
  action: FileAction | 'scan' | 'monitor' | 'alert' | 'decision';
  status: 'success' | 'failed' | 'skipped' | 'preview';
  reason: string;
  aiDecisionTrace: string[];
  metadata: Record<string, unknown>;
  created: Date;
}

const maintenanceLogSchema = new Schema<IMaintenanceLog>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    scanResult: { type: Schema.Types.ObjectId, ref: 'ScanResult' },
    action: {
      type: String,
      enum: ['delete', 'archive', 'ignore', 'review', 'scan', 'monitor', 'alert', 'decision'],
      required: true,
      index: true,
    },
    status: { type: String, enum: ['success', 'failed', 'skipped', 'preview'], required: true, index: true },
    reason: { type: String, required: true },
    aiDecisionTrace: { type: [String], default: [] },
    metadata: { type: Schema.Types.Mixed, default: {} },
    created: { type: Date, default: Date.now, index: true },
  },
  {
    timestamps: false,
    collection: 'logs',
  }
);

maintenanceLogSchema.index({ server: 1, created: -1 });
// Optimises actionsTaken aggregation: filter by server+action+status+created
maintenanceLogSchema.index({ server: 1, action: 1, status: 1, created: -1 });

export const MaintenanceLog = model<IMaintenanceLog>('MaintenanceLog', maintenanceLogSchema);
