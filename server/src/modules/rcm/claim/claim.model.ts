import mongoose, { Schema, model, Model } from 'mongoose';
import { AttachmentLink, BaseDocument, ObjectIdType } from '../../../types/common.types';
import {
  CLAIM_COVERAGE_PRIORITY_OPTIONS,
  CLAIM_PAYMENT_STATUS_OPTIONS,
  CLAIM_SCRUB_STATUS_OPTIONS,
  CLAIM_STATUS_OPTIONS,
  CLAIM_SUBMISSION_STATUS_OPTIONS,
  CLAIM_TYPE_OPTIONS,
  CLAIM_CLOSURE_STATUS_OPTIONS,
} from './claim.constants';
import { IStatusHistoryEntry, statusHistorySchema } from '../workflow/workflow-history';

export interface IClaimClaimLine {
  _id?: ObjectIdType;
  lineNumber?: number;
  chargeLineId?: ObjectIdType;
  cptCode?: string;
  modifiers?: string[];
  icdPointers?: number[];
  units?: number;
  chargeAmount?: number;
  renderingProviderId?: ObjectIdType;
  placeOfService?: string;
  serviceDateFrom?: Date;
  serviceDateTo?: Date;
  expectedAllowedAmount?: number;
  expectedInsurancePayment?: number;
  expectedPatientResponsibility?: number;
  patientCopayAmount?: number;
  patientCoinsuranceAmount?: number;
  deductibleAppliedAmount?: number;
  feeScheduleId?: ObjectIdType;
  pricingMatchedBy?: string;
  pricingSource?: string;
  pricingSnapshotDate?: Date;
  coverageRuleSnapshot?: Record<string, unknown>;
  payerRuleSnapshot?: Record<string, unknown>;
  eligibilityVerificationId?: ObjectIdType;
  priorAuthorizationId?: ObjectIdType;
  referralId?: ObjectIdType;
  authorizationRequired?: boolean;
  referralRequired?: boolean;
  networkStatus?: string;
}

