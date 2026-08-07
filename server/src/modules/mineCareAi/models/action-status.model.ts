import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type MineCareActionStatusValue = 'Open' | 'In Progress' | 'Completed';

export interface IMineCareActionStatus extends BaseDocument {
  actionStatusId: ObjectIdType;
  actionId: string;
  equipmentId?: string;
  priority: string;
  action: string;
  reason?: string;
  status: MineCareActionStatusValue;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareActionStatusModel extends Model<IMineCareActionStatus> {
  list(criteria: any): Promise<IMineCareActionStatus[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareActionStatusSchema = new Schema<IMineCareActionStatus, IMineCareActionStatusModel>(
  {
    actionStatusId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    actionId: { type: String, required: true, trim: true },
    equipmentId: { type: String, trim: true },
    priority: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    reason: { type: String, trim: true },
    status: { type: String, enum: ['Open', 'In Progress', 'Completed'], default: 'Open' },
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

mineCareActionStatusSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareActionStatusSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareActionStatusSchema.index(
  { actionId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
mineCareActionStatusSchema.index({ equipmentId: 1, isDeleted: 1 });
mineCareActionStatusSchema.index({ status: 1, isDeleted: 1 });

mineCareActionStatusSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareActionStatusSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareActionStatus = model<IMineCareActionStatus, IMineCareActionStatusModel>('MineCareActionStatus', mineCareActionStatusSchema);
