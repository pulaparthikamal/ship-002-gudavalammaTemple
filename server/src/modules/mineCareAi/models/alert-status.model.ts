import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type MineCareAlertStatusValue = 'Open' | 'Acknowledged' | 'Closed';

export interface IMineCareAlertStatus extends BaseDocument {
  alertStatusId: ObjectIdType;
  alertId: string;
  equipmentId?: string;
  alertType: string;
  title?: string;
  message: string;
  severity: string;
  status: MineCareAlertStatusValue;
  source?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareAlertStatusModel extends Model<IMineCareAlertStatus> {
  list(criteria: any): Promise<IMineCareAlertStatus[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareAlertStatusSchema = new Schema<IMineCareAlertStatus, IMineCareAlertStatusModel>(
  {
    alertStatusId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    alertId: { type: String, required: true, trim: true },
    equipmentId: { type: String, trim: true },
    alertType: { type: String, required: true, trim: true },
    title: { type: String, trim: true },
    message: { type: String, required: true, trim: true },
    severity: { type: String, required: true, trim: true },
    status: { type: String, enum: ['Open', 'Acknowledged', 'Closed'], default: 'Open' },
    source: { type: String, trim: true },
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

mineCareAlertStatusSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareAlertStatusSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareAlertStatusSchema.index(
  { alertId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
mineCareAlertStatusSchema.index({ equipmentId: 1, isDeleted: 1 });
mineCareAlertStatusSchema.index({ status: 1, isDeleted: 1 });

mineCareAlertStatusSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareAlertStatusSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareAlertStatus = model<IMineCareAlertStatus, IMineCareAlertStatusModel>('MineCareAlertStatus', mineCareAlertStatusSchema);
