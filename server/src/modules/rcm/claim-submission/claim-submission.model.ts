import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IClaimSubmission extends BaseDocument {
  submissionId: ObjectIdType;
  claimId?: ObjectIdType;
  previousSubmissionId?: ObjectIdType;
  submissionType?: string;
  submissionMethod?: string;
  submissionFileType?: string;
  payloadFormat?: string;
  submissionDateTime?: Date;
  clearinghouseName?: string;
  clearinghouseEndpoint?: string;
  batchId?: string;
  submissionTraceId?: string;
  externalSubmissionId?: string;
  externalBatchId?: string;
  controlNumber?: string;
  claimControlNumber?: string;
  clearinghouseTraceNumber?: string;
  payerClaimNumber?: string;
  idempotencyKey?: string;
  retrySequence?: number;
  retryCount?: number;
  retryable?: boolean;
  lastRetryAt?: Date;
  payloadSnapshot?: string;
  requestPayloadRedacted?: string;
  responsePayloadRedacted?: string;
  trackingSource?: 'REAL' | 'SIMULATED';
  responseType?: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE';
  normalizedStatus?: 'DRAFT' | 'READY' | 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED';
  status?: string;
  transmissionStatus?: string;
  acknowledgementStatus?: string;
  acknowledgementType?: string;
  acknowledgementDateTime?: Date;
  responseStatusCode?: number;
  rawResponsePayload?: string;
  rawAcknowledgementPayload?: string;
  submissionErrorCode?: string;
  submissionErrorMessage?: string;
  lastError?: string;
  submittedAt?: Date;
  submittedBy?: ObjectIdType;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClaimSubmissionModel extends Model<IClaimSubmission> {
  list(criteria: any): Promise<IClaimSubmission[]>;
  totalCount(criteria: any): Promise<number>;
}

const claimSubmissionSchema = new Schema<IClaimSubmission, IClaimSubmissionModel>(
  {
    submissionId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    previousSubmissionId: { type: Schema.Types.ObjectId, ref: 'ClaimSubmission' },
    submissionType: { type: String, trim: true },
    submissionMethod: { type: String, trim: true },
    submissionFileType: { type: String, trim: true },
    payloadFormat: { type: String, trim: true },
    submissionDateTime: { type: Date },
    clearinghouseName: { type: String, trim: true },
    clearinghouseEndpoint: { type: String, trim: true },
    batchId: { type: String, trim: true },
    submissionTraceId: { type: String, trim: true },
    externalSubmissionId: { type: String, trim: true },
    externalBatchId: { type: String, trim: true },
    controlNumber: { type: String, trim: true },
    claimControlNumber: { type: String, trim: true },
    clearinghouseTraceNumber: { type: String, trim: true },
    payerClaimNumber: { type: String, trim: true },
    idempotencyKey: { type: String, trim: true },
    retrySequence: { type: Number, default: 1 },
    retryCount: { type: Number, default: 0 },
    retryable: { type: Boolean, default: false },
    lastRetryAt: { type: Date },
    payloadSnapshot: { type: String },
    requestPayloadRedacted: { type: String },
    responsePayloadRedacted: { type: String },
    trackingSource: { type: String, enum: ['REAL', 'SIMULATED'], default: 'REAL', index: true },
    responseType: {
      type: String,
      enum: ['SUBMISSION', 'ACK_999', 'ACK_277CA', 'STATUS_UPDATE'],
      default: 'SUBMISSION',
      index: true,
    },
    normalizedStatus: {
      type: String,
      enum: ['DRAFT', 'READY', 'SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'FAILED'],
      default: 'PENDING',
      index: true,
    },
    status: { type: String, trim: true },
    transmissionStatus: { type: String, trim: true },
    acknowledgementStatus: { type: String, trim: true },
    acknowledgementType: { type: String, trim: true },
    acknowledgementDateTime: { type: Date },
    responseStatusCode: { type: Number },
    rawResponsePayload: { type: String },
    rawAcknowledgementPayload: { type: String },
    submissionErrorCode: { type: String, trim: true },
    submissionErrorMessage: { type: String, trim: true },
    lastError: { type: String, trim: true },
    submittedAt: { type: Date },
    submittedBy: { type: Schema.Types.ObjectId, ref: 'User' },
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

claimSubmissionSchema.virtual('createdAt').get(function () {
  return this.created;
});

claimSubmissionSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

claimSubmissionSchema.index({ isDeleted: 1, updated: -1 });
claimSubmissionSchema.index({ claimId: 1, submissionDateTime: -1 });
claimSubmissionSchema.index({ batchId: 1 });
claimSubmissionSchema.index({ submissionTraceId: 1 }, { unique: true, sparse: true });
claimSubmissionSchema.index({ externalSubmissionId: 1 }, { sparse: true });
claimSubmissionSchema.index({ idempotencyKey: 1, retrySequence: 1 }, { sparse: true });
claimSubmissionSchema.index({ transmissionStatus: 1, acknowledgementStatus: 1 });
claimSubmissionSchema.index({ normalizedStatus: 1, trackingSource: 1 });

claimSubmissionSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimSubmissionSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClaimSubmission = model<IClaimSubmission, IClaimSubmissionModel>('ClaimSubmission', claimSubmissionSchema);
