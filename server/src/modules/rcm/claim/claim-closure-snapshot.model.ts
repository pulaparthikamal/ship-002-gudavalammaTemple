import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IClaimClosureSnapshot extends BaseDocument {
  claimClosureSnapshotId: ObjectIdType;
  claimId: ObjectIdType;
  claimBusinessId?: string;
  eventType: string;
  closureStatus?: string;
  reason?: string;
  canClose: boolean;
  blockers: string[];
  counts?: Record<string, unknown>;
  financial?: Record<string, unknown>;
  claimStatusSnapshot?: Record<string, unknown>;
  financialLedgerSequence?: number;
  financialLedgerHeadHash?: string;
  snapshotSequence: number;
  previousSnapshotHash?: string;
  snapshotHash: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType | string;
  updatedBy?: ObjectIdType | string;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IClaimClosureSnapshotModel extends Model<IClaimClosureSnapshot> {
  list(criteria: any): Promise<IClaimClosureSnapshot[]>;
  totalCount(criteria: any): Promise<number>;
}

const claimClosureSnapshotSchema = new Schema<IClaimClosureSnapshot, IClaimClosureSnapshotModel>(
  {
    claimClosureSnapshotId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim', required: true, index: true, immutable: true },
    claimBusinessId: { type: String, trim: true, immutable: true },
    eventType: { type: String, trim: true, required: true, index: true, immutable: true },
    closureStatus: { type: String, trim: true, immutable: true },
    reason: { type: String, trim: true, immutable: true },
    canClose: { type: Boolean, required: true, immutable: true },
    blockers: { type: [String], default: [], immutable: true },
    counts: { type: Schema.Types.Mixed, immutable: true },
    financial: { type: Schema.Types.Mixed, immutable: true },
    claimStatusSnapshot: { type: Schema.Types.Mixed, immutable: true },
    financialLedgerSequence: { type: Number, immutable: true },
    financialLedgerHeadHash: { type: String, trim: true, immutable: true },
    snapshotSequence: { type: Number, required: true, index: true, immutable: true },
    previousSnapshotHash: { type: String, trim: true, immutable: true },
    snapshotHash: { type: String, trim: true, required: true, index: true, immutable: true },
    active: { type: Boolean, default: true, immutable: true },
    created: { type: Date, default: Date.now, immutable: true },
    updated: { type: Date, default: Date.now, immutable: true },
    createdBy: { type: Schema.Types.Mixed, immutable: true },
    updatedBy: { type: Schema.Types.Mixed, immutable: true },
    isDeleted: { type: Boolean, default: false, immutable: true },
    deletedAt: { type: Date, immutable: true },
  },
  {
    timestamps: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

claimClosureSnapshotSchema.virtual('createdAt').get(function () {
  return this.created;
});

claimClosureSnapshotSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

claimClosureSnapshotSchema.index({ claimId: 1, snapshotSequence: 1 }, { unique: true });
claimClosureSnapshotSchema.index({ claimId: 1, snapshotHash: 1 }, { unique: true });
claimClosureSnapshotSchema.index({ claimId: 1, eventType: 1, created: -1 });
claimClosureSnapshotSchema.index({ isDeleted: 1, updated: -1 });

claimClosureSnapshotSchema.pre('save', function (next) {
  if (!this.isNew) {
    next(new Error('Claim closure snapshots are append-only and cannot be modified.'));
    return;
  }
  next();
});

function rejectSnapshotMutation(next: (err?: Error) => void) {
  next(new Error('Claim closure snapshots are append-only and cannot be updated or deleted.'));
}

claimClosureSnapshotSchema.pre('updateOne', rejectSnapshotMutation);
claimClosureSnapshotSchema.pre('updateMany', rejectSnapshotMutation);
claimClosureSnapshotSchema.pre('findOneAndUpdate', rejectSnapshotMutation);
claimClosureSnapshotSchema.pre('replaceOne', rejectSnapshotMutation);
claimClosureSnapshotSchema.pre('deleteOne', rejectSnapshotMutation);
claimClosureSnapshotSchema.pre('deleteMany', rejectSnapshotMutation);
claimClosureSnapshotSchema.pre('findOneAndDelete', rejectSnapshotMutation);

claimClosureSnapshotSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

claimClosureSnapshotSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ClaimClosureSnapshot = model<IClaimClosureSnapshot, IClaimClosureSnapshotModel>(
  'ClaimClosureSnapshot',
  claimClosureSnapshotSchema
);
