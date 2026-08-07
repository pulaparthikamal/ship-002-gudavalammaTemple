import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type MineCareWarrantyClaimStatusValue = 'Potential' | 'Submitted' | 'Approved' | 'Rejected';

export interface IMineCareWarrantyClaimStatus extends BaseDocument {
  warrantyClaimStatusId: ObjectIdType;
  claimId: string;
  equipmentId: string;
  component?: string;
  failureType: string;
  recoverableCost: number;
  status: MineCareWarrantyClaimStatusValue;
  recommendation: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareWarrantyClaimStatusModel extends Model<IMineCareWarrantyClaimStatus> {
  list(criteria: any): Promise<IMineCareWarrantyClaimStatus[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareWarrantyClaimStatusSchema = new Schema<IMineCareWarrantyClaimStatus, IMineCareWarrantyClaimStatusModel>(
  {
    warrantyClaimStatusId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    claimId: { type: String, required: true, trim: true },
    equipmentId: { type: String, required: true, trim: true },
    component: { type: String, trim: true },
    failureType: { type: String, required: true, trim: true },
    recoverableCost: { type: Number, default: 0 },
    status: { type: String, enum: ['Potential', 'Submitted', 'Approved', 'Rejected'], default: 'Potential' },
    recommendation: { type: String, trim: true },
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

mineCareWarrantyClaimStatusSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareWarrantyClaimStatusSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareWarrantyClaimStatusSchema.index(
  { claimId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
mineCareWarrantyClaimStatusSchema.index({ equipmentId: 1, isDeleted: 1 });
mineCareWarrantyClaimStatusSchema.index({ status: 1, isDeleted: 1 });

mineCareWarrantyClaimStatusSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareWarrantyClaimStatusSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareWarrantyClaimStatus = model<IMineCareWarrantyClaimStatus, IMineCareWarrantyClaimStatusModel>('MineCareWarrantyClaimStatus', mineCareWarrantyClaimStatusSchema);
