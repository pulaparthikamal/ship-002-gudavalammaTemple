import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IReferral extends BaseDocument {
  referralId: ObjectIdType;
  patientId?: ObjectIdType;
  appointmentId?: ObjectIdType;
  insuranceId?: ObjectIdType;
  facilityId?: ObjectIdType;
  referringProviderId?: ObjectIdType;
  referredToProviderId?: ObjectIdType;
  payerId?: string;
  referralNumber?: string;
  referralType?: string;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  startDate?: Date;
  endDate?: Date;
  referralStatus?: string;
  approvedVisits?: number;
  usedVisits?: number;
  remainingVisits?: number;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IReferralModel extends Model<IReferral> {
  list(criteria: any): Promise<IReferral[]>;
  totalCount(criteria: any): Promise<number>;
}

const referralSchema = new Schema<IReferral, IReferralModel>(
  {
    referralId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    insuranceId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    referringProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    referredToProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    payerId: { type: String, trim: true },
    referralNumber: { type: String, trim: true },
    referralType: { type: String, trim: true },
    diagnosisCodes: { type: [String], default: [] },
    procedureCodes: { type: [String], default: [] },
    startDate: { type: Date },
    endDate: { type: Date },
    referralStatus: { type: String, trim: true },
    approvedVisits: { type: Number },
    usedVisits: { type: Number },
    remainingVisits: { type: Number },
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

referralSchema.virtual('createdAt').get(function () {
  return this.created;
});

referralSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

referralSchema.index({ isDeleted: 1, updated: -1 });
referralSchema.index({ referralNumber: 1 });
referralSchema.index({ referralStatus: 1 });

referralSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

referralSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Referral = model<IReferral, IReferralModel>('Referral', referralSchema);
