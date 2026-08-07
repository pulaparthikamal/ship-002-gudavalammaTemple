import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareProcurementOption extends BaseDocument {
  optionId: string;
  name: string;
  equipmentType: string;
  vendor: string;
  purchaseCost: number;
  warrantyYears: number;
  expectedMaintenanceCost: number;
  fuelCost: number;
  expectedLifeYears: number;
  resaleValue: number;
  downtimeRiskCost: number;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareProcurementOptionModel extends Model<IMineCareProcurementOption> {
  list(criteria: any): Promise<IMineCareProcurementOption[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareProcurementOptionSchema = new Schema<IMineCareProcurementOption, IMineCareProcurementOptionModel>(
  {
    optionId: { type: String, required: true, unique: true, index: true, trim: true },
    name: { type: String, required: true, trim: true },
    equipmentType: { type: String, required: true, trim: true },
    vendor: { type: String, trim: true },
    purchaseCost: { type: Number, default: 0 },
    warrantyYears: { type: Number, default: 0 },
    expectedMaintenanceCost: { type: Number, default: 0 },
    fuelCost: { type: Number, default: 0 },
    expectedLifeYears: { type: Number, default: 5 },
    resaleValue: { type: Number, default: 0 },
    downtimeRiskCost: { type: Number, default: 0 },
    notes: { type: String, trim: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);
mineCareProcurementOptionSchema.virtual('createdAt').get(function () { return this.created; });
mineCareProcurementOptionSchema.virtual('updatedAt').get(function () { return this.updated; });
mineCareProcurementOptionSchema.index({ isDeleted: 1, updated: -1 });
mineCareProcurementOptionSchema.index({ equipmentType: 1, isDeleted: 1 });
mineCareProcurementOptionSchema.statics.list = async function (criteria: any) { return this.find(criteria.filter).sort(criteria.sorting).skip((criteria.page - 1) * criteria.limit).limit(criteria.limit); };
mineCareProcurementOptionSchema.statics.totalCount = async function (criteria: any) { return this.countDocuments(criteria.filter); };

export const MineCareProcurementOption = model<IMineCareProcurementOption, IMineCareProcurementOptionModel>('MineCareProcurementOption', mineCareProcurementOptionSchema);
