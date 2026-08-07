import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IFinancialEvent extends BaseDocument {
  financialEventId: ObjectIdType;
  parentFinancialEventId?: ObjectIdType;
  reversalOfId?: ObjectIdType;
  claimId?: ObjectIdType;
  paymentPostingId?: ObjectIdType;
  eraEobProcessingId?: ObjectIdType;
  adjustmentId?: ObjectIdType;
  denialId?: ObjectIdType;
  appealId?: ObjectIdType;
  correctedClaimId?: ObjectIdType;
  refundId?: ObjectIdType;
  patientBillingId?: ObjectIdType;
  eventType: string;
  sourceModule?: string;
  amount?: number;
  ledgerSequence: number;
  ledgerHash?: string;
  previousLedgerHash?: string;
  accountingPeriod?: string;
  accountingLocked?: boolean;
  reconciliationStatus?: string;
  financialBalanceSnapshot?: Record<string, unknown>;
  reason?: string;
  metadata?: Record<string, unknown>;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType | string;
  updatedBy?: ObjectIdType | string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IFinancialEventModel extends Model<IFinancialEvent> {
  list(criteria: any): Promise<IFinancialEvent[]>;
  totalCount(criteria: any): Promise<number>;
}

const financialEventSchema = new Schema<IFinancialEvent, IFinancialEventModel>(
  {
    financialEventId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    parentFinancialEventId: { type: Schema.Types.ObjectId, ref: 'FinancialEvent' },
    reversalOfId: { type: Schema.Types.ObjectId, ref: 'FinancialEvent' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', index: true },
    paymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting', index: true },
    eraEobProcessingId: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing' },
    adjustmentId: { type: Schema.Types.ObjectId, ref: 'Adjustment' },
    denialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    appealId: { type: Schema.Types.ObjectId, ref: 'Appeal' },
    correctedClaimId: { type: Schema.Types.ObjectId, ref: 'CorrectedClaim' },
    refundId: { type: Schema.Types.ObjectId, ref: 'Refund' },
    patientBillingId: { type: Schema.Types.ObjectId, ref: 'PatientBilling' },
    eventType: { type: String, trim: true, required: true, index: true },
    sourceModule: { type: String, trim: true },
    amount: { type: Number },
    ledgerSequence: { type: Number, required: true, index: true },
    ledgerHash: { type: String, trim: true },
    previousLedgerHash: { type: String, trim: true },
    accountingPeriod: { type: String, trim: true, index: true },
    accountingLocked: { type: Boolean, default: false },
    reconciliationStatus: { type: String, trim: true },
    financialBalanceSnapshot: { type: Schema.Types.Mixed },
    reason: { type: String, trim: true },
    metadata: { type: Schema.Types.Mixed },
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

financialEventSchema.virtual('createdAt').get(function () {
  return this.created;
});

financialEventSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

financialEventSchema.index({ isDeleted: 1, updated: -1 });
financialEventSchema.index({ claimId: 1, ledgerSequence: 1 }, { unique: true, sparse: true });
financialEventSchema.index({ reversalOfId: 1 }, { sparse: true });
financialEventSchema.index({ claimId: 1, ledgerHash: 1 }, { sparse: true });

financialEventSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

financialEventSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const FinancialEvent = model<IFinancialEvent, IFinancialEventModel>('FinancialEvent', financialEventSchema);
