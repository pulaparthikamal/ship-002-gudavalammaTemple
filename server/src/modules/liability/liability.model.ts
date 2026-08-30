import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type LiabilityStatus = 'open' | 'paid';

export interface ILiability extends BaseDocument {
  name: string;
  category?: string;
  amount: number;
  dueDate?: Date;
  creditor?: string;
  status: LiabilityStatus;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface ILiabilityModel extends Model<ILiability> {
  list(criteria: any): Promise<ILiability[]>;
  totalCount(criteria: any): Promise<number>;
}

const liabilitySchema = new Schema<ILiability, ILiabilityModel>(
  {
    name: { type: String, required: true },
    category: { type: String },
    amount: { type: Number, required: true },
    dueDate: { type: Date },
    creditor: { type: String },
    status: { type: String, enum: ['open', 'paid'], default: 'open' },
    notes: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

liabilitySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

liabilitySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Liability = model<ILiability, ILiabilityModel>('Liability', liabilitySchema);
