import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type BookingType = 'darshan' | 'seva' | 'accommodation' | 'prasadam' | 'donation';
export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled';
export type BookingPaymentStatus = 'pending' | 'paid' | 'waived';

export interface IBooking extends BaseDocument {
  devotee?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  type: BookingType;
  refId: Types.ObjectId;
  refModel: string;
  title: string;
  amount: number;
  date: Date;
  status: BookingStatus;
  paymentStatus: BookingPaymentStatus;
  /** UPI transaction reference (UTR) the devotee optionally self-reports
   * after paying via the generated UPI link/QR — see upi.util.ts. Purely a
   * staff reconciliation aid; setting it never changes paymentStatus itself. */
  paymentReference?: string;
  created: Date;
  updated: Date;
}

export interface IBookingModel extends Model<IBooking> {
  list(criteria: any): Promise<IBooking[]>;
  totalCount(criteria: any): Promise<number>;
}

const bookingSchema = new Schema<IBooking, IBookingModel>(
  {
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    type: { type: String, enum: ['darshan', 'seva', 'accommodation', 'prasadam', 'donation'], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
    refModel: { type: String, required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true, default: 0 },
    date: { type: Date, required: true },
    status: { type: String, enum: ['confirmed', 'pending', 'completed', 'cancelled'], default: 'pending' },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
    paymentReference: { type: String },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

bookingSchema.index({ devotee: 1, date: -1 });

bookingSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .populate('devotee', 'firstName lastName email phone')
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

bookingSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Booking = model<IBooking, IBookingModel>('Booking', bookingSchema);
