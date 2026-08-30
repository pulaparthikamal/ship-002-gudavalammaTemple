import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export const NAV_TAB_KEYS = [
  'home',
  'darshan',
  'seva',
  'accommodation',
  'prasadam',
  'donations',
  'events',
  'live',
  'bookings',
  'facilities',
  'nearbyPlaces',
] as const;

export type NavTabKey = (typeof NAV_TAB_KEYS)[number];

export const NAV_TAB_ROLES = ['GUEST', 'USER'] as const;
export type NavTabRole = (typeof NAV_TAB_ROLES)[number];

export interface INavTab extends BaseDocument {
  key: NavTabKey;
  route: string;
  allowedRoles: NavTabRole[];
  /** Home — must always stay visible to both Guest and Devotee. */
  isDefault: boolean;
  /** Bookings — a Guest can never see this (no persistent guest identity). */
  guestLocked: boolean;
  updated: Date;
}

const navTabSchema = new Schema<INavTab>(
  {
    key: { type: String, enum: NAV_TAB_KEYS, required: true, unique: true },
    route: { type: String, required: true },
    allowedRoles: { type: [String], enum: NAV_TAB_ROLES, default: ['GUEST', 'USER'] },
    isDefault: { type: Boolean, default: false },
    guestLocked: { type: Boolean, default: false },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const NavTab = model<INavTab>('NavTab', navTabSchema);
