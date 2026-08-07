import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IEligibilityVerification extends BaseDocument {
  eligibilityId: ObjectIdType;
  appointmentId?: ObjectIdType;
  patientId?: ObjectIdType;
  insuranceId?: ObjectIdType;
  payerId?: string;
  serviceTypeCode?: string;
  serviceTypeCodes?: string[];
  serviceDate?: Date;
  coveragePriority?: string;
  procedureCodes?: string[];
  correlationId?: string;
  externalVerificationId?: string;
  vendorName?: string;
  eligibilityStatus?: string;
  coverageStatus?: string;
  planActive?: boolean;
  copayAmount?: number;
  coinsurancePercent?: number;
  deductibleRemaining?: number;
  outOfPocketRemaining?: number;
  networkStatus?: string;
  referralRequired?: boolean;
  authorizationRequired?: boolean;
  benefitNotes?: string;
  checkedBy?: string;
  checkedAt?: Date;
  verificationSource?: string;
  rawResponseReference?: string;
  responseStatusCode?: number;
  rawRequestPayload?: Record<string, unknown>;
  rawResponsePayload?: Record<string, unknown>;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IEligibilityVerificationModel extends Model<IEligibilityVerification> {
  list(criteria: any): Promise<IEligibilityVerification[]>;
  totalCount(criteria: any): Promise<number>;
}

const eligibilityVerificationSchema = new Schema<IEligibilityVerification, IEligibilityVerificationModel>(
  {
    eligibilityId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    insuranceId: { type: Schema.Types.ObjectId, ref: 'InsurancePolicy' },
    payerId: { type: String, trim: true },
    serviceTypeCode: { type: String, trim: true },
    serviceTypeCodes: { type: [String], default: [] },
    serviceDate: { type: Date },
    coveragePriority: { type: String, trim: true },
    procedureCodes: { type: [String], default: [] },
    correlationId: { type: String, trim: true },
    externalVerificationId: { type: String, trim: true },
    vendorName: { type: String, trim: true },
    eligibilityStatus: { type: String, trim: true },
    coverageStatus: { type: String, trim: true },
    planActive: { type: Boolean, default: false },
    copayAmount: { type: Number },
    coinsurancePercent: { type: Number },
    deductibleRemaining: { type: Number },
    outOfPocketRemaining: { type: Number },
    networkStatus: { type: String, trim: true },
    referralRequired: { type: Boolean, default: false },
    authorizationRequired: { type: Boolean, default: false },
    benefitNotes: { type: String, trim: true },
    checkedBy: { type: String, trim: true },
    checkedAt: { type: Date },
    verificationSource: { type: String, trim: true },
    rawResponseReference: { type: String, trim: true },
    responseStatusCode: { type: Number },
    rawRequestPayload: { type: Schema.Types.Mixed },
    rawResponsePayload: { type: Schema.Types.Mixed },
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

eligibilityVerificationSchema.virtual('createdAt').get(function () {
  return this.created;
});

eligibilityVerificationSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

eligibilityVerificationSchema.index({ isDeleted: 1, updated: -1 });
eligibilityVerificationSchema.index({ eligibilityStatus: 1 });
eligibilityVerificationSchema.index({ coverageStatus: 1 });
eligibilityVerificationSchema.index({ appointmentId: 1, checkedAt: -1 });
eligibilityVerificationSchema.index({ patientId: 1, insuranceId: 1, payerId: 1, serviceDate: 1, checkedAt: -1 });

eligibilityVerificationSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

eligibilityVerificationSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const EligibilityVerification = model<IEligibilityVerification, IEligibilityVerificationModel>('EligibilityVerification', eligibilityVerificationSchema);
