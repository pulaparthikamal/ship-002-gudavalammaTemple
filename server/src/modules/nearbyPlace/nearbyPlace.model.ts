import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type NearbyPlaceCategory = 'heritage' | 'nature' | 'shopping' | 'food' | 'accommodation' | 'other';

export interface INearbyPlace extends BaseDocument {
  name: string;
  description: string;
  distanceKm: number;
  imageUrl?: string;
  category: NearbyPlaceCategory;
  mapLink?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface INearbyPlaceModel extends Model<INearbyPlace> {
  list(criteria: any): Promise<INearbyPlace[]>;
  totalCount(criteria: any): Promise<number>;
}

const nearbyPlaceSchema = new Schema<INearbyPlace, INearbyPlaceModel>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    distanceKm: { type: Number, required: true },
    imageUrl: { type: String },
    category: { type: String, enum: ['heritage', 'nature', 'shopping', 'food', 'accommodation', 'other'], default: 'other' },
    mapLink: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

nearbyPlaceSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

nearbyPlaceSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const NearbyPlace = model<INearbyPlace, INearbyPlaceModel>('NearbyPlace', nearbyPlaceSchema);
