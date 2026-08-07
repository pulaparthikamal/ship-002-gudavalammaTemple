import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IPayer extends BaseDocument {
  payerId?: string;
  payerName?: string;
  ediPayerId?: string;
  payerType?: string;
  claimsSubmissionMethod?: string;
  eligibilityApiSupported?: boolean;
  authPortalUrl?: string;
  payerAddressLine1?: string;
  payerAddressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  phone?: string;
  timelyFilingDays?: number;
  appealTimelyFilingDays?: number;
  activeFlag?: boolean;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IPayerModel extends Model<IPayer> {
  list(criteria: any): Promise<IPayer[]>;
  totalCount(criteria: any): Promise<number>;
}

const payerSchema = new Schema<IPayer, IPayerModel>(
  {
    payerId: { type: String, trim: true },
    payerName: { type: String, trim: true },
    ediPayerId: { type: String, trim: true },
    payerType: { type: String, trim: true },
    claimsSubmissionMethod: { type: String, trim: true },
    eligibilityApiSupported: { type: Boolean, default: false },
    authPortalUrl: { type: String, trim: true },
    payerAddressLine1: { type: String, trim: true },
    payerAddressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    timelyFilingDays: { type: Number },
    appealTimelyFilingDays: { type: Number },
    activeFlag: { type: Boolean, default: false },
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

payerSchema.virtual('createdAt').get(function () {
  return this.created;
});

payerSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

payerSchema.index({ isDeleted: 1, updated: -1 });
payerSchema.index({ payerName: 1 });
payerSchema.index({ payerId: 1 });

payerSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

payerSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Payer = model<IPayer, IPayerModel>('Payer', payerSchema);