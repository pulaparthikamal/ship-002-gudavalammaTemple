import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IDarshanQuota extends BaseDocument {
  slug: string;
  name: string;
  price: number;
  dailyCapacity: number;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface IDarshanQuotaModel extends Model<IDarshanQuota> {
  list(criteria: any): Promise<IDarshanQuota[]>;
  totalCount(criteria: any): Promise<number>;
}

const darshanQuotaSchema = new Schema<IDarshanQuota, IDarshanQuotaModel>(
  {
    slug: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    dailyCapacity: { type: Number, required: true, default: 500 },
    bookingOpensAt: { type: String },
    bookingClosesAt: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

darshanQuotaSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

darshanQuotaSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const DarshanQuota = model<IDarshanQuota, IDarshanQuotaModel>('DarshanQuota', darshanQuotaSchema);

export type DarshanBookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';

export interface IDarshanBooking extends BaseDocument {
  devotee?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  quota: Types.ObjectId;
  date: Date;
  devoteeCount: number;
  amount: number;
  status: DarshanBookingStatus;
  created: Date;
  updated: Date;
}

const darshanBookingSchema = new Schema<IDarshanBooking>(
  {
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    preferredLocale: { type: String, default: 'en' },
    quota: { type: Schema.Types.ObjectId, ref: 'DarshanQuota', required: true, index: true },
    date: { type: Date, required: true, index: true },
    devoteeCount: { type: Number, required: true, min: 1, max: 5 },
    amount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['confirmed', 'pending', 'completed', 'cancelled'], default: 'confirmed' },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

darshanBookingSchema.index({ quota: 1, date: 1 });

export const DarshanBooking = model<IDarshanBooking>('DarshanBooking', darshanBookingSchema);
