import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type ClearinghouseEventType = 'ACK_999' | 'ACK_277CA' | 'ERA_835' | 'CLAIM_STATUS' | 'UNKNOWN';
export type ClearinghouseEventStatus = 'RECEIVED' | 'QUEUED' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'DUPLICATE' | 'DEAD_LETTER';

export interface IClearinghouseEvent extends BaseDocument {
  eventId: ObjectIdType;
  eventType: ClearinghouseEventType;
  status: ClearinghouseEventStatus;
  idempotencyKey: string;
  replayKey?: string;
  vendorName?: string;
  source?: string;
  signatureVerified?: boolean;
  receivedAt: Date;
  processedAt?: Date;
  rawPayloadRedacted?: string;
  payload?: Record<string, unknown>;
  rawPayloadStored?: boolean;
  rawPayload?: string;
  submissionTraceId?: string;
  claimControlNumber?: string;
  externalSubmissionId?: string;
  payerClaimNumber?: string;
  errorMessage?: string;
  retryCount?: number;
  lastRetryAt?: Date;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType | string;
  updatedBy?: ObjectIdType | string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClearinghouseEventModel extends Model<IClearinghouseEvent> {
  list(criteria: any): Promise<IClearinghouseEvent[]>;
  totalCount(criteria: any): Promise<number>;
}

const clearinghouseEventSchema = new Schema<IClearinghouseEvent, IClearinghouseEventModel>(
  {
    eventId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    eventType: {
      type: String,
      enum: ['ACK_999', 'ACK_277CA', 'ERA_835', 'CLAIM_STATUS', 'UNKNOWN'],
      default: 'UNKNOWN',
      index: true,
      immutable: true,
    },
    status: {
      type: String,
      enum: ['RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED', 'DUPLICATE', 'DEAD_LETTER'],
      default: 'RECEIVED',
      index: true,
    },
    idempotencyKey: { type: String, required: true, trim: true, unique: true, immutable: true },
    replayKey: { type: String, trim: true, index: true, immutable: true },
    vendorName: { type: String, trim: true, default: 'stedi' },
    source: { type: String, trim: true },
    signatureVerified: { type: Boolean, default: false },
    receivedAt: { type: Date, default: Date.now, index: true, immutable: true },
    processedAt: { type: Date },
    rawPayloadRedacted: { type: String },
    payload: { type: Schema.Types.Mixed },
    rawPayloadStored: { type: Boolean, default: false },
    rawPayload: { type: String },
    submissionTraceId: { type: String, trim: true, index: true },
    claimControlNumber: { type: String, trim: true, index: true },
    externalSubmissionId: { type: String, trim: true, index: true },
    payerClaimNumber: { type: String, trim: true, index: true },
    errorMessage: { type: String, trim: true },
    retryCount: { type: Number, default: 0 },
    lastRetryAt: { type: Date },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

clearinghouseEventSchema.virtual('createdAt').get(function () {
  return this.created;
});

clearinghouseEventSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

clearinghouseEventSchema.index({ isDeleted: 1, updated: -1 });
clearinghouseEventSchema.index({ eventType: 1, status: 1, receivedAt: -1 });
clearinghouseEventSchema.index({ claimControlNumber: 1, receivedAt: -1 });

clearinghouseEventSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

clearinghouseEventSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClearinghouseEvent = model<IClearinghouseEvent, IClearinghouseEventModel>('ClearinghouseEvent', clearinghouseEventSchema);
