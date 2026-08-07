import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IPaymentPostingPaymentLine {
  claimLineId?: ObjectIdType;
  serviceLineControlNumber?: string;
  procedureCode?: string;
  serviceDate?: Date;
  billedAmount?: number;
  expectedAllowedAmount?: number;
  expectedInsurancePayment?: number;
  paidAmount?: number;
  allowedAmount?: number;
  adjustmentAmount?: number;
  patientRespAmount?: number;
  deniedAmount?: number;
  adjustmentCodes?: string[];
  remarkCodes?: string[];
  matchingConfidenceScore?: number;
  matchingSignals?: string[];
  requiresManualReview?: boolean;
  matchedDenialIds?: ObjectIdType[];
}

export interface IPaymentPosting extends BaseDocument {
  paymentId: ObjectIdType;
  eraEobProcessingId?: ObjectIdType;
  claimId?: ObjectIdType;
  payerId?: string;
  payerClaimNumber?: string;
  claimControlNumber?: string;
  paymentDate?: Date;
  checkNumber?: string;
  eftTraceNumber?: string;
  paymentMethod?: string;
  idempotencyKey?: string;
  sourceType?: string;
  receivedAmount?: number;
  postedAmount?: number;
  patientResponsibilityAmount?: number;
  remainingBalance?: number;
  postingStatus?: string;
  postedBy?: string;
  postedAt?: Date;
  reversedAt?: Date;
  reversedBy?: ObjectIdType;
  reversalReason?: string;
  financialEventId?: ObjectIdType;
  parentFinancialEventId?: ObjectIdType;
  reversalOfId?: ObjectIdType;
  ledgerSequence?: number;
  financialBalanceSnapshot?: Record<string, unknown>;
  paymentLines: IPaymentPostingPaymentLine[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IPaymentPostingModel extends Model<IPaymentPosting> {
  list(criteria: any): Promise<IPaymentPosting[]>;
  totalCount(criteria: any): Promise<number>;
}

const paymentLinesSchema = new Schema<IPaymentPostingPaymentLine>(
  {
    claimLineId: { type: Schema.Types.ObjectId },
    serviceLineControlNumber: { type: String, trim: true },
    procedureCode: { type: String, trim: true },
    serviceDate: { type: Date },
    billedAmount: { type: Number },
    expectedAllowedAmount: { type: Number },
    expectedInsurancePayment: { type: Number },
    paidAmount: { type: Number },
    allowedAmount: { type: Number },
    adjustmentAmount: { type: Number },
    patientRespAmount: { type: Number },
    deniedAmount: { type: Number },
    adjustmentCodes: { type: [String], default: [] },
    remarkCodes: { type: [String], default: [] },
    matchingConfidenceScore: { type: Number },
    matchingSignals: { type: [String], default: [] },
    requiresManualReview: { type: Boolean, default: false },
    matchedDenialIds: { type: [Schema.Types.ObjectId], ref: 'Denial', default: [] },
  },
  { _id: false }
);

const paymentPostingSchema = new Schema<IPaymentPosting, IPaymentPostingModel>(
  {
    paymentId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    eraEobProcessingId: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    payerId: { type: String, trim: true },
    payerClaimNumber: { type: String, trim: true },
    claimControlNumber: { type: String, trim: true },
    paymentDate: { type: Date },
    checkNumber: { type: String, trim: true },
    eftTraceNumber: { type: String, trim: true },
    paymentMethod: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true },
    sourceType: { type: String, trim: true, default: 'MANUAL' },
    receivedAmount: { type: Number },
    postedAmount: { type: Number },
    patientResponsibilityAmount: { type: Number },
    remainingBalance: { type: Number },
    postingStatus: { type: String, trim: true },
    postedBy: { type: String, trim: true },
    postedAt: { type: Date },
    reversedAt: { type: Date },
    reversedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reversalReason: { type: String, trim: true },
    financialEventId: { type: Schema.Types.ObjectId, ref: 'FinancialEvent' },
    parentFinancialEventId: { type: Schema.Types.ObjectId, ref: 'FinancialEvent' },
    reversalOfId: { type: Schema.Types.ObjectId, ref: 'FinancialEvent' },
    ledgerSequence: { type: Number },
    financialBalanceSnapshot: { type: Schema.Types.Mixed },
    paymentLines: { type: [paymentLinesSchema], default: [] },
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

paymentPostingSchema.virtual('createdAt').get(function () {
  return this.created;
});

paymentPostingSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

paymentPostingSchema.index({ isDeleted: 1, updated: -1 });
paymentPostingSchema.index({ paymentDate: 1 });
paymentPostingSchema.index({ checkNumber: 1 });
paymentPostingSchema.index({ eraEobProcessingId: 1 });
paymentPostingSchema.index({ claimId: 1, postingStatus: 1 });
paymentPostingSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
paymentPostingSchema.index({ payerClaimNumber: 1 });
paymentPostingSchema.index({ claimControlNumber: 1 });
paymentPostingSchema.index({ financialEventId: 1 }, { sparse: true });
paymentPostingSchema.index({ reversalOfId: 1 }, { sparse: true });

paymentPostingSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

paymentPostingSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const PaymentPosting = model<IPaymentPosting, IPaymentPostingModel>('PaymentPosting', paymentPostingSchema);
