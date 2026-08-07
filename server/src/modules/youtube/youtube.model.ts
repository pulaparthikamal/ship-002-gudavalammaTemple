import { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

// ---------------------------------------------------------------------------
// YouTube Post Log
// ---------------------------------------------------------------------------
export interface IYouTubePostLog {
  postId?: string;                   // internal Post._id
  youtubeVideoId?: string;           // ID returned by YouTube
  status: 'success' | 'failed';
  platform: 'youtube';
  requestPayload?: Record<string, unknown>;
  responsePayload?: Record<string, unknown>;
  errorMessage?: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// YouTube Token
// ---------------------------------------------------------------------------
export interface IYouTubeToken extends BaseDocument {
  user: ObjectIdType;
  accessToken: string;
  refreshToken?: string;  // YouTube often provides a refresh token
  channelId: string;      // YouTube channel ID
  name?: string;          // Channel name
  picture?: string;       // Channel profile picture URL
  expiresAt?: Date;       // when the access token expires
  postLogs: IYouTubePostLog[];
  created: Date;
  updated: Date;
}

const youtubePostLogSchema = new Schema<IYouTubePostLog>(
  {
    postId: { type: String },
    youtubeVideoId: { type: String },
    status: { type: String, enum: ['success', 'failed'], required: true },
    platform: { type: String, default: 'youtube' },
    requestPayload: { type: Schema.Types.Mixed },
    responsePayload: { type: Schema.Types.Mixed },
    errorMessage: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const youtubeTokenSchema = new Schema<IYouTubeToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    channelId: { type: String, required: true },
    name: { type: String },
    picture: { type: String },
    expiresAt: { type: Date },
    postLogs: { type: [youtubePostLogSchema], default: [] },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
  }
);

export const YouTubeToken = model<IYouTubeToken>('YouTubeToken', youtubeTokenSchema);
