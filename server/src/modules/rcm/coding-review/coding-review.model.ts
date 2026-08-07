import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';
import {
  CODING_REVIEW_RISK_LEVEL_OPTIONS,
  CODING_REVIEW_SCRUB_STATUS_OPTIONS,
} from './coding-review.constants';
import { IStatusHistoryEntry, statusHistorySchema } from '../workflow/workflow-history';

export interface ICodingReview extends BaseDocument {
  scrubId: ObjectIdType;
  chargeId?: ObjectIdType;
  encounterId?: ObjectIdType;
  patientId?: ObjectIdType;
  scrubStatus?: string;
  codingRiskLevel?: string;
  missingDocumentationFlag?: boolean;
  modifierIssues?: string[];
  icdCptMismatchFlag?: boolean;
  ncciEditFlag?: boolean;
  lcdNcdEditFlag?: boolean;
  payerSpecificRuleFailures?: string[];
  aiSuggestedCodes?: string[];
  aiSuggestedFixes?: string[];
  codingFailureExplanations?: Array<{
    lineNumber?: number;
    field: string;
    title: string;
    explanation: string;
    correction: string;
    source: string;
  }>;
  reviewedBy?: string;
  reviewedAt?: Date;
  codingValidationResults?: Array<{
    code: string;
    codeType: string;
    status: string;
    reasoning: string;
    suggestedAlternative?: string;
  }>;
  approvedCodingSnapshot?: {
    sourceChargeUpdatedAt?: Date;
    snapshotHash?: string;
    approvedAt?: Date;
    lines?: Array<{
      lineNumber?: number;
      chargeLineId?: ObjectIdType;
      cptCode?: string;
      modifiers?: string[];
      icdCodes?: string[];
      icdPointers?: number[];
      units?: number;
      chargeAmount?: number;
      placeOfService?: string;
      renderingProviderId?: ObjectIdType;
      serviceDateFrom?: Date;
      serviceDateTo?: Date;
    }>;
  };
  validationErrors?: string[];
  statusHistory?: IStatusHistoryEntry[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface ICodingReviewModel extends Model<ICodingReview> {
  list(criteria: any): Promise<ICodingReview[]>;
  totalCount(criteria: any): Promise<number>;
}

const codingReviewSchema = new Schema<ICodingReview, ICodingReviewModel>(
  {
    scrubId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    chargeId: { type: Schema.Types.ObjectId, ref: 'Charge' },
    encounterId: { type: Schema.Types.ObjectId, ref: 'Encounter' },
    patientId: { type: Schema.Types.ObjectId, ref: 'Patient' },
    scrubStatus: {
      type: String,
      trim: true,
      enum: CODING_REVIEW_SCRUB_STATUS_OPTIONS,
      default: 'Pending',
    },
    codingRiskLevel: { type: String, trim: true, enum: CODING_REVIEW_RISK_LEVEL_OPTIONS, default: 'Low' },
    missingDocumentationFlag: { type: Boolean, default: false },
    modifierIssues: { type: [String], default: [] },
    icdCptMismatchFlag: { type: Boolean, default: false },
    ncciEditFlag: { type: Boolean, default: false },
    lcdNcdEditFlag: { type: Boolean, default: false },
    payerSpecificRuleFailures: { type: [String], default: [] },
    validationErrors: { type: [String], default: [] },
    aiSuggestedCodes: { type: [String], default: [] },
    aiSuggestedFixes: { type: [String], default: [] },
    codingFailureExplanations: {
      type: [
        {
          lineNumber: { type: Number },
          field: { type: String, trim: true },
          title: { type: String, trim: true },
          explanation: { type: String, trim: true },
          correction: { type: String, trim: true },
          source: { type: String, trim: true },
        },
      ],
      default: [],
    },
    reviewedBy: { type: String, trim: true },
    reviewedAt: { type: Date },
    codingValidationResults: {
      type: [
        {
          code: { type: String, trim: true },
          codeType: { type: String, trim: true },
          status: { type: String, trim: true },
          reasoning: { type: String, trim: true },
          suggestedAlternative: { type: String, trim: true },
        },
      ],
      default: [],
    },
    approvedCodingSnapshot: {
      sourceChargeUpdatedAt: { type: Date },
      snapshotHash: { type: String, trim: true },
      approvedAt: { type: Date },
      lines: {
        type: [
          {
            lineNumber: { type: Number },
            chargeLineId: { type: Schema.Types.ObjectId },
            cptCode: { type: String, trim: true },
            modifiers: { type: [String], default: [] },
            icdCodes: { type: [String], default: [] },
            icdPointers: { type: [Number], default: [] },
            units: { type: Number },
            chargeAmount: { type: Number },
            placeOfService: { type: String, trim: true },
            renderingProviderId: { type: Schema.Types.ObjectId, ref: 'Provider' },
            serviceDateFrom: { type: Date },
            serviceDateTo: { type: Date },
          },
        ],
        default: [],
      },
    },
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

codingReviewSchema.virtual('createdAt').get(function () {
  return this.created;
});

codingReviewSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

codingReviewSchema.index({ isDeleted: 1, updated: -1 });
codingReviewSchema.index({ scrubStatus: 1 });
codingReviewSchema.index({ codingRiskLevel: 1 });
codingReviewSchema.index({ chargeId: 1 });

codingReviewSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

codingReviewSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const CodingReview = model<ICodingReview, ICodingReviewModel>('CodingReview', codingReviewSchema);
