import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareSparePart extends BaseDocument {
  sparePartId: ObjectIdType;
  partNumber: string;
  partName: string;
  currentStock: number;
  minimumStock: number;
  leadTimeDays: number;
  unitCost: number;
  compatibleEquipmentTypes: string[];
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareSparePartModel extends Model<IMineCareSparePart> {
  list(criteria: any): Promise<IMineCareSparePart[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareSparePartSchema = new Schema<IMineCareSparePart, IMineCareSparePartModel>(
  {
    sparePartId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    partNumber: { type: String, required: true, trim: true },
    partName: { type: String, required: true, trim: true },
    currentStock: { type: Number, default: 0 },
    minimumStock: { type: Number, default: 0 },
    leadTimeDays: { type: Number, default: 0 },
    unitCost: { type: Number, default: 0 },
    compatibleEquipmentTypes: { type: [String], default: [] },
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

mineCareSparePartSchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareSparePartSchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareSparePartSchema.index(
  { partNumber: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
mineCareSparePartSchema.index({ isDeleted: 1, updated: -1 });

mineCareSparePartSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareSparePartSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareSparePart = model<IMineCareSparePart, IMineCareSparePartModel>('MineCareSparePart', mineCareSparePartSchema);
