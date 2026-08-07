import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IAdjustment extends BaseDocument {
  adjustmentId: ObjectIdType;
  eraEobProcessingId?: ObjectIdType;
  paymentPostingId?: ObjectIdType;
  claimId?: ObjectIdType;
  claimLineId?: ObjectIdType;
  adjustmentType?: string;
  adjustmentGroupCode?: string;
  adjustmentReasonCode?: string;
  adjustmentAmount?: number;
  remarkCodes?: string[];
  source?: string;
  writeOffFlag?: boolean;
  approvedBy?: string;
  adjustmentDate?: Date;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IAdjustmentModel extends Model<IAdjustment> {
  list(criteria: any): Promise<IAdjustment[]>;
  totalCount(criteria: any): Promise<number>;
}

const adjustmentSchema = new Schema<IAdjustment, IAdjustmentModel>(
  {
    adjustmentId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    eraEobProcessingId: { type: Schema.Types.ObjectId, ref: 'EraEobProcessing' },
    paymentPostingId: { type: Schema.Types.ObjectId, ref: 'PaymentPosting' },
    claimId: { type: Schema.Types.ObjectId, ref: 'Claim' },
    claimLineId: { type: Schema.Types.ObjectId },
    adjustmentType: { type: String, trim: true },
    adjustmentGroupCode: { type: String, trim: true },
    adjustmentReasonCode: { type: String, trim: true },
    adjustmentAmount: { type: Number },
    remarkCodes: { type: [String], default: [] },
    source: { type: String, trim: true },
    writeOffFlag: { type: Boolean, default: false },
    approvedBy: { type: String, trim: true },
    adjustmentDate: { type: Date },
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

adjustmentSchema.virtual('createdAt').get(function () {
  return this.created;
});

adjustmentSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

adjustmentSchema.index({ isDeleted: 1, updated: -1 });
adjustmentSchema.index({ adjustmentDate: 1 });
adjustmentSchema.index({ adjustmentType: 1 });
adjustmentSchema.index({ eraEobProcessingId: 1 });
adjustmentSchema.index({ paymentPostingId: 1 });

adjustmentSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

adjustmentSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Adjustment = model<IAdjustment, IAdjustmentModel>('Adjustment', adjustmentSchema);
