import mongoose, { Schema, model, Model } from 'mongoose';
import { AttachmentLink, BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IInsurancePolicySubscriber {
  firstName?: string;
  lastName?: string;
  dob?: Date;
  gender?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zipCode?: string;
}

export interface IInsurancePolicyCard {
  frontImageUrl?: string;
  backImageUrl?: string;
}

export interface IInsurancePolicyVerification {
  lastVerifiedDateTime?: Date;
  nextVerificationDueDate?: Date;
}

export interface IInsurancePolicyDependentValidation {
  status?: string;
  riskScore?: number;
  issues?: string[];
  suggestedFixes?: string[];
  source?: string;
  checkedAt?: Date;
}

export interface IInsurancePolicy extends BaseDocument {
  insuranceId: ObjectIdType;
  patientId: ObjectIdType;
  payerId: string;
  ediPayerId?: string;
  payerType?: string;
  coverageType: string;
  planName: string;
  memberId: string;
  subscriberId?: string;
  groupNumber?: string;
  dependentNumber?: string;
  coveragePriority: string;
  coordinationOfBenefitsOrder?: number;
  network?: string;
  effectiveDate?: Date;
  terminationDate?: Date;
  policyStatus: string;
  relationshipToSubscriber: string;
  insuranceVerifiedFlag?: boolean;
  subscriber?: IInsurancePolicySubscriber;
  card?: IInsurancePolicyCard;
  verification?: IInsurancePolicyVerification;
  dependentValidation?: IInsurancePolicyDependentValidation;
  attachments: AttachmentLink[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IInsurancePolicyModel extends Model<IInsurancePolicy> {
  list(criteria: any): Promise<IInsurancePolicy[]>;
  totalCount(criteria: any): Promise<number>;
}

const subscriberSchema = new Schema<IInsurancePolicySubscriber>(
  {
    firstName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    dob: { type: Date },
    gender: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    addressLine1: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    zipCode: { type: String, trim: true },
  },
  { _id: false }
);

const cardSchema = new Schema<IInsurancePolicyCard>(
  {
    frontImageUrl: { type: String, trim: true },
    backImageUrl: { type: String, trim: true },
  },
  { _id: false }
);

const verificationSchema = new Schema<IInsurancePolicyVerification>(
  {
    lastVerifiedDateTime: { type: Date },
    nextVerificationDueDate: { type: Date },
  },
  { _id: false }
);

const dependentValidationSchema = new Schema<IInsurancePolicyDependentValidation>(
  {
    status: { type: String, trim: true },
    riskScore: { type: Number },
    issues: { type: [String], default: [] },
    suggestedFixes: { type: [String], default: [] },
    source: { type: String, trim: true },
    checkedAt: { type: Date },
  },
  { _id: false }
);

const attachmentSchema = new Schema<AttachmentLink>(
  {
    documentType: { type: String, trim: true },
    title: { type: String, trim: true },
    fileUrl: { type: String, trim: true },
    description: { type: String, trim: true },
  },
  { _id: false }
);

const insurancePolicySchema = new Schema<IInsurancePolicy, IInsurancePolicyModel>(
  {
    insuranceId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', required: true },
    payerId: { type: String, required: true, trim: true },
    ediPayerId: { type: String, trim: true },
    payerType: { type: String, trim: true },
    coverageType: { type: String, required: true, trim: true },
    planName: { type: String, required: true, trim: true },
    memberId: { type: String, required: true, trim: true },
    subscriberId: { type: String, trim: true },
    groupNumber: { type: String, trim: true },
    dependentNumber: { type: String, trim: true },
    coveragePriority: { type: String, required: true, trim: true },
    coordinationOfBenefitsOrder: { type: Number },
    network: { type: String, trim: true },
    effectiveDate: { type: Date },
    terminationDate: { type: Date },
    policyStatus: { type: String, required: true, trim: true },
    relationshipToSubscriber: { type: String, required: true, trim: true },
    insuranceVerifiedFlag: { type: Boolean, default: false },
    subscriber: { type: subscriberSchema, default: {} },
    card: { type: cardSchema, default: {} },
    verification: { type: verificationSchema, default: {} },
    dependentValidation: { type: dependentValidationSchema, default: {} },
    attachments: { type: [attachmentSchema], default: [] },
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

insurancePolicySchema.virtual('createdAt').get(function () {
  return this.created;
});

insurancePolicySchema.virtual('updatedAt').get(function () {
  return this.updated;
});

insurancePolicySchema.index({ isDeleted: 1, updated: -1 });
insurancePolicySchema.index({ planName: 1 });
insurancePolicySchema.index({ memberId: 1 });
insurancePolicySchema.index({ patientId: 1, payerId: 1, memberId: 1 });

insurancePolicySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

insurancePolicySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const InsurancePolicy = model<IInsurancePolicy, IInsurancePolicyModel>('InsurancePolicy', insurancePolicySchema);
