import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IClaimRejectionAiSuggestion {
  rootCause?: string;
  suggestion?: string;
  confidence?: number;
  modelVersion?: string;
  generatedAt?: Date;
}

export interface IClaimRejection extends BaseDocument {
  claimRejectionId: ObjectIdType;
  claimId?: ObjectIdType;
  claimSubmissionId?: ObjectIdType;
  rejectionCode?: string;
  rejectionReason?: string;
  payerResponse?: Record<string, unknown>;
  category?: string;
  status?: string;
  resolvedAt?: Date;
  resolvedBy?: ObjectIdType;
  resubmittedClaimId?: ObjectIdType;
  originalClaimSnapshot?: Record<string, unknown>;
  correctedFields?: string[];
  aiSuggestion?: IClaimRejectionAiSuggestion;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClaimRejectionModel extends Model<IClaimRejection> {
  list(criteria: any): Promise<IClaimRejection[]>;
  totalCount(criteria: any): Promise<number>;
}

const aiSuggestionSchema = new Schema<IClaimRejectionAiSuggestion>(
  {
    rootCause: { type: String, trim: true },
    suggestion: { type: String, trim: true },
    confidence: { type: Number },
    modelVersion: { type: String, trim: true },
    generatedAt: { type: Date },
  },
  { _id: false }
);

const claimRejectionSchema = new Schema<IClaimRejection, IClaimRejectionModel>(
  {
    claimRejectionId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', index: true },
    claimSubmissionId: { type: Schema.Types.ObjectId, ref: 'ClaimSubmission', index: true },
    rejectionCode: { type: String, trim: true },
    rejectionReason: { type: String, trim: true },
    payerResponse: { type: Schema.Types.Mixed },
    category: { type: String, trim: true },
    status: { type: String, trim: true, default: 'Open', index: true },
    resolvedAt: { type: Date },
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    resubmittedClaimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    originalClaimSnapshot: { type: Schema.Types.Mixed },
    correctedFields: { type: [String], default: [] },
    aiSuggestion: { type: aiSuggestionSchema },
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

claimRejectionSchema.virtual('createdAt').get(function () {
  return this.created;
});

claimRejectionSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

claimRejectionSchema.index({ isDeleted: 1, updated: -1 });
claimRejectionSchema.index({ claimId: 1, status: 1, created: -1 });
claimRejectionSchema.index({ claimSubmissionId: 1, rejectionCode: 1 }, { sparse: true });

claimRejectionSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimRejectionSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClaimRejection = model<IClaimRejection, IClaimRejectionModel>('ClaimRejection', claimRejectionSchema);
