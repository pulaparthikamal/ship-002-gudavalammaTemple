import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type PropertyType = 'land' | 'building' | 'vehicle' | 'jewellery' | 'other';
export type PropertyStatus = 'active' | 'disputed' | 'sold';

export interface IProperty extends BaseDocument {
  name: string;
  type: PropertyType;
  location?: string;
  areaSqft?: number;
  acquisitionDate?: Date;
  estimatedValue: number;
  documentRefs?: string[];
  status: PropertyStatus;
  notes?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface IPropertyModel extends Model<IProperty> {
  list(criteria: any): Promise<IProperty[]>;
  totalCount(criteria: any): Promise<number>;
}

const propertySchema = new Schema<IProperty, IPropertyModel>(
  {
    name: { type: String, required: true },
    type: { type: String, enum: ['land', 'building', 'vehicle', 'jewellery', 'other'], required: true },
    location: { type: String },
    areaSqft: { type: Number },
    acquisitionDate: { type: Date },
    estimatedValue: { type: Number, default: 0 },
    documentRefs: { type: [String], default: [] },
    status: { type: String, enum: ['active', 'disputed', 'sold'], default: 'active' },
    notes: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

propertySchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

propertySchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Property = model<IProperty, IPropertyModel>('Property', propertySchema);
