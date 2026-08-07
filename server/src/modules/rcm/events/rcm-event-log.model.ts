import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../../types/common.types';
import type { RcmRealtimeEvent } from './rcm-event-stream.service';

export interface IRcmEventLog extends BaseDocument {
  sequence: number;
  eventType: string;
  payload: RcmRealtimeEvent & { sequence: number; createdAt: string };
  claimId?: string;
  entityType?: string;
  entityId?: string;
  created: Date;
  updated: Date;
  active: boolean;
  isDeleted: boolean;
}

export interface IRcmEventLogModel extends Model<IRcmEventLog> {}

const rcmEventLogSchema = new Schema<IRcmEventLog, IRcmEventLogModel>(
  {
    sequence: { type: Number, required: true, unique: true, index: true },
    eventType: { type: String, trim: true, required: true, index: true },
    payload: { type: Schema.Types.Mixed, required: true },
    claimId: { type: String, trim: true, index: true },
    entityType: { type: String, trim: true, index: true },
    entityId: { type: String, trim: true, index: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: false }
);

rcmEventLogSchema.index({ isDeleted: 1, sequence: -1 });

export const RcmEventLog = model<IRcmEventLog, IRcmEventLogModel>('RcmEventLog', rcmEventLogSchema);
