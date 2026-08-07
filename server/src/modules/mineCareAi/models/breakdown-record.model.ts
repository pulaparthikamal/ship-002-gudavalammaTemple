import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareBreakdownRecord extends BaseDocument {
  breakdownRecordId: ObjectIdType;
  equipmentId: string;
  breakdownDate: Date;
  failureType: string;
  component?: string;
  rootCause: string;
  repairCost: number;
  downtimeHours: number;
  warrantyClaimRaised: boolean;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareBreakdownRecordModel extends Model<IMineCareBreakdownRecord> {
  list(criteria: any): Promise<IMineCareBreakdownRecord[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareBreakdownRecordSchema = new Schema<IMineCareBreakdownRecord, IMineCareBreakdownRecordModel>(
  {
    breakdownRecordId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    equipmentId: { type: String, required: true, trim: true },
    breakdownDate: { type: Date, required: true },
    failureType: { type: String, required: true, trim: true },
    component: { type: String, trim: true },
    rootCause: { type: String, trim: true },
    repairCost: { type: Number, default: 0 },
    downtimeHours: { type: Number, default: 0 },
    warrantyClaimRaised: { type: Boolean, default: false },
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

mineCareBreakdownRecordSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareBreakdownRecordSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareBreakdownRecordSchema.index({ equipmentId: 1, breakdownDate: -1, isDeleted: 1 });
mineCareBreakdownRecordSchema.index({ isDeleted: 1, updated: -1 });

mineCareBreakdownRecordSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareBreakdownRecordSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareBreakdownRecord = model<IMineCareBreakdownRecord, IMineCareBreakdownRecordModel>('MineCareBreakdownRecord', mineCareBreakdownRecordSchema);
