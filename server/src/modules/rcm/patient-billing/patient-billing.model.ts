import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IPatientBillingLineItem {
  claimLineId?: ObjectIdType;
  procedureCode?: string;
  serviceDate?: Date;
  description?: string;
  allowedAmount?: number;
  insurancePaid?: number;
  adjustments?: number;
  patientResponsibility?: number;
}

export interface IPatientBilling extends BaseDocument {
  patientBillingId: ObjectIdType;
  patientId?: ObjectIdType;
  chargeId?: ObjectIdType;
  encounterId?: ObjectIdType;
  claimId?: ObjectIdType;
  paymentPostingId?: ObjectIdType;
  statementNumber?: string;
  statementDate?: Date;
  statementCycle?: string;
  billingCycle?: string;
  originalBalance?: number;
  currentBalance?: number;
  insurancePaid?: number;
  adjustments?: number;
  patientPayments?: number;
  patientBalance?: number;
  amountPaid?: number;
  amountDue?: number;
  dueDate?: Date;
  lastStatementSent?: Date;
  collectionsFlag?: boolean;
  writeOffFlag?: boolean;
  refundFlag?: boolean;
  refundAmount?: number;
  creditBalanceAmount?: number;
  paymentPlanId?: ObjectIdType;
  statementStatus?: string;
  status?: string;
  agingBucket?: string;
  lineItems: IPatientBillingLineItem[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IPatientBillingModel extends Model<IPatientBilling> {
  list(criteria: any): Promise<IPatientBilling[]>;
  totalCount(criteria: any): Promise<number>;
}

const lineItemSchema = new Schema<IPatientBillingLineItem>(
  {
    claimLineId: { type: Schema.Types.ObjectId },
    procedureCode: { type: String, trim: true },
    serviceDate: { type: Date },
    description: { type: String, trim: true },
    allowedAmount: { type: Number },
    insurancePaid: { type: Number },
    adjustments: { type: Number },
    patientResponsibility: { type: Number },
  },
  { _id: false }
);

const patientBillingSchema = new Schema<IPatientBilling, IPatientBillingModel>(
  {
    patientBillingId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    chargeId: { type: Schema.Types.ObjectId, ref: 'Charge' },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    paymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    statementNumber: { type: String, trim: true },
    statementDate: { type: Date },
    statementCycle: { type: String, trim: true },
    billingCycle: { type: String, trim: true },
    originalBalance: { type: Number },
    currentBalance: { type: Number },
    insurancePaid: { type: Number },
    adjustments: { type: Number },
    patientPayments: { type: Number },
    patientBalance: { type: Number },
    amountPaid: { type: Number },
    amountDue: { type: Number },
    dueDate: { type: Date },
    lastStatementSent: { type: Date },
    collectionsFlag: { type: Boolean, default: false },
    writeOffFlag: { type: Boolean, default: false },
    refundFlag: { type: Boolean, default: false },
    refundAmount: { type: Number },
    creditBalanceAmount: { type: Number },
    paymentPlanId: { type: Schema.Types.ObjectId },
    statementStatus: { type: String, trim: true },
    status: { type: String, trim: true },
    agingBucket: { type: String, trim: true },
    lineItems: { type: [lineItemSchema], default: [] },
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

patientBillingSchema.virtual('createdAt').get(function () {
  return this.created;
});

patientBillingSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

patientBillingSchema.index({ isDeleted: 1, updated: -1 });
patientBillingSchema.index({ statementDate: 1 });
patientBillingSchema.index({ statementStatus: 1 });
patientBillingSchema.index({ status: 1 });
patientBillingSchema.index({ chargeId: 1 });
patientBillingSchema.index({ paymentPostingId: 1 }, { unique: true, sparse: true });
patientBillingSchema.index({ agingBucket: 1 });

patientBillingSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

patientBillingSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const PatientBilling = model<IPatientBilling, IPatientBillingModel>('PatientBilling', patientBillingSchema);
