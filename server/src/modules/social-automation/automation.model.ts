import mongoose, { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IAutomation extends BaseDocument {
  userId: ObjectIdType;
  categoryId: ObjectIdType;
  interests: string[];
  targetAudience?: string;
  tone: string;
  mediaType: 'image' | 'video' | 'text';
  platforms: ('facebook' | 'instagram' | 'youtube' | 'linkedin' | 'twitter')[];
  frequency: 'daily' | 'weekly' | 'custom' | 'fixed';
  approvalEmail?: string;
  customDays?: string[];
  fixedDate?: Date;
  startDate?: Date;
  endDate?: Date;
  time: string;
  isActive: boolean;
  isDeleted: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const automationSchema = new Schema<IAutomation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    interests: [{ type: String }],
    targetAudience: { type: String, trim: true },
    tone: { type: String, required: true },
    mediaType: { type: String, enum: ['image', 'video', 'text'], required: true },
    platforms: [{ type: String, enum: ['facebook', 'instagram', 'youtube', 'linkedin', 'twitter'] }],
    frequency: { type: String, enum: ['daily', 'weekly', 'custom', 'fixed'], required: true },
    approvalEmail: { type: String },
    customDays: [{ type: String }],
    fixedDate: { type: Date },
    startDate: { type: Date },
    endDate: { type: Date },
    time: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    isDeleted: { type: Boolean, default: false },
    lastRunAt: { type: Date },
    nextRunAt: { type: Date },
  },

  {
    timestamps: true,
  }
);

export const Automation = model<IAutomation>('Automation', automationSchema);
