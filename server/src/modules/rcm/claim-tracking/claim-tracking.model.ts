import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IClaimTracking extends BaseDocument {
  trackingId: ObjectIdType;
  claimId?: ObjectIdType;
  claimSubmissionId?: ObjectIdType;
  timestamp?: Date;
  source?: string;
  trackingSource?: 'REAL' | 'SIMULATED';
  responseType?: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE';
  eventType?:
    | 'SUBMISSION_CREATED'
    | 'SUBMISSION_SENT'
    | 'SUBMISSION_FAILED'
    | 'ACK_999_ACCEPTED'
    | 'ACK_999_REJECTED'
    | 'ACK_277CA_ACCEPTED'
    | 'ACK_277CA_REJECTED'
    | 'CLAIM_PENDING'
    | 'CLAIM_STATUS_UPDATED';
  normalizedStatus?: 'DRAFT' | 'READY' | 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
  rawStatusCode?: string;
  summary?: string;
  controlNumber?: string;
  externalSubmissionId?: string;
  claimControlNumber?: string;
  clearinghouseTraceNumber?: string;
  payerClaimNumber?: string;
  acknowledgementType?: string;
  statusCode?: string;
  statusDescription?: string;
  receivedDate?: Date;
  rejectionLevel?: string;
  rejectionSource?: string;
  rejectionReasonCodes?: string[];
  stcCategoryCode?: string;
  stcStatusCode?: string;
  stcEntityCode?: string;
  affectedServiceLine?: string;
  remediationCode?: string;
  remediationFieldPath?: string;
  remediationSeverity?: string;
  nextActionRequired?: string;
  responseStatusCode?: number;
  responsePayloadRedacted?: string;
  aiRejectionAnalysis?: Record<string, unknown>;
  aiRecommendationHistory?: Array<Record<string, unknown>>;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClaimTrackingModel extends Model<IClaimTracking> {
  list(criteria: any): Promise<IClaimTracking[]>;
  totalCount(criteria: any): Promise<number>;
}

const claimTrackingSchema = new Schema<IClaimTracking, IClaimTrackingModel>(
  {
    trackingId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    claimSubmissionId: { type: Schema.Types.ObjectId, ref: 'ClaimSubmission', index: true },
    timestamp: { type: Date, default: Date.now, index: true },
    source: { type: String, trim: true },
    trackingSource: { type: String, enum: ['REAL', 'SIMULATED'], default: 'REAL', index: true },
    responseType: {
      type: String,
      enum: ['SUBMISSION', 'ACK_999', 'ACK_277CA', 'STATUS_UPDATE'],
      default: 'STATUS_UPDATE',
      index: true,
    },
    eventType: {
      type: String,
      enum: [
        'SUBMISSION_CREATED',
        'SUBMISSION_SENT',
        'SUBMISSION_FAILED',
        'ACK_999_ACCEPTED',
        'ACK_999_REJECTED',
        'ACK_277CA_ACCEPTED',
        'ACK_277CA_REJECTED',
        'CLAIM_PENDING',
        'CLAIM_STATUS_UPDATED',
      ],
      default: 'CLAIM_STATUS_UPDATED',
      index: true,
    },
    normalizedStatus: {
      type: String,
      enum: ['DRAFT', 'READY', 'SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    rawStatusCode: { type: String, trim: true },
    summary: { type: String, trim: true },
    controlNumber: { type: String, trim: true },
    externalSubmissionId: { type: String, trim: true, index: true },
    claimControlNumber: { type: String, trim: true },
    clearinghouseTraceNumber: { type: String, trim: true },
    payerClaimNumber: { type: String, trim: true },
    acknowledgementType: { type: String, trim: true },
    statusCode: { type: String, trim: true },
    statusDescription: { type: String, trim: true },
    receivedDate: { type: Date },
    rejectionLevel: { type: String, trim: true },
    rejectionSource: { type: String, trim: true },
    rejectionReasonCodes: { type: [String], default: [] },
    stcCategoryCode: { type: String, trim: true, index: true },
    stcStatusCode: { type: String, trim: true, index: true },
    stcEntityCode: { type: String, trim: true },
    affectedServiceLine: { type: String, trim: true },
    remediationCode: { type: String, trim: true, index: true },
    remediationFieldPath: { type: String, trim: true },
    remediationSeverity: { type: String, enum: ['BLOCKING', 'WARNING'] },
    nextActionRequired: { type: String, trim: true },
    responseStatusCode: { type: Number },
    responsePayloadRedacted: { type: String },
    aiRejectionAnalysis: { type: Schema.Types.Mixed },
    aiRecommendationHistory: { type: [Schema.Types.Mixed], default: [] },
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

claimTrackingSchema.virtual('createdAt').get(function () {
  return this.created;
});

claimTrackingSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

claimTrackingSchema.index({ isDeleted: 1, updated: -1 });
claimTrackingSchema.index({ claimId: 1, timestamp: -1, created: -1 });
claimTrackingSchema.index({ claimId: 1, normalizedStatus: 1 });
claimTrackingSchema.index({ claimControlNumber: 1 });
claimTrackingSchema.index({ statusCode: 1 });

claimTrackingSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimTrackingSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClaimTracking = model<IClaimTracking, IClaimTrackingModel>('ClaimTracking', claimTrackingSchema);
