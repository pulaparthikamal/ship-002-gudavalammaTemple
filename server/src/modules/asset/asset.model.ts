import { Schema, model, Model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type AssetCategory = 'furniture' | 'electronics' | 'vehicle' | 'jewellery' | 'other';

export interface IAsset extends BaseDocument {
  name: string;
  category?: AssetCategory | string;
  purchaseDate?: Date;
  cost: number;
  currentValue: number;
  custodian?: string;
  location?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface IAssetModel extends Model<IAsset> {
  list(criteria: any): Promise<IAsset[]>;
  totalCount(criteria: any): Promise<number>;
}

const assetSchema = new Schema<IAsset, IAssetModel>(
  {
    name: { type: String, required: true },
    category: { type: String, enum: ['furniture', 'electronics', 'vehicle', 'jewellery', 'other'] },
    purchaseDate: { type: Date },
    cost: { type: Number, default: 0 },
    currentValue: { type: Number, default: 0 },
    custodian: { type: String },
    location: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

assetSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

assetSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Asset = model<IAsset, IAssetModel>('Asset', assetSchema);
