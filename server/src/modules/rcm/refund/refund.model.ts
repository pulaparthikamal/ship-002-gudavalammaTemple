import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IRefund extends BaseDocument {
  refundId: ObjectIdType;
  patientId?: ObjectIdType;
  claimId?: ObjectIdType;
  patientBillingId?: ObjectIdType;
  patientPaymentId?: ObjectIdType;
  refundType?: string;
  refundReason?: string;
  refundAmount?: number;
  cashOutAmount?: number;
  balanceImpactAmount?: number;
  refundMethod?: string;
  idempotencyKey?: string;
  externalRefundReference?: string;
  requestedDate?: Date;
  approvedDate?: Date;
  processedDate?: Date;
  refundStatus?: string;
  approvedBy?: string;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IRefundModel extends Model<IRefund> {
  list(criteria: any): Promise<IRefund[]>;
  totalCount(criteria: any): Promise<number>;
}

const refundSchema = new Schema<IRefund, IRefundModel>(
  {
    refundId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    patientBillingId: { type: Schema.Types.ObjectId, ref: 'PatientBilling' },
    patientPaymentId: { type: Schema.Types.ObjectId, ref: 'PatientPayment' },
    refundType: { type: String, trim: true },
    refundReason: { type: String, trim: true },
    refundAmount: { type: Number },
    cashOutAmount: { type: Number },
    balanceImpactAmount: { type: Number },
    refundMethod: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true },
    externalRefundReference: { type: String, trim: true },
    requestedDate: { type: Date },
    approvedDate: { type: Date },
    processedDate: { type: Date },
    refundStatus: { type: String, trim: true },
    approvedBy: { type: String, trim: true },
    notes: { type: String, trim: true },
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

refundSchema.virtual('createdAt').get(function () {
  return this.created;
});

refundSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

refundSchema.index({ isDeleted: 1, updated: -1 });
refundSchema.index({ refundType: 1 });
refundSchema.index({ refundStatus: 1 });
refundSchema.index({ patientPaymentId: 1 }, { unique: true, sparse: true });
refundSchema.index({ patientBillingId: 1, refundStatus: 1 });
refundSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
refundSchema.index({ externalRefundReference: 1 }, { unique: true, sparse: true });

refundSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

refundSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Refund = model<IRefund, IRefundModel>('Refund', refundSchema);
