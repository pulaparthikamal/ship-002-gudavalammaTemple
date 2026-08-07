import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type RcmBackgroundJobType =
  | 'PROCESS_CLEARINGHOUSE_EVENT'
  | 'PROCESS_999_277CA'
  | 'PROCESS_835_ERA'
  | 'CLAIM_STATUS_POLL'
  | 'CLAIM_SUBMISSION_RETRY'
  | 'PROCESS_PAYMENT_POSTING'
  | 'CREATE_DENIAL_FROM_REJECTION'
  | 'CREATE_DENIAL_FROM_UNDERPAYMENT'
  | 'PROCESS_ERA_EXCEPTION'
  | 'CHECK_AWAITING_ERA_AGING'
  | 'CHECK_DENIAL_SLA_AGING'
  | 'CHECK_APPEAL_SLA_AGING'
  | 'CHECK_CORRECTED_CLAIM_AGING'
  | 'RECOVER_STALE_QUEUE_JOBS';

export type RcmBackgroundJobStatus = 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'DEAD_LETTER' | 'STALE';

export interface IRcmBackgroundJob extends BaseDocument {
  jobId: ObjectIdType;
  jobType: RcmBackgroundJobType;
  status: RcmBackgroundJobStatus;
  idempotencyKey: string;
  payload?: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  nextRunAt?: Date;
  startedAt?: Date;
  completedAt?: Date;
  staleAt?: Date;
  recoveredAt?: Date;
  recoveryAttemptCount?: number;
  lastError?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType | string;
  updatedBy?: ObjectIdType | string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IRcmBackgroundJobModel extends Model<IRcmBackgroundJob> {
  list(criteria: any): Promise<IRcmBackgroundJob[]>;
  totalCount(criteria: any): Promise<number>;
}

const rcmBackgroundJobSchema = new Schema<IRcmBackgroundJob, IRcmBackgroundJobModel>(
  {
    jobId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    jobType: {
      type: String,
      enum: [
        'PROCESS_CLEARINGHOUSE_EVENT',
        'PROCESS_999_277CA',
        'PROCESS_835_ERA',
        'CLAIM_STATUS_POLL',
        'CLAIM_SUBMISSION_RETRY',
        'PROCESS_PAYMENT_POSTING',
        'CREATE_DENIAL_FROM_REJECTION',
        'CREATE_DENIAL_FROM_UNDERPAYMENT',
        'PROCESS_ERA_EXCEPTION',
        'CHECK_AWAITING_ERA_AGING',
        'CHECK_DENIAL_SLA_AGING',
        'CHECK_APPEAL_SLA_AGING',
        'CHECK_CORRECTED_CLAIM_AGING',
        'RECOVER_STALE_QUEUE_JOBS',
      ],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'DEAD_LETTER', 'STALE'],
      default: 'QUEUED',
      index: true,
    },
    idempotencyKey: { type: String, required: true, trim: true, unique: true },
    payload: { type: Schema.Types.Mixed },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 3 },
    nextRunAt: { type: Date, default: Date.now, index: true },
    startedAt: { type: Date },
    completedAt: { type: Date },
    staleAt: { type: Date },
    recoveredAt: { type: Date },
    recoveryAttemptCount: { type: Number, default: 0 },
    lastError: { type: String, trim: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.Mixed },
    updatedBy: { type: Schema.Types.Mixed },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

rcmBackgroundJobSchema.virtual('createdAt').get(function () {
  return this.created;
});

rcmBackgroundJobSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

rcmBackgroundJobSchema.index({ isDeleted: 1, updated: -1 });
rcmBackgroundJobSchema.index({ jobType: 1, status: 1, nextRunAt: 1 });
rcmBackgroundJobSchema.index({ status: 1, startedAt: 1 });

rcmBackgroundJobSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

rcmBackgroundJobSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const RcmBackgroundJob = model<IRcmBackgroundJob, IRcmBackgroundJobModel>('RcmBackgroundJob', rcmBackgroundJobSchema);
