import mongoose, { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IScheduledPost extends BaseDocument {
  user: ObjectIdType;
  platform: 'facebook' | 'instagram' | 'linkedin' | 'youtube';
  content: string;
  mediaUrls?: string[];
  scheduledAt: string;
  status: 'pending' | 'posted' | 'failed';
  errorMessage?: string;
  fbPageId?: string; // Specific page for Facebook
  created: Date;
  updated: Date;
}

const scheduledPostSchema = new Schema<IScheduledPost>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, required: true, enum: ['facebook', 'instagram', 'linkedin', 'youtube'] },
    content: { type: String, required: true },
    mediaUrls: [{ type: String }],
    scheduledAt: { type: String, required: true },
    status: { type: String, default: 'pending', enum: ['pending', 'posted', 'failed'] },
    errorMessage: { type: String },
    fbPageId: { type: String },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
  }
);

// Index for cron job performance
scheduledPostSchema.index({ scheduledAt: 1, status: 1 });

export const ScheduledPost = model<IScheduledPost>('ScheduledPost', scheduledPostSchema);
