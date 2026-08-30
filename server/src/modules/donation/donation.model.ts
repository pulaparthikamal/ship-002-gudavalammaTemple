import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type DonationPaymentStatus = 'pending' | 'paid' | 'waived';
export type DonationStatus = 'confirmed' | 'cancelled';

export interface IDonation extends BaseDocument {
  devotee?: Types.ObjectId;
  // Optional link to a walk-in/counter Donor (see modules/donor) for donations
  // not tied to a devotee-app login.
  donorId?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  fundId: Types.ObjectId;
  amount: number;
  paymentStatus: DonationPaymentStatus;
  /** UPI transaction reference (UTR) the devotee optionally self-reports
   * after paying via the generated UPI link/QR — see upi.util.ts. */
  paymentReference?: string;
  status: DonationStatus;
  receiptNo: string;
  created: Date;
  updated: Date;
}

export interface IDonationModel extends Model<IDonation> {
  list(criteria: any): Promise<IDonation[]>;
  totalCount(criteria: any): Promise<number>;
}

const donationSchema = new Schema<IDonation, IDonationModel>(
  {
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    donorId: { type: Schema.Types.ObjectId, ref: 'Donor', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    preferredLocale: { type: String, default: 'en' },
    fundId: { type: Schema.Types.ObjectId, ref: 'DonationFund', required: true },
    amount: { type: Number, required: true },
    paymentStatus: { type: String, enum: ['pending', 'paid', 'waived'], default: 'pending' },
    paymentReference: { type: String },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    receiptNo: { type: String, required: true, unique: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

donationSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .populate('fundId', 'name slug')
    .populate('devotee', 'firstName lastName email phone')
    .populate('donorId', 'name phone email')
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

donationSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const Donation = model<IDonation, IDonationModel>('Donation', donationSchema);
