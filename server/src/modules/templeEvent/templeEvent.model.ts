import { Schema, model, Model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface ITempleEvent extends BaseDocument {
  name: string;
  description: string;
  imageUrl?: string;
  startDate: Date;
  endDate?: Date;
  registrationRequired: boolean;
  capacity?: number;
  registrationDeadline?: Date;
  active: boolean;
  created: Date;
  updated: Date;
}

export interface ITempleEventModel extends Model<ITempleEvent> {
  list(criteria: any): Promise<ITempleEvent[]>;
  totalCount(criteria: any): Promise<number>;
}

const templeEventSchema = new Schema<ITempleEvent, ITempleEventModel>(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    imageUrl: { type: String },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date },
    registrationRequired: { type: Boolean, default: false },
    capacity: { type: Number },
    registrationDeadline: { type: Date },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

templeEventSchema.statics.list = async function (criteria: any) {
  return this.find(criteria.filter)
    .sort(criteria.sorting)
    .skip((criteria.page - 1) * criteria.limit)
    .limit(criteria.limit);
};

templeEventSchema.statics.totalCount = async function (criteria: any) {
  return this.countDocuments(criteria.filter);
};

export const TempleEvent = model<ITempleEvent, ITempleEventModel>('TempleEvent', templeEventSchema);

export type EventRegistrationStatus = 'confirmed' | 'cancelled';

export interface IEventRegistration extends BaseDocument {
  event: Types.ObjectId;
  devotee?: Types.ObjectId;
  guestName?: string;
  guestEmail?: string;
  guestPhone?: string;
  preferredLocale: string;
  status: EventRegistrationStatus;
  registeredAt: Date;
  created: Date;
  updated: Date;
}

const eventRegistrationSchema = new Schema<IEventRegistration>(
  {
    event: { type: Schema.Types.ObjectId, ref: 'TempleEvent', required: true, index: true },
    devotee: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    guestName: { type: String },
    guestEmail: { type: String },
    guestPhone: { type: String },
    preferredLocale: { type: String, default: 'en' },
    status: { type: String, enum: ['confirmed', 'cancelled'], default: 'confirmed' },
    registeredAt: { type: Date, default: Date.now },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const EventRegistration = model<IEventRegistration>('EventRegistration', eventRegistrationSchema);
