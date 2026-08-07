import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export const ERA_EXCEPTION_TYPES = [
  'UNMATCHED_ERA',
  'DUPLICATE_ERA',
  'CLAIM_NOT_FOUND',
  'SERVICE_LINE_MISMATCH',
  'UNDERPAYMENT_VARIANCE',
  'OVERPAYMENT_VARIANCE',
  'POSTING_IMBALANCE',
  'MISSING_PAYMENT_POSTING',
  'DENIED_SERVICE_LINE',
  'UNRESOLVED_ADJUSTMENT',
  'UNSUPPORTED_FINANCIAL_RECONCILIATION',
  'MANUAL_REVIEW_REQUIRED',
] as const;

export const ERA_EXCEPTION_STATUSES = ['OPEN', 'IN_REVIEW', 'ESCALATED', 'REPROCESSING', 'RESOLVED', 'IGNORED'] as const;

export interface IEraException extends BaseDocument {
  eraExceptionId: ObjectIdType;
  exceptionType: string;
  severity?: string;
  status?: string;
  assignedTo?: string;
  resolutionNotes?: string;
  ignoredReason?: string;
  relatedClaim?: ObjectIdType;
  relatedERA?: ObjectIdType;
  relatedPaymentPosting?: ObjectIdType;
  relatedDenial?: ObjectIdType;
  relatedARWorkItem?: ObjectIdType;
  replayVersion?: number;
  replayStatus?: string;
  replayReason?: string;
  aiAnalysis?: Record<string, unknown>;
  aiRecommendationHistory?: Array<Record<string, unknown>>;
  actionHistory?: Array<Record<string, unknown>>;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType | string;
  updatedBy?: ObjectIdType | string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IEraExceptionModel extends Model<IEraException> {
  list(criteria: any): Promise<IEraException[]>;
  totalCount(criteria: any): Promise<number>;
}

const eraExceptionSchema = new Schema<IEraException, IEraExceptionModel>(
  {
    eraExceptionId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    exceptionType: { type: String, trim: true, enum: ERA_EXCEPTION_TYPES, required: true, index: true },
    severity: { type: String, trim: true, default: 'MEDIUM', index: true },
    status: { type: String, trim: true, enum: ERA_EXCEPTION_STATUSES, default: 'OPEN', index: true },
    assignedTo: { type: String, trim: true },
    resolutionNotes: { type: String, trim: true },
    ignoredReason: { type: String, trim: true },
    relatedClaim: { type: Schema.Types.ObjectId, ref: 'Claim', index: true },
    relatedERA: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing', index: true },
    relatedPaymentPosting: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    relatedDenial: { type: Schema.Types.ObjectId, ref: 'Denial' },
    relatedARWorkItem: { type: Schema.Types.ObjectId, ref: 'ArWorkItem' },
    replayVersion: { type: Number, default: 0 },
    replayStatus: { type: String, trim: true },
    replayReason: { type: String, trim: true },
    aiAnalysis: { type: Schema.Types.Mixed },
    aiRecommendationHistory: { type: [Schema.Types.Mixed], default: [] },
    actionHistory: { type: [Schema.Types.Mixed], default: [] },
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

eraExceptionSchema.virtual('createdAt').get(function () {
  return this.created;
});

eraExceptionSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

eraExceptionSchema.index({ isDeleted: 1, updated: -1 });
eraExceptionSchema.index({ relatedERA: 1, exceptionType: 1, relatedClaim: 1 }, { sparse: true });

eraExceptionSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

eraExceptionSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const EraException = model<IEraException, IEraExceptionModel>('EraException', eraExceptionSchema);