export interface IClaim extends BaseDocument {
  claimId: ObjectIdType;
  chargeId?: ObjectIdType;
  encounterId?: ObjectIdType;
  patientId?: ObjectIdType;
  payerId?: string;
  billingProviderId?: ObjectIdType;
  renderingProviderId?: ObjectIdType;
  facilityId?: ObjectIdType;
  claimDate?: Date;
  totalChargeAmount?: number;
  coveragePriority?: string;
  frequencyCode?: string;
  claimType?: string;
  claimStatus?: string;
  scrubStatus?: string;
  submissionStatus?: string;
  paymentStatus?: string;
  closureStatus?: string;
  closeReason?: string;
  closedBy?: ObjectIdType | string;
  closedAt?: Date;
  reopenReason?: string;
  reopenedBy?: ObjectIdType | string;
  reopenedAt?: Date;
  expectedEraBy?: Date;
  lastPayerFollowUpAt?: Date;
  followUpCount?: number;
  financialBalanceSnapshot?: Record<string, unknown>;
  financialLedgerSequence?: number;
  financialLedgerHeadHash?: string;
  diagnosisCodes?: string[];
  rejectionReason?: string;
  originalClaimId?: ObjectIdType;
  correctedFromClaimId?: ObjectIdType;
  sourceDenialId?: ObjectIdType;
  correctedClaimRecordId?: ObjectIdType;
  correctionType?: string;
  lineageChain?: ObjectIdType[];
  parentClaimId?: ObjectIdType;
  version?: number;
  resubmissionCount?: number;
  correctedClaimIndicator?: boolean;
  batchId?: string;
  clearingHouse?: string;
  ediStatus?: string;
  snapshotStatus?: string;
  snapshotIssues?: string[];
  sourceChargeUpdatedAt?: Date;
  sourceCodingReviewUpdatedAt?: Date;
  sourceCodingSnapshotHash?: string;
  claimLines: IClaimClaimLine[];
  attachments: AttachmentLink[];
  statusHistory?: IStatusHistoryEntry[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClaimModel extends Model<IClaim> {
  list(criteria: any): Promise<IClaim[]>;
  totalCount(criteria: any): Promise<number>;
}

const claimLinesSchema = new Schema<IClaimClaimLine>(
  {
    lineNumber: { type: Number },
    chargeLineId: { type: Schema.Types.ObjectId },
    cptCode: { type: String, trim: true },
    modifiers: { type: [String], default: [] },
    icdPointers: { type: [Number], default: [] },
    units: { type: Number },
    chargeAmount: { type: Number },
    renderingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    placeOfService: { type: String, trim: true },
    serviceDateFrom: { type: Date },
    serviceDateTo: { type: Date },
    expectedAllowedAmount: { type: Number },
    expectedInsurancePayment: { type: Number },
    expectedPatientResponsibility: { type: Number },
    patientCopayAmount: { type: Number },
    patientCoinsuranceAmount: { type: Number },
    deductibleAppliedAmount: { type: Number },
    feeScheduleId: { type: Schema.Types.ObjectId, ref: 'FeeSchedule' },
    pricingMatchedBy: { type: String, trim: true },
    pricingSource: { type: String, trim: true },
    pricingSnapshotDate: { type: Date },
    coverageRuleSnapshot: { type: Schema.Types.Mixed },
    payerRuleSnapshot: { type: Schema.Types.Mixed },
    eligibilityVerificationId: { type: Schema.Types.ObjectId, ref: 'EligibilityVerification' },
    priorAuthorizationId: { type: Schema.Types.ObjectId, ref: 'PriorAuthorization' },
    referralId: { type: Schema.Types.ObjectId, ref: 'Referral' },
    authorizationRequired: { type: Boolean, default: false },
    referralRequired: { type: Boolean, default: false },
    networkStatus: { type: String, trim: true },
  }
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

const claimSchema = new Schema<IClaim, IClaimModel>(
  {
    claimId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    chargeId: { type: Schema.Types.ObjectId, ref: 'Charge' },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    payerId: { type: String, trim: true },
    billingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    renderingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
    facilityId: { type: Schema.Types.ObjectId, ref: 'Facility' },
    claimDate: { type: Date },
    totalChargeAmount: { type: Number },
    coveragePriority: { type: String, trim: true, enum: CLAIM_COVERAGE_PRIORITY_OPTIONS, default: 'Primary' },
    frequencyCode: { type: String, trim: true },
    claimType: { type: String, trim: true, enum: CLAIM_TYPE_OPTIONS, default: 'Professional' },
    claimStatus: { type: String, trim: true, enum: CLAIM_STATUS_OPTIONS, default: 'Draft' },
    scrubStatus: { type: String, trim: true, enum: CLAIM_SCRUB_STATUS_OPTIONS, default: 'Passed' },
    submissionStatus: {
      type: String,
      trim: true,
      enum: CLAIM_SUBMISSION_STATUS_OPTIONS,
      default: 'Not Submitted',
    },
    paymentStatus: {
      type: String,
      trim: true,
      enum: CLAIM_PAYMENT_STATUS_OPTIONS,
    },
    closureStatus: {
      type: String,
      trim: true,
      enum: CLAIM_CLOSURE_STATUS_OPTIONS,
      default: 'OPEN',
      index: true,
    },
    closeReason: { type: String, trim: true },
    closedBy: { type: Schema.Types.Mixed },
    closedAt: { type: Date },
    reopenReason: { type: String, trim: true },
    reopenedBy: { type: Schema.Types.Mixed },
    reopenedAt: { type: Date },
    expectedEraBy: { type: Date, index: true },
    lastPayerFollowUpAt: { type: Date },
    followUpCount: { type: Number, default: 0 },
    financialBalanceSnapshot: { type: Schema.Types.Mixed },
    financialLedgerSequence: { type: Number, default: 0 },
    financialLedgerHeadHash: { type: String, trim: true },
    diagnosisCodes: { type: [String], default: [] },
    rejectionReason: { type: String, trim: true },
    originalClaimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    correctedFromClaimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    sourceDenialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    correctedClaimRecordId: { type: Schema.Types.ObjectId, ref: 'CorrectedClaim' },
    correctionType: { type: String, trim: true },
    lineageChain: { type: [Schema.Types.ObjectId], default: [] },
    parentClaimId: { type: Schema.Types.ObjectId, ref: 'Claim', index: true },
    version: { type: Number, default: 1 },
    resubmissionCount: { type: Number, default: 0 },
    correctedClaimIndicator: { type: Boolean, default: false },
    batchId: { type: String, trim: true },
    clearingHouse: { type: String, trim: true },
    ediStatus: { type: String, trim: true },
    snapshotStatus: { type: String, trim: true, default: 'CURRENT' },
    snapshotIssues: { type: [String], default: [] },
    sourceChargeUpdatedAt: { type: Date },
    sourceCodingReviewUpdatedAt: { type: Date },
    sourceCodingSnapshotHash: { type: String, trim: true },
    claimLines: { type: [claimLinesSchema], default: [] },
    attachments: { type: [attachmentSchema], default: [] },
    statusHistory: { type: [statusHistorySchema], default: [] },
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

claimSchema.virtual('createdAt').get(function () {
  return this.created;
});

claimSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

claimSchema.index({ isDeleted: 1, updated: -1 });
claimSchema.index({ claimDate: 1 });
claimSchema.index({ claimStatus: 1 });
claimSchema.index({ paymentStatus: 1 });
claimSchema.index({ closureStatus: 1, expectedEraBy: 1 });
claimSchema.index({ chargeId: 1 });
claimSchema.index({ originalClaimId: 1 });
claimSchema.index({ correctedFromClaimId: 1 });
claimSchema.index({ sourceDenialId: 1 });
claimSchema.index({ parentClaimId: 1, version: -1 });

claimSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Claim = model<IClaim, IClaimModel>('Claim', claimSchema);
