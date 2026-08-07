import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareMaintenanceHistory extends BaseDocument {
  maintenanceHistoryId: ObjectIdType;
  equipmentId: string;
  serviceDate: Date;
  serviceType: string;
  runningHours?: number;
  actionTaken: string;
  technician: string;
  cost: number;
  downtimeHours: number;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareMaintenanceHistoryModel extends Model<IMineCareMaintenanceHistory> {
  list(criteria: any): Promise<IMineCareMaintenanceHistory[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareMaintenanceHistorySchema = new Schema<IMineCareMaintenanceHistory, IMineCareMaintenanceHistoryModel>(
  {
    maintenanceHistoryId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    equipmentId: { type: String, required: true, trim: true },
    serviceDate: { type: Date, required: true },
    serviceType: { type: String, required: true, trim: true },
    runningHours: { type: Number },
    actionTaken: { type: String, trim: true },
    technician: { type: String, trim: true },
    cost: { type: Number, default: 0 },
    downtimeHours: { type: Number, default: 0 },
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

mineCareMaintenanceHistorySchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareMaintenanceHistorySchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareMaintenanceHistorySchema.index({ equipmentId: 1, serviceDate: -1, isDeleted: 1 });
mineCareMaintenanceHistorySchema.index({ isDeleted: 1, updated: -1 });

mineCareMaintenanceHistorySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareMaintenanceHistorySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareMaintenanceHistory = model<IMineCareMaintenanceHistory, IMineCareMaintenanceHistoryModel>('MineCareMaintenanceHistory', mineCareMaintenanceHistorySchema);
