import mongoose, { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IPost extends BaseDocument {
  userId: ObjectIdType;
  automationId?: ObjectIdType;
  categoryId?: ObjectIdType;
  postType: 'ai' | 'manual';
  postingMode?: 'now' | 'schedule';
  title?: string;
  sourceTopic?: string;
  topic?: string;
  targetAudience?: string;
  content: string;
  mediaUrl?: string;          // single image
  mediaUrls?: string[];        // multiple images (carousel)
  videoUrl?: string;
  tone?: string;
  platforms: ('facebook' | 'instagram' | 'youtube' | 'linkedin' | 'twitter')[];
  status: 'pending_approval' | 'waiting_for_approval' | 'scheduled' | 'pending' | 'posted' | 'failed' | 'paused';
  approvalStatus: 'not_required' | 'content_generation_pending' | 'email_sent' | 'email_failed' | 'approved' | 'rejected';
  approvalToken?: string;
  approvalRequestedAt?: Date;
  approvedAt?: Date;
  approvedByEmail?: string;
  rejectedAt?: Date;
  rejectionReason?: string;
  scheduledAt: string;
  postedAt?: Date;
  errorMessage?: string;
  additionalInformation?: Record<string, any> | null;
  generationBrief?: Record<string, any> | null;
  platformSpecificContent?: Record<string, any>;
  instagramHtml?: string;
  instagramImage?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShortFormVideoContent {
  duration_seconds?: number;
  title?: string;
  hook?: string;
  script?: string;
  thumbnail_text?: string;
  thumbnail_concept?: string;
  hashtags?: string[];
}

const postSchema = new Schema<IPost>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    automationId: { type: Schema.Types.ObjectId, ref: 'Automation' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    postType: { type: String, enum: ['ai', 'manual'], default: 'manual' },
    postingMode: { type: String, enum: ['now', 'schedule'], default: 'schedule' },
    title: { type: String, trim: true },
    sourceTopic: { type: String, trim: true },
    topic: { type: String },
    targetAudience: { type: String, trim: true },
    content: { type: String },
    mediaUrl: { type: String },
    mediaUrls: [{ type: String }],
    videoUrl: { type: String },
    tone: { type: String },
    platforms: [{ type: String, enum: ['facebook', 'instagram', 'youtube', 'linkedin', 'twitter'], required: true }],

    status: {
      type: String,
      enum: ['pending_approval', 'waiting_for_approval', 'scheduled', 'pending', 'posted', 'failed', 'paused'],
      default: 'scheduled',
    },
    approvalStatus: {
      type: String,
      enum: ['not_required', 'content_generation_pending', 'email_sent', 'email_failed', 'approved', 'rejected'],
      default: 'not_required',
    },
    approvalToken: { type: String },
    approvalRequestedAt: { type: Date },
    approvedAt: { type: Date },
    approvedByEmail: { type: String },
    rejectedAt: { type: Date },
    rejectionReason: { type: String },
    scheduledAt: { type: String, required: true },
    postedAt: { type: Date },
    errorMessage: { type: String },
    additionalInformation: { type: Schema.Types.Mixed, default: null },
    generationBrief: { type: Schema.Types.Mixed, default: null },
    platformSpecificContent: { type: Schema.Types.Mixed, default: {} },
    instagramHtml: { type: String },
    instagramImage: { type: String },
  },
  {
    timestamps: true,
  }
);

postSchema.index({ userId: 1, targetAudience: 1, sourceTopic: 1, createdAt: -1 });
postSchema.index({ userId: 1, targetAudience: 1, topic: 1, createdAt: -1 });
postSchema.index({ userId: 1, targetAudience: 1, title: 1, createdAt: -1 });
postSchema.index({ userId: 1, targetAudience: 1, 'platformSpecificContent.youtube.title': 1, createdAt: -1 });
postSchema.index(
  { automationId: 1, scheduledAt: 1 },
  {
    unique: true,
    partialFilterExpression: {
      automationId: { $exists: true },
      scheduledAt: { $exists: true },
    },
  },
);

export const Post = model<IPost>('Post', postSchema);
