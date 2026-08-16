import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type SevaCategory = 'pratyaksha' | 'paroksha' | 'saswata';

export interface ISevaCatalog extends BaseDocument {
  slug: string;
  name: string;
  category: SevaCategory;
  timing: string;
  price: number;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface ISevaCatalogModel extends Model<ISevaCatalog> {
  list(criteria: any): Promise<ISevaCatalog[]>;
  totalCount(criteria: any): Promise<number>;
}

const sevaCatalogSchema = new Schema<ISevaCatalog, ISevaCatalogModel>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['pratyaksha', 'paroksha', 'saswata'], required: true },
    timing: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    bookingOpensAt: { type: String },
    bookingClosesAt: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

sevaCatalogSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

sevaCatalogSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const SevaCatalog = model<ISevaCatalog, ISevaCatalogModel>('SevaCatalog', sevaCatalogSchema);

export type SevaBookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

export interface ISevaBooking extends BaseDocument {
  devotee?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  seva: Types.ObjectId;
  date: Date;
  amount: number;
  status: SevaBookingStatus;
  created: Date;
  updated: Date;
}

const sevaBookingSchema = new Schema<ISevaBooking>(
  {
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    preferredLocale: { type: String, default: 'en' },
    seva: { type: Schema.Types.ObjectId, ref: 'SevaCatalog', required: true },
    date: { type: Date, required: true },
    amount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['confirmed', 'pending', 'completed', 'cancelled'], default: 'confirmed' },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const SevaBooking = model<ISevaBooking>('SevaBooking', sevaBookingSchema);
