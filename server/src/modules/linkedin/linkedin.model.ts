import { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

// ---------------------------------------------------------------------------
// LinkedIn Post Log — lightweight record of every publish attempt
// ---------------------------------------------------------------------------
export interface ILinkedInPostLog {
  postId?: string;                   // internal Post._id
  linkedInPostId?: string;           // URN returned by LinkedIn
  type: 'text' | 'image' | 'multi-image' | 'video';
  status: 'success' | 'failed';
  platform: 'linkedin';
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// LinkedIn Token — one document per user
// ---------------------------------------------------------------------------
export interface ILinkedInToken extends BaseDocument {
  user: ObjectIdType;
  accessToken: string;
  personId: string;       // LinkedIn person URN, e.g. "urn:li:person:XXXXXXX"
  name?: string;          // LinkedIn profile name
  picture?: string;       // LinkedIn profile picture URL
  expiresAt?: Date;       // when the access token expires
  postLogs: ILinkedInPostLog[];
  created: Date;
  updated: Date;
}

const linkedInPostLogSchema = new Schema<ILinkedInPostLog>(
  {
    postId: { type: String },
    linkedInPostId: { type: String },
    type: { type: String, enum: ['text', 'image', 'multi-image', 'video'], required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    platform: { type: String, default: 'linkedin' },
    requestPayload: { type: Schema.Types.Mixed },
    responsePayload: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const linkedInTokenSchema = new Schema<ILinkedInToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    accessToken: { type: String, required: true },
    personId: { type: String, required: true },
    name: { type: String },
    picture: { type: String },
    expiresAt: { type: Date },
    postLogs: { type: [linkedInPostLogSchema], default: [] },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
  }
);

export const LinkedInToken = model<ILinkedInToken>('LinkedInToken', linkedInTokenSchema);
