import { Schema, model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';
import { BookingPaymentStatus, BookingStatus } from '../booking/booking.model';

export interface IPrasadamItem extends BaseDocument {
  slug: string;
  name: string;
  price: number;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

const prasadamItemSchema = new Schema<IPrasadamItem>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, default: 0 },
    bookingOpensAt: { type: String },
    bookingClosesAt: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const PrasadamItem = model<IPrasadamItem>('PrasadamItem', prasadamItemSchema);

export interface IPrasadamOrderItem {
  itemId: Types.ObjectId;
  name: string;
  price: number;
  qty: number;
}

export interface IPrasadamOrder extends BaseDocument {
  devotee?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  items: IPrasadamOrderItem[];
  amount: number;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  created: Date;
  updated: Date;
}

const prasadamOrderItemSchema = new Schema<IPrasadamOrderItem>(
  {
    itemId: { type: Schema.Types.ObjectId, ref: 'PrasadamItem', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    qty: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const prasadamOrderSchema = new Schema<IPrasadamOrder>(
  {
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    preferredLocale: { type: String, default: 'en' },
    items: { type: [prasadamOrderItemSchema], required: true },
    amount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['confirmed', 'pending', 'completed', 'cancelled'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const PrasadamOrder = model<IPrasadamOrder>('PrasadamOrder', prasadamOrderSchema);
