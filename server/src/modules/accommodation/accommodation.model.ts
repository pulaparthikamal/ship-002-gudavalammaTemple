import { Schema, model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';
import { BookingPaymentStatus, BookingStatus } from '../booking/booking.model';

export interface IAccommodationRoomType extends BaseDocument {
  slug: string;
  name: string;
  detail: string;
  pricePerNight: number;
  totalRooms: number;
  bookingOpensAt?: string;
  bookingClosesAt?: string;
  active: boolean;
  created: Date;
  updated: Date;
}

const accommodationRoomTypeSchema = new Schema<IAccommodationRoomType>(
  {
    slug: { type: String, required: true, unique: true, trim: true },
    name: { type: String, required: true },
    detail: { type: String, default: '' },
    pricePerNight: { type: Number, required: true, default: 0 },
    totalRooms: { type: Number, required: true, default: 20 },
    bookingOpensAt: { type: String },
    bookingClosesAt: { type: String },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const AccommodationRoomType = model<IAccommodationRoomType>(
  'AccommodationRoomType',
  accommodationRoomTypeSchema
);

export interface IAccommodationBooking extends BaseDocument {
  devotee?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  roomTypeId: Types.ObjectId;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  amount: number;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  created: Date;
  updated: Date;
}

const accommodationBookingSchema = new Schema<IAccommodationBooking>(
  {
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    preferredLocale: { type: String, default: 'en' },
    roomTypeId: { type: Schema.Types.ObjectId, ref: 'AccommodationRoomType', required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    guests: { type: Number, required: true, default: 1 },
    amount: { type: Number, required: true, default: 0 },
    status: { type: String, enum: ['confirmed', 'pending', 'completed', 'cancelled'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const AccommodationBooking = model<IAccommodationBooking>(
  'AccommodationBooking',
  accommodationBookingSchema
);
