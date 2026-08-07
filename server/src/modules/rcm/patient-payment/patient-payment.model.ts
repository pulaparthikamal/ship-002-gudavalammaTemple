import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IPatientPayment extends BaseDocument {
  patientPaymentId: ObjectIdType;
  patientId?: ObjectIdType;
  patientBillingId?: ObjectIdType;
  claimId?: ObjectIdType;
  claimLineId?: ObjectIdType;
  paymentDate?: Date;
  paymentMethod?: string;
  idempotencyKey?: string;
  externalTransactionId?: string;
  amount?: number;
  appliedAmount?: number;
  overpaymentAmount?: number;
  referenceNumber?: string;
  receiptNumber?: string;
  receiptMetadata?: Record<string, unknown>;
  paymentStatus?: string;
  collectedAtFrontDesk?: boolean;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IPatientPaymentModel extends Model<IPatientPayment> {
  list(criteria: any): Promise<IPatientPayment[]>;
  totalCount(criteria: any): Promise<number>;
}

const patientPaymentSchema = new Schema<IPatientPayment, IPatientPaymentModel>(
  {
    patientPaymentId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    patientBillingId: { type: Schema.Types.ObjectId, ref: 'PatientBilling' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    claimLineId: { type: Schema.Types.ObjectId },
    paymentDate: { type: Date },
    paymentMethod: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true },
    externalTransactionId: { type: String, trim: true },
    amount: { type: Number },
    appliedAmount: { type: Number },
    overpaymentAmount: { type: Number },
    referenceNumber: { type: String, trim: true },
    receiptNumber: { type: String, trim: true },
    receiptMetadata: { type: Schema.Types.Mixed },
    paymentStatus: { type: String, trim: true },
    collectedAtFrontDesk: { type: Boolean, default: false },
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

patientPaymentSchema.virtual('createdAt').get(function () {
  return this.created;
});

patientPaymentSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

patientPaymentSchema.index({ isDeleted: 1, updated: -1 });
patientPaymentSchema.index({ paymentDate: 1 });
patientPaymentSchema.index({ paymentStatus: 1 });
patientPaymentSchema.index({ patientBillingId: 1, paymentStatus: 1 });
patientPaymentSchema.index({ receiptNumber: 1 }, { unique: true, sparse: true });
patientPaymentSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });
patientPaymentSchema.index({ externalTransactionId: 1 }, { unique: true, sparse: true });
patientPaymentSchema.index(
  { patientBillingId: 1, amount: 1, paymentDate: 1, referenceNumber: 1 },
  { unique: true, sparse: true }
);

patientPaymentSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

patientPaymentSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const PatientPayment = model<IPatientPayment, IPatientPaymentModel>('PatientPayment', patientPaymentSchema);
