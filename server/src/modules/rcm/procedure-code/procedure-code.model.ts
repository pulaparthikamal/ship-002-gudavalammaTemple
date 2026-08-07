import mongoose, { Schema, model, Model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../../types/common.types';

export interface IProcedureCode extends BaseDocument {
  procedureCodeId: ObjectIdType;
  code: string;
  description: string;
  chargeFee: number;
  category: string;
  requiresAuth: boolean;
  frequencyLimit: string;
  active: boolean;
  isDeleted: boolean;
  deletedAt?: Date;
  createdBy?: ObjectIdType;
  updatedBy?: ObjectIdType;
}

export interface IProcedureCodeModel extends Model<IProcedureCode> {
  list(criteria: any): Promise<IProcedureCode[]>;
  totalCount(criteria: any): Promise<number>;
}

const procedureCodeSchema = new Schema<IProcedureCode, IProcedureCodeModel>(
  {
    procedureCodeId: {
      type: Schema.Types.ObjectId,
      default: () => new mongoose.Types.ObjectId(),
      unique: true,
      index: true,
      immutable: true,
    },
    code: { type: String, required: true, trim: true, unique: true, index: true },
    description: { type: String, required: true, trim: true },
    chargeFee: { type: Number, required: true },
    category: { type: String, required: true, trim: true, index: true },
    requiresAuth: { type: Boolean, default: false },
    frequencyLimit: { type: String, trim: true },
    active: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

procedureCodeSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

procedureCodeSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const ProcedureCode = model<IProcedureCode, IProcedureCodeModel>('ProcedureCode', procedureCodeSchema);
