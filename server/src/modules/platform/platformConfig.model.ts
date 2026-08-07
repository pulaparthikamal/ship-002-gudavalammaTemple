import mongoose, { Schema, model, Document } from 'mongoose';

export interface ISocialPlatformConfig extends Document {
  platform: 'facebook' | 'instagram' | 'youtube' | 'linkedin' | 'twitter';
  clientId: string;
  clientSecret: string;
  redirectUri?: string; // Optional because we now use dynamic redirects, but good to store if needed
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const socialPlatformConfigSchema = new Schema<ISocialPlatformConfig>(
  {
    platform: { 
      type: String, 
      enum: ['facebook', 'instagram', 'youtube', 'linkedin', 'twitter'], 
      required: true,
      unique: true 
    },
    clientId: { type: String, required: true },
    clientSecret: { type: String, required: true },
    redirectUri: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
  }
);

export const SocialPlatformConfig = model<ISocialPlatformConfig>('SocialPlatformConfig', socialPlatformConfigSchema);
