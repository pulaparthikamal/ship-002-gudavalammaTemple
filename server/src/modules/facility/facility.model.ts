import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IFacility extends BaseDocument {
  slug: string;
  name: string;
  description: string;
  icon?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

const facilitySchema = new Schema<IFacility>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    icon: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Facility = model<IFacility>('Facility', facilitySchema);
