import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IClaimPrediction extends BaseDocument {
  predictionId: ObjectIdType;
  claimId?: ObjectIdType;
  chargeId?: ObjectIdType;
  encounterId?: ObjectIdType;
  appointmentId?: ObjectIdType;
  patientId?: ObjectIdType;
  cptCode: string;
  payerId: string;
  lineNumber?: number;
  renderingProviderId?: ObjectIdType;
  billingProviderId?: ObjectIdType;
  facilityId?: ObjectIdType;
  units?: number;
  chargeAmount?: number;
  predictedAllowed: number;
  predictedPaid: number;
  predictedPatientResponsibility?: number;
  expectedAllowedPercentage?: number;
  expectedPaidPercentage?: number;
  confidenceScore: number;
  denialRiskScore?: number;
  eligibilityRiskScore?: number;
  authorizationRiskScore?: number;
  paymentVarianceScore?: number;
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical';
  workflowStage?: string;
  nextBestActions?: string[];
  riskFactors?: string[];
  evidence?: string[];
  sampleSize?: number;
  feeScheduleId?: ObjectIdType;
  feeScheduleMatchLevel?: string;
  pricingState?: string;
  placeOfServiceCode?: string;
  source: 'historical' | 'ai' | 'workflow_rules' | 'hybrid';
  explanation?: string;
  active: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
}

export interface IClaimPredictionModel extends Model<IClaimPrediction> {
  list(criteria: any): Promise<IClaimPrediction[]>;
  totalCount(criteria: any): Promise<number>;
}

const claimPredictionSchema = new Schema<IClaimPrediction, IClaimPredictionModel>(
  {
    predictionId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', index: true },
    chargeId: { type: Schema.Types.ObjectId, ref: 'Charge', index: true },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter', index: true },
    appointmentId: { type: Schema.Types.ObjectId, ref: 'Appointment', index: true },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient', index: true },
    cptCode: { type: String, required: true, trim: true, index: true },
    payerId: { type: String, required: true, trim: true, index: true },
    lineNumber: { type: Number },
    renderingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider', index: true },
    billingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider', index: true },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility', index: true },
    units: { type: Number },
    chargeAmount: { type: Number },
    predictedAllowed: { type: Number, required: true },
    predictedPaid: { type: Number, required: true },
    predictedPatientResponsibility: { type: Number },
    expectedAllowedPercentage: { type: Number },
    expectedPaidPercentage: { type: Number },
    confidenceScore: { type: Number, required: true },
    denialRiskScore: { type: Number },
    eligibilityRiskScore: { type: Number },
    authorizationRiskScore: { type: Number },
    paymentVarianceScore: { type: Number },
    riskLevel: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'] },
    workflowStage: { type: String, trim: true },
    nextBestActions: { type: [String], default: [] },
    riskFactors: { type: [String], default: [] },
    evidence: { type: [String], default: [] },
    sampleSize: { type: Number },
    feeScheduleId: { type: Schema.Types.ObjectId, ref: 'FeeSchedule', index: true },
    feeScheduleMatchLevel: { type: String, trim: true },
    pricingState: { type: String, trim: true, uppercase: true, index: true },
    placeOfServiceCode: { type: String, trim: true, index: true },
    source: { type: String, enum: ['historical', 'ai', 'workflow_rules', 'hybrid'], required: true },
    explanation: { type: String },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

claimPredictionSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimPredictionSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClaimPrediction = model<IClaimPrediction, IClaimPredictionModel>('ClaimPrediction', claimPredictionSchema);
