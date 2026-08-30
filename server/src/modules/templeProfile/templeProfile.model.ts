import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface ISocialLinks {
  facebook?: string;
  instagram?: string;
  youtube?: string;
  twitter?: string;
  whatsapp?: string;
}

export interface ITempleTiming {
  label: string;
  time: string;
}

export interface ITempleProfile extends BaseDocument {
  templeName: string;
  tagline?: string;
  address?: string;
  helpline?: string;
  logoUrl?: string;
  /** The large deity/idol photo — used for the login pages' artwork panel
   * and the devotee home hero, as distinct from `logoUrl` (the small brand
   * mark shown in headers/sidebars/nav). */
  deityImageUrl?: string;
  /** The temple's own UPI VPA (e.g. `templename@okaxis`) — used to build a
   * direct upi://pay deep link/QR for bookings & donations. No payment
   * gateway involved; see server/src/utils/upi.util.ts. */
  upiId?: string;
  /** Auto-filled translation of `templeName` into every enabled locale
   * (keyed by locale code) other than English, so the temple's name displays
   * correctly when a devotee/staff member switches language — see
   * templeProfileService.update()'s autoFillNameTranslations. Never
   * overwrites a locale a staff member has already hand-edited. */
  nameTranslations?: Record<string, string>;
  socialLinks: ISocialLinks;
  timings: ITempleTiming[];
  contactEmails: string[];
  created: Date;
  updated: Date;
}

const socialLinksSchema = new Schema<ISocialLinks>(
  {
    facebook: { type: String },
    instagram: { type: String },
    youtube: { type: String },
    twitter: { type: String },
    whatsapp: { type: String },
  },
  { _id: false }
);

const templeTimingSchema = new Schema<ITempleTiming>(
  {
    label: { type: String, required: true },
    time: { type: String, required: true },
  },
  { _id: false }
);

const templeProfileSchema = new Schema<ITempleProfile>(
  {
    templeName: { type: String, required: true, default: 'Gudavalamma Temple' },
    tagline: { type: String, default: 'Devotee Services Portal' },
    address: { type: String },
    helpline: { type: String },
    logoUrl: { type: String },
    deityImageUrl: { type: String },
    upiId: { type: String },
    nameTranslations: { type: Schema.Types.Mixed, default: {} },
    socialLinks: { type: socialLinksSchema, default: {} },
    timings: { type: [templeTimingSchema], default: [] },
    contactEmails: { type: [String], default: [] },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const TempleProfile = model<ITempleProfile>('TempleProfile', templeProfileSchema);
