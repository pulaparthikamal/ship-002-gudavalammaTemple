import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IDenial extends BaseDocument {
  denialId: ObjectIdType;
  claimId?: ObjectIdType;
  claimLineId?: ObjectIdType;
  paymentPostingId?: ObjectIdType;
  relatedPaymentPostingIds?: ObjectIdType[];
  eraEobProcessingId?: ObjectIdType;
  adjustmentId?: ObjectIdType;
  appealId?: ObjectIdType;
  correctedClaimId?: ObjectIdType;
  arWorkItemId?: ObjectIdType;
  patientId?: ObjectIdType;
  payerId?: string;
  cptCode?: string;
  denialCode?: string;
  carcCodes?: string[];
  rarcCodes?: string[];
  denialReason?: string;
  payerDenialReason?: string;
  denialCategory?: string;
  classificationExplanation?: string;
  denialSource?: string;
  denialDate?: Date;
  denialAmount?: number;
  adjustmentAmount?: number;
  denialBalance?: number;
  lineBilledAmount?: number;
  linePaidAmount?: number;
  lineAllowedAmount?: number;
  resolvedAmount?: number;
  remainingDeniedBalance?: number;
  matchConfidence?: number;
  matchedBy?: string[];
  allocationAmount?: number;
  manualReviewRequired?: boolean;
  paymentAllocations?: Array<Record<string, unknown>>;
  appealDeadline?: Date;
  serviceLineDetails?: Record<string, unknown>;
  preventableFlag?: boolean;
  rootCause?: string;
  owner?: string;
  priority?: string;
  denialStatus?: string;
  reworkType?: string;
  recommendedAction?: string;
  correctionEligible?: boolean;
  appealEligible?: boolean;
  recoveryRecommendation?: 'CORRECTED_CLAIM' | 'APPEAL' | 'WRITE_OFF';
  recommendationReason?: string;
  aiAnalysis?: Record<string, unknown>;
  aiRecommendationHistory?: Array<Record<string, unknown>>;
  aiConfidenceScore?: number;
  aiRecommendationSource?: string;
  slaDueAt?: Date;
  escalatedAt?: Date;
  escalationCount?: number;
  escalationReason?: string;
  transitionAudit?: Array<Record<string, unknown>>;
  resolutionDate?: Date;
  resolutionNotes?: string;
  statusHistory?: Array<Record<string, unknown>>;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IDenialModel extends Model<IDenial> {
  list(criteria: any): Promise<IDenial[]>;
  totalCount(criteria: any): Promise<number>;
}

const denialSchema = new Schema<IDenial, IDenialModel>(
  {
    denialId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    claimLineId: { type: Schema.Types.ObjectId },
    paymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    relatedPaymentPostingIds: { type: [Schema.Types.ObjectId], ref: 'PaymentPosting', default: [] },
    eraEobProcessingId: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing' },
    adjustmentId: { type: Schema.Types.ObjectId, ref: 'Adjustment' },
    appealId: { type: Schema.Types.ObjectId, ref: 'Appeal' },
    correctedClaimId: { type: Schema.Types.ObjectId, ref: 'CorrectedClaim' },
    arWorkItemId: { type: Schema.Types.ObjectId, ref: 'ArWorkItem' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    payerId: { type: String, trim: true },
    cptCode: { type: String, trim: true },
    denialCode: { type: String, trim: true },
    carcCodes: { type: [String], default: [] },
    rarcCodes: { type: [String], default: [] },
    denialReason: { type: String, trim: true },
    payerDenialReason: { type: String, trim: true },
    denialCategory: { type: String, trim: true },
    classificationExplanation: { type: String, trim: true },
    denialSource: { type: String, trim: true },
    denialDate: { type: Date },
    denialAmount: { type: Number },
    adjustmentAmount: { type: Number },
    denialBalance: { type: Number },
    lineBilledAmount: { type: Number },
    linePaidAmount: { type: Number },
    lineAllowedAmount: { type: Number },
    resolvedAmount: { type: Number, default: 0 },
    remainingDeniedBalance: { type: Number },
    matchConfidence: { type: Number },
    matchedBy: { type: [String], default: [] },
    allocationAmount: { type: Number },
    manualReviewRequired: { type: Boolean, default: false },
    paymentAllocations: { type: [Schema.Types.Mixed], default: [] },
    appealDeadline: { type: Date },
    serviceLineDetails: { type: Schema.Types.Mixed },
    preventableFlag: { type: Boolean, default: false },
    rootCause: { type: String, trim: true },
    owner: { type: String, trim: true },
    priority: { type: String, trim: true },
    denialStatus: { type: String, trim: true },
    reworkType: { type: String, trim: true },
    recommendedAction: { type: String, trim: true },
    correctionEligible: { type: Boolean, default: false },
    appealEligible: { type: Boolean, default: false },
    recoveryRecommendation: { type: String, trim: true, enum: ['CORRECTED_CLAIM', 'APPEAL', 'WRITE_OFF'] },
    recommendationReason: { type: String, trim: true },
    aiAnalysis: { type: Schema.Types.Mixed },
    aiRecommendationHistory: { type: [Schema.Types.Mixed], default: [] },
    aiConfidenceScore: { type: Number },
    aiRecommendationSource: { type: String, trim: true },
    slaDueAt: { type: Date, index: true },
    escalatedAt: { type: Date },
    escalationCount: { type: Number, default: 0 },
    escalationReason: { type: String, trim: true },
    transitionAudit: { type: [Schema.Types.Mixed], default: [] },
    resolutionDate: { type: Date },
    resolutionNotes: { type: String, trim: true },
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

denialSchema.virtual('createdAt').get(function () {
  return this.created;
});

denialSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

denialSchema.index({ isDeleted: 1, updated: -1 });
denialSchema.index({ denialCode: 1 });
denialSchema.index({ denialStatus: 1 });
denialSchema.index({ denialCategory: 1 });
denialSchema.index({ claimId: 1, denialStatus: 1 });
denialSchema.index({ paymentPostingId: 1 });
denialSchema.index({ appealId: 1 });
denialSchema.index({ arWorkItemId: 1 });
denialSchema.index({ eraEobProcessingId: 1 });
denialSchema.index({ slaDueAt: 1, denialStatus: 1 });

denialSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

denialSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Denial = model<IDenial, IDenialModel>('Denial', denialSchema);
