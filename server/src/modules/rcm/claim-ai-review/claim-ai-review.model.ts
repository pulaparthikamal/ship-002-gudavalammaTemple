import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IClaimAiReviewDenialPrediction {
  riskScore?: number;
  riskLevel?: string;
  predictedReasons?: string[];
  recommendedFixes?: string[];
  modelVersion?: string;
  predictedAt?: Date;
  confidenceScore?: number;
  reviewRequired?: boolean;
}

export interface IClaimAiReview extends BaseDocument {
  claimAiReviewId: ObjectIdType;
  claimId?: ObjectIdType;
  reviewStatus?: string;
  blockingReasons?: string[];
  overrideReason?: string;
  overriddenBy?: ObjectIdType;
  overriddenAt?: Date;
  denialPrediction?: IClaimAiReviewDenialPrediction;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClaimAiReviewModel extends Model<IClaimAiReview> {
  list(criteria: any): Promise<IClaimAiReview[]>;
  totalCount(criteria: any): Promise<number>;
}

const denialPredictionSchema = new Schema<IClaimAiReviewDenialPrediction>(
  {
    riskScore: { type: Number },
    riskLevel: { type: String, trim: true },
    predictedReasons: { type: [String], default: [] },
    recommendedFixes: { type: [String], default: [] },
    modelVersion: { type: String, trim: true },
    predictedAt: { type: Date },
    confidenceScore: { type: Number },
    reviewRequired: { type: Boolean, default: false },
  },
  { _id: false }
);

const claimAiReviewSchema = new Schema<IClaimAiReview, IClaimAiReviewModel>(
  {
    claimAiReviewId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', index: true },
    reviewStatus: { type: String, trim: true, default: 'Generated' },
    blockingReasons: { type: [String], default: [] },
    overrideReason: { type: String, trim: true },
    overriddenBy: { type: Schema.Types.ObjectId, ref: 'User' },
    overriddenAt: { type: Date },
    denialPrediction: { type: denialPredictionSchema, default: {} },
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

claimAiReviewSchema.virtual('createdAt').get(function () {
  return this.created;
});

claimAiReviewSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

claimAiReviewSchema.index({ isDeleted: 1, updated: -1 });
claimAiReviewSchema.index({ claimId: 1, updated: -1 });

claimAiReviewSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimAiReviewSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClaimAiReview = model<IClaimAiReview, IClaimAiReviewModel>('ClaimAiReview', claimAiReviewSchema);
