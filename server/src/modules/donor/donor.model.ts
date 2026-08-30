import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IDonor extends BaseDocument {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  panNumber?: string;
  linkedUserId?: Types.ObjectId;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface IDonorModel extends Model<IDonor> {
  list(criteria: any): Promise<IDonor[]>;
  totalCount(criteria: any): Promise<number>;
}

const donorSchema = new Schema<IDonor, IDonorModel>(
  {
    name: { type: String, required: true },
    phone: { type: String },
    email: { type: String },
    address: { type: String },
    panNumber: { type: String },
    linkedUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

donorSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

donorSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Donor = model<IDonor, IDonorModel>('Donor', donorSchema);
