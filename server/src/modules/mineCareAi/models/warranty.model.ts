import mongoose, { Model, Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IMineCareWarranty extends BaseDocument {
  warrantyId: ObjectIdType;
  equipmentId: string;
  startDate: Date;
  endDate: Date;
  hourLimit: number;
  coveredComponents: string[];
  terms: string;
  status?: string;
  active: boolean;
  created: Date;
  updated: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
  isDeleted: boolean;
  deletedAt?: Date;
}

export interface IMineCareWarrantyModel extends Model<IMineCareWarranty> {
  list(criteria: any): Promise<IMineCareWarranty[]>;
  totalCount(criteria: any): Promise<number>;
}

const mineCareWarrantySchema = new Schema<IMineCareWarranty, IMineCareWarrantyModel>(
  {
    warrantyId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    equipmentId: { type: String, required: true, trim: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    hourLimit: { type: Number, default: 0 },
    coveredComponents: { type: [String], default: [] },
    terms: { type: String, trim: true },
    status: { type: String, trim: true },
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

mineCareWarrantySchema.virtual('createdAt').get(function () {
  return this.created;
});

mineCareWarrantySchema.virtual('updatedAt').get(function () {
  return this.updated;
});

mineCareWarrantySchema.index({ equipmentId: 1, isDeleted: 1 });
mineCareWarrantySchema.index({ isDeleted: 1, updated: -1 });

mineCareWarrantySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

mineCareWarrantySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const MineCareWarranty = model<IMineCareWarranty, IMineCareWarrantyModel>('MineCareWarranty', mineCareWarrantySchema);
