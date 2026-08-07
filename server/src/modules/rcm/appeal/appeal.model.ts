import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IAppeal extends BaseDocument {
  appealId: ObjectIdType;
  denialId?: ObjectIdType;
  claimId?: ObjectIdType;
  arWorkItemId?: ObjectIdType;
  payerId?: string;
  denialCode?: string;
  appealCategory?: string;
  dueDate?: Date;
  owner?: string;
  appealLevel?: string;
  appealReason?: string;
  appealDescription?: string;
  supportingDocuments?: string[];
  appealStatus?: string;
  submissionDate?: Date;
  submittedAt?: Date;
  payerReceivedAt?: Date;
  decisionAt?: Date;
  appealDeadline?: Date;
  submissionMethod?: string;
  payerResponse?: string;
  resolution?: string;
  outcome?: string;
  outcomeDate?: Date;
  appealOutcomeReason?: string;
  payerResponseDueAt?: Date;
  evidenceSubmittedAt?: Date;
  missingDocumentRequests?: Array<Record<string, unknown>>;
  evidenceItems?: Array<Record<string, unknown>>;
  correspondenceHistory?: Array<Record<string, unknown>>;
  slaStatus?: string;
  escalatedAt?: Date;
  escalationCount?: number;
  escalationReason?: string;
  evidenceSummary?: string;
  submittedBy?: ObjectIdType;
  decisionBy?: ObjectIdType;
  decisionNotes?: string;
  payerReferenceNumber?: string;
  expectedReprocessBy?: Date;
  relatedPaymentPostingId?: ObjectIdType;
  relatedEraId?: ObjectIdType;
  readinessStatus?: string;
  readinessReview?: Record<string, unknown>;
  packetGenerated?: boolean;
  packetGeneratedAt?: Date;
  packetVersion?: number;
  packetStatus?: string;
  packetFileReference?: string;
  packetFileName?: string;
  finalPacketGeneratedAt?: Date;
  finalPacketVersion?: number;
  finalPacketFileReference?: string;
  finalPacketFileName?: string;
  packetSnapshot?: Record<string, unknown>;
  generatedAppealLetterText?: string;
  aiPacketDraft?: Record<string, unknown>;
  aiPacketHistory?: Array<Record<string, unknown>>;
  diagnosisCodes?: string[];
  procedureCodes?: string[];
  medicalNecessityNotes?: string;
  authorizationEvidence?: string;
  eligibilityEvidence?: string;
  priorPayerResponse?: string;
  supportingDocumentsMetadata?: Array<Record<string, unknown>>;
  submissionChannel?: string;
  submissionTracking?: Record<string, unknown>;
  submissionProof?: Record<string, unknown>;
  deadlineStatus?: string;
  daysRemaining?: number;
  recoveredAmount?: number;
  payerRecoveredAmount?: number;
  patientRecoveredAmount?: number;
  contractualAdjustmentRecoveredAmount?: number;
  recoveredAt?: Date;
  recoveryStatus?: 'NONE' | 'PARTIAL' | 'FULL';
  recoveryPercent?: number;
  statusHistory?: Array<Record<string, unknown>>;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IAppealModel extends Model<IAppeal> {
  list(criteria: any): Promise<IAppeal[]>;
  totalCount(criteria: any): Promise<number>;
}

const appealSchema = new Schema<IAppeal, IAppealModel>(
  {
    appealId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    denialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    arWorkItemId: { type: Schema.Types.ObjectId, ref: 'ArWorkItem' },
    payerId: { type: String, trim: true },
    denialCode: { type: String, trim: true },
    appealCategory: { type: String, trim: true },
    dueDate: { type: Date },
    owner: { type: String, trim: true },
    appealLevel: { type: String, trim: true },
    appealReason: { type: String, trim: true },
    appealDescription: { type: String, trim: true },
    supportingDocuments: { type: [String], default: [] },
    appealStatus: { type: String, trim: true },
    submissionDate: { type: Date },
    submittedAt: { type: Date },
    payerReceivedAt: { type: Date },
    decisionAt: { type: Date },
    appealDeadline: { type: Date },
    submissionMethod: { type: String, trim: true },
    payerResponse: { type: String, trim: true },
    resolution: { type: String, trim: true },
    outcome: { type: String, trim: true },
    outcomeDate: { type: Date },
    appealOutcomeReason: { type: String, trim: true },
    payerResponseDueAt: { type: Date, index: true },
    evidenceSubmittedAt: { type: Date },
    missingDocumentRequests: { type: [Schema.Types.Mixed], default: [] },
    evidenceItems: { type: [Schema.Types.Mixed], default: [] },
    correspondenceHistory: { type: [Schema.Types.Mixed], default: [] },
    slaStatus: { type: String, trim: true },
    escalatedAt: { type: Date },
    escalationCount: { type: Number, default: 0 },
    escalationReason: { type: String, trim: true },
    evidenceSummary: { type: String, trim: true },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decisionBy: { type: Schema.Types.ObjectId, ref: 'User' },
    decisionNotes: { type: String, trim: true },
    payerReferenceNumber: { type: String, trim: true },
    expectedReprocessBy: { type: Date },
    relatedPaymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    relatedEraId: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing' },
    readinessStatus: { type: String, trim: true },
    readinessReview: { type: Schema.Types.Mixed },
    packetGenerated: { type: Boolean, default: false },
    packetGeneratedAt: { type: Date },
    packetVersion: { type: Number, default: 0 },
    packetStatus: { type: String, trim: true, default: 'DRAFT' },
    packetFileReference: { type: String, trim: true },
    packetFileName: { type: String, trim: true },
    finalPacketGeneratedAt: { type: Date },
    finalPacketVersion: { type: Number, default: 0 },
    finalPacketFileReference: { type: String, trim: true },
    finalPacketFileName: { type: String, trim: true },
    packetSnapshot: { type: Schema.Types.Mixed },
    generatedAppealLetterText: { type: String, trim: true },
    aiPacketDraft: { type: Schema.Types.Mixed },
    aiPacketHistory: { type: [Schema.Types.Mixed], default: [] },
    diagnosisCodes: { type: [String], default: [] },
    procedureCodes: { type: [String], default: [] },
    medicalNecessityNotes: { type: String, trim: true },
    authorizationEvidence: { type: String, trim: true },
    eligibilityEvidence: { type: String, trim: true },
    priorPayerResponse: { type: String, trim: true },
    supportingDocumentsMetadata: { type: [Schema.Types.Mixed], default: [] },
    submissionChannel: { type: String, trim: true },
    submissionTracking: { type: Schema.Types.Mixed },
    submissionProof: { type: Schema.Types.Mixed },
    deadlineStatus: { type: String, trim: true },
    daysRemaining: { type: Number },
    recoveredAmount: { type: Number, default: 0 },
    payerRecoveredAmount: { type: Number, default: 0 },
    patientRecoveredAmount: { type: Number, default: 0 },
    contractualAdjustmentRecoveredAmount: { type: Number, default: 0 },
    recoveredAt: { type: Date },
    recoveryStatus: { type: String, trim: true, enum: ['NONE', 'PARTIAL', 'FULL'], default: 'NONE', index: true },
    recoveryPercent: { type: Number, default: 0 },
    statusHistory: { type: [Schema.Types.Mixed], default: [] },
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

appealSchema.virtual('createdAt').get(function () {
  return this.created;
});

appealSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

appealSchema.index({ isDeleted: 1, updated: -1 });
appealSchema.index({ appealLevel: 1 });
appealSchema.index({ appealStatus: 1 });
appealSchema.index({ packetStatus: 1 });
appealSchema.index({ readinessStatus: 1 });
appealSchema.index({ deadlineStatus: 1 });
appealSchema.index({ denialId: 1 });
appealSchema.index({ claimId: 1, appealStatus: 1 });
appealSchema.index({ dueDate: 1 });
appealSchema.index({ relatedPaymentPostingId: 1 });
appealSchema.index({ expectedReprocessBy: 1, appealStatus: 1 });
appealSchema.index({ payerResponseDueAt: 1, appealStatus: 1 });
appealSchema.index({ recoveryStatus: 1, recoveredAt: -1 });

appealSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

appealSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Appeal = model<IAppeal, IAppealModel>('Appeal', appealSchema);
