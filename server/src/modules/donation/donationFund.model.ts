import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IDonationFund extends BaseDocument {
  slug: string;
  name: string;
  description: string;
  active: boolean;
  created: Date;
  updated: Date;
}

const donationFundSchema = new Schema<IDonationFund>(
  {
    slug: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const DonationFund = model<IDonationFund>('DonationFund', donationFundSchema);
