import { Schema, Types, model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';

export interface ICrashHistory extends BaseDocument {
  server: Types.ObjectId;
  serviceType: 'systemd' | 'pm2' | 'docker' | 'process' | 'job';
  serviceName: string;
  reason: string;
  cpuUsage?: number;
  memoryUsage?: number;
  timestamp: Date;
  created: Date;
}

const crashHistorySchema = new Schema<ICrashHistory>(
  {
    server: { type: Schema.Types.ObjectId, ref: 'ServerConnection', required: true, index: true },
    serviceType: {
      type: String,
      enum: ['systemd', 'pm2', 'docker', 'process', 'job'],
      required: true,
      index: true,
    },
    serviceName: { type: String, required: true, index: true },
    reason: { type: String, required: true },
    cpuUsage: { type: Number },
    memoryUsage: { type: Number },
    timestamp: { type: Date, default: Date.now, index: true },
    created: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'crash_history',
  },
);

crashHistorySchema.index({ server: 1, timestamp: -1 });

export const CrashHistory = model<ICrashHistory>('CrashHistory', crashHistorySchema);
