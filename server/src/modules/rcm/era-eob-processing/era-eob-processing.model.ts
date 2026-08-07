import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IEraEobProcessing extends BaseDocument {
  eraId: ObjectIdType;
  payerId?: string;
  payerName?: string;
  paymentId?: ObjectIdType;
  eraReceived?: boolean;
  eraFileReference?: string;
  eraBatchId?: string;
  depositId?: string;
  raw835FileReference?: string;
  rawPayloadRedacted?: string;
  raw835Payload?: string;
  rawPayloadStored?: boolean;
  idempotencyKey?: string;
  sourceType?: string;
  checkNumber?: string;
  paymentTraceNumber?: string;
  paymentMethod?: string;
  paymentDate?: Date;
  totalAmount?: number;
  totalPaymentAmount?: number;
  depositAmount?: number;
  postedAmount?: number;
  claimPaidAmount?: number;
  serviceLinePaidAmount?: number;
  adjustmentTotal?: number;
  patientResponsibilityTotal?: number;
  unmatchedAmount?: number;
  reconciliationStatus?: 'RECEIVED' | 'PARSED' | 'POSTED' | 'PARTIALLY_POSTED' | 'RECONCILED' | 'EXCEPTION';
  accountingLocked?: boolean;
  accountingLockedAt?: Date;
  accountingLockedBy?: ObjectIdType | string;
  accountingLockReason?: string;
  accountingUnlockedAt?: Date;
  accountingUnlockedBy?: ObjectIdType | string;
  accountingUnlockReason?: string;
  replayVersion?: number;
  replayStatus?: string;
  replayHistory?: Array<Record<string, unknown>>;
  exceptionReason?: string;
  receivedDate?: Date;
  importStatus?: string;
  parsedStatus?: string;
  fileMetadata?: Record<string, unknown>;
  matchedClaims?: Array<Record<string, unknown>>;
  unmatchedClaims?: Array<Record<string, unknown>>;
  parseErrors?: string[];
  importErrors?: string[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IEraEobProcessingModel extends Model<IEraEobProcessing> {
  list(criteria: any): Promise<IEraEobProcessing[]>;
  totalCount(criteria: any): Promise<number>;
}

const eraEobProcessingSchema = new Schema<IEraEobProcessing, IEraEobProcessingModel>(
  {
    eraId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    payerId: { type: String, trim: true },
    payerName: { type: String, trim: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    eraReceived: { type: Boolean, default: false },
    eraFileReference: { type: String, trim: true },
    eraBatchId: { type: String, trim: true, index: true },
    depositId: { type: String, trim: true, index: true },
    raw835FileReference: { type: String, trim: true },
    rawPayloadRedacted: { type: String },
    raw835Payload: { type: String },
    rawPayloadStored: { type: Boolean, default: false },
    idempotencyKey: { type: String, trim: true },
    sourceType: { type: String, trim: true, default: 'MANUAL_IMPORT', index: true },
    checkNumber: { type: String, trim: true },
    paymentTraceNumber: { type: String, trim: true },
    paymentMethod: { type: String, trim: true },
    paymentDate: { type: Date },
    totalAmount: { type: Number },
    totalPaymentAmount: { type: Number },
    depositAmount: { type: Number },
    postedAmount: { type: Number },
    claimPaidAmount: { type: Number },
    serviceLinePaidAmount: { type: Number },
    adjustmentTotal: { type: Number },
    patientResponsibilityTotal: { type: Number },
    unmatchedAmount: { type: Number },
    reconciliationStatus: {
      type: String,
      enum: ['RECEIVED', 'PARSED', 'POSTED', 'PARTIALLY_POSTED', 'RECONCILED', 'EXCEPTION'],
      default: 'RECEIVED',
      index: true,
    },
    accountingLocked: { type: Boolean, default: false },
    accountingLockedAt: { type: Date },
    accountingLockedBy: { type: Schema.Types.Mixed },
    accountingLockReason: { type: String, trim: true },
    accountingUnlockedAt: { type: Date },
    accountingUnlockedBy: { type: Schema.Types.Mixed },
    accountingUnlockReason: { type: String, trim: true },
    replayVersion: { type: Number, default: 0 },
    replayStatus: { type: String, trim: true },
    replayHistory: { type: [Schema.Types.Mixed], default: [] },
    exceptionReason: { type: String, trim: true },
    receivedDate: { type: Date },
    importStatus: { type: String, trim: true, default: 'RECEIVED', index: true },
    parsedStatus: { type: String, trim: true },
    fileMetadata: { type: Schema.Types.Mixed },
    matchedClaims: { type: [Schema.Types.Mixed], default: [] },
    unmatchedClaims: { type: [Schema.Types.Mixed], default: [] },
    parseErrors: { type: [String], default: [] },
    importErrors: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

eraEobProcessingSchema.virtual('createdAt').get(function () {
  return this.created;
});

eraEobProcessingSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

eraEobProcessingSchema.index({ isDeleted: 1, updated: -1 });
eraEobProcessingSchema.index({ checkNumber: 1 });
eraEobProcessingSchema.index({ paymentTraceNumber: 1 });
eraEobProcessingSchema.index({ payerId: 1, paymentTraceNumber: 1 }, { sparse: true });
eraEobProcessingSchema.index({ payerId: 1, checkNumber: 1 }, { sparse: true });
eraEobProcessingSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
eraEobProcessingSchema.index({ receivedDate: 1 });

eraEobProcessingSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

eraEobProcessingSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const EraEobProcessing = model<IEraEobProcessing, IEraEobProcessingModel>('EraEobProcessing', eraEobProcessingSchema);
