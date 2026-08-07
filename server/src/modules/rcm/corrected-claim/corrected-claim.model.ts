import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface ICorrectedClaim extends BaseDocument {
  correctedClaimId: ObjectIdType;
  originalClaimId?: ObjectIdType;
  denialId?: ObjectIdType;
  sourceDenialId?: ObjectIdType;
  correctedFromClaimId?: ObjectIdType;
  clonedClaimId?: ObjectIdType;
  correctionReason?: string;
  correctionType?: string;
  frequencyCode?: string;
  resubmissionReason?: string;
  correctedFrequencyCode?: string;
  correctedClaimStatus?: string;
  correctedFieldsChanged?: string[];
  correctedFields?: Array<Record<string, unknown>>;
  lineageChain?: ObjectIdType[];
  correctionAudit?: Array<Record<string, unknown>>;
  submittedDate?: Date;
  closedAt?: Date;
  closedBy?: ObjectIdType | string;
  closureReason?: string;
  agingDueAt?: Date;
  escalatedAt?: Date;
  escalationCount?: number;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface ICorrectedClaimModel extends Model<ICorrectedClaim> {
  list(criteria: any): Promise<ICorrectedClaim[]>;
  totalCount(criteria: any): Promise<number>;
}

const correctedClaimSchema = new Schema<ICorrectedClaim, ICorrectedClaimModel>(
  {
    correctedClaimId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    originalClaimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    denialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    sourceDenialId: { type: Schema.Types.ObjectId, ref: 'Denial' },
    correctedFromClaimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    clonedClaimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    correctionReason: { type: String, trim: true },
    correctionType: { type: String, trim: true },
    frequencyCode: { type: String, trim: true },
    resubmissionReason: { type: String, trim: true },
    correctedFrequencyCode: { type: String, trim: true },
    correctedClaimStatus: { type: String, trim: true },
    correctedFieldsChanged: { type: [String], default: [] },
    correctedFields: { type: [Schema.Types.Mixed], default: [] },
    lineageChain: { type: [Schema.Types.ObjectId], default: [] },
    correctionAudit: { type: [Schema.Types.Mixed], default: [] },
    submittedDate: { type: Date },
    closedAt: { type: Date },
    closedBy: { type: Schema.Types.Mixed },
    closureReason: { type: String, trim: true },
    agingDueAt: { type: Date, index: true },
    escalatedAt: { type: Date },
    escalationCount: { type: Number, default: 0 },
    notes: { type: String, trim: true },
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

correctedClaimSchema.virtual('createdAt').get(function () {
  return this.created;
});

correctedClaimSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

correctedClaimSchema.index({ isDeleted: 1, updated: -1 });
correctedClaimSchema.index({ submittedDate: 1 });
correctedClaimSchema.index({ correctedClaimStatus: 1 });
correctedClaimSchema.index({ denialId: 1 });
correctedClaimSchema.index({ sourceDenialId: 1 });
correctedClaimSchema.index({ clonedClaimId: 1 });
correctedClaimSchema.index({ originalClaimId: 1, correctedClaimStatus: 1 });

correctedClaimSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

correctedClaimSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const CorrectedClaim = model<ICorrectedClaim, ICorrectedClaimModel>('CorrectedClaim', correctedClaimSchema);
