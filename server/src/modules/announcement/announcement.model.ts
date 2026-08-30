import { Schema, model, Types } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export type AnnouncementType = 'info' | 'urgent' | 'festival';
export type AnnouncementAudience = 'all' | 'devotee' | 'staff';

export interface IAnnouncement extends BaseDocument {
  title: string;
  body: string;
  imageUrl?: string;
  linkedEventId?: Types.ObjectId;
  type: AnnouncementType;
  startAt: Date;
  endAt: Date | null;
  active: boolean;
  targetAudience: AnnouncementAudience;
  priority: number;
  created: Date;
  updated: Date;
}

const announcementSchema = new Schema<IAnnouncement>(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    imageUrl: { type: String },
    linkedEventId: { type: Schema.Types.ObjectId, ref: 'TempleEvent' },
    type: { type: String, enum: ['info', 'urgent', 'festival'], default: 'info' },
    startAt: { type: Date, required: true },
    endAt: { type: Date, default: null },
    active: { type: Boolean, default: true },
    targetAudience: { type: String, enum: ['all', 'devotee', 'staff'], default: 'all' },
    priority: { type: Number, default: 0 },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

announcementSchema.index({ active: 1, startAt: 1, endAt: 1 });

export const Announcement = model<IAnnouncement>('Announcement', announcementSchema);
