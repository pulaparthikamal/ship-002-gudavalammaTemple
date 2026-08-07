import mongoose, { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface ISocialAccount extends BaseDocument {
  userId: ObjectIdType;
  platform: 'facebook' | 'instagram' | 'youtube' | 'linkedin';
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  platformAccountId: string;
  platformAccountName: string;
  status: 'connected' | 'disconnected';
  createdAt: Date;
  updatedAt: Date;
}

const socialAccountSchema = new Schema<ISocialAccount>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    platform: { type: String, enum: ['facebook', 'instagram', 'youtube', 'linkedin'], required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    platformAccountId: { type: String, required: true },
    platformAccountName: { type: String, required: true },
    status: { type: String, enum: ['connected', 'disconnected'], default: 'connected' },
  },
  {
    timestamps: true,
  }
);

export const SocialAccount = model<ISocialAccount>('SocialAccount', socialAccountSchema);
