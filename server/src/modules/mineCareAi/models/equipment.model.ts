import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export type MineCareStatus = 'Operational' | 'Under Maintenance' | 'Breakdown' | 'Retired';
export type MineCareCriticality = 'Low' | 'Medium' | 'High' | 'Critical';

export interface IMineCareEquipment extends BaseDocument {
  equipmentRecordId: ObjectIdType;
  equipmentId: string;
  name: string;
  type: string;
  brand: string;
  modelName: string;
  serialNumber: string;
  location: string;
  department: string;
  purchaseDate: Date;
  invoiceValue: number;
  vendor: string;
  currentRunningHours: number;
  averageDailyUsage: number;
  status: MineCareStatus;
  criticality: MineCareCriticality;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareEquipmentModel extends Model<IMineCareEquipment> {
  list(criteria: any): Promise<IMineCareEquipment[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareEquipmentSchema = new Schema<IMineCareEquipment, IMineCareEquipmentModel>(
  {
    equipmentRecordId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    equipmentId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    brand: { type: String, trim: true },
    modelName: { type: String, trim: true },
    serialNumber: { type: String, trim: true },
    location: { type: String, trim: true },
    department: { type: String, trim: true },
    purchaseDate: { type: Date, required: true },
    invoiceValue: { type: Number, default: 0 },
    vendor: { type: String, trim: true },
    currentRunningHours: { type: Number, default: 0 },
    averageDailyUsage: { type: Number, default: 8 },
    status: { type: String, enum: ['Operational', 'Under Maintenance', 'Breakdown', 'Retired'], default: 'Operational' },
    criticality: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
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

mineCareEquipmentSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareEquipmentSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareEquipmentSchema.index(
  { equipmentId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
mineCareEquipmentSchema.index({ isDeleted: 1, updated: -1 });
mineCareEquipmentSchema.index({ name: 1 });
mineCareEquipmentSchema.index({ type: 1 });
mineCareEquipmentSchema.index({ status: 1 });
mineCareEquipmentSchema.index({ criticality: 1 });

mineCareEquipmentSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareEquipmentSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareEquipment = model<IMineCareEquipment, IMineCareEquipmentModel>('MineCareEquipment', mineCareEquipmentSchema);
