import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type TimelyFilingStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXPIRED';
export type TimelyFilingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface ITimelyFilingAlert extends BaseDocument {
  alertId: ObjectIdType;
  claimId: ObjectIdType;
  payerId: string;
  serviceDate: Date;
  filingDeadline: Date;
  daysRemaining: number;
  severity: TimelyFilingSeverity;
  status: TimelyFilingStatus;
  lastZapierTriggeredAt?: Date;
  lastZapierStatus?: TimelyFilingStatus;
  lastZapierSeverity?: TimelyFilingSeverity;
  zapierDeliveryStatus?: string;
  zapierDeliveryError?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface ITimelyFilingAlertModel extends Model<ITimelyFilingAlert> {
  list(criteria: any): Promise<ITimelyFilingAlert[]>;
  totalCount(criteria: any): Promise<number>;
}

const timelyFilingAlertSchema = new Schema<ITimelyFilingAlert, ITimelyFilingAlertModel>(
  {
    alertId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', required: true, index: true },
    payerId: { type: String, trim: true, required: true, index: true },
    serviceDate: { type: Date, required: true },
    filingDeadline: { type: Date, required: true, index: true },
    daysRemaining: { type: Number, required: true, index: true },
    severity: { type: String, trim: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], required: true, index: true },
    status: { type: String, trim: true, enum: ['SAFE', 'WARNING', 'CRITICAL', 'EXPIRED'], required: true, index: true },
    lastZapierTriggeredAt: { type: Date },
    lastZapierStatus: { type: String, trim: true, enum: ['SAFE', 'WARNING', 'CRITICAL', 'EXPIRED'] },
    lastZapierSeverity: { type: String, trim: true, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
    zapierDeliveryStatus: { type: String, trim: true },
    zapierDeliveryError: { type: String, trim: true },
    active: { type: Boolean, default: true, index: true },
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

timelyFilingAlertSchema.virtual('createdAt').get(function () {
  return this.created;
});

timelyFilingAlertSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

timelyFilingAlertSchema.index({ claimId: 1, payerId: 1 }, { unique: true });
timelyFilingAlertSchema.index({ isDeleted: 1, active: 1, status: 1, daysRemaining: 1 });
timelyFilingAlertSchema.index({ isDeleted: 1, updated: -1 });

timelyFilingAlertSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

timelyFilingAlertSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const TimelyFilingAlert = model<ITimelyFilingAlert, ITimelyFilingAlertModel>(
  'TimelyFilingAlert',
  timelyFilingAlertSchema
);
