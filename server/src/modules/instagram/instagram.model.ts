import { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IInstagramAccount {
  instagramUserId: string;
  username: string;
  name?: string;
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  isActive: boolean;
}

export interface IInstagramToken extends BaseDocument {
  user: ObjectIdType;
  userAccessToken: string;
  accounts: IInstagramAccount[];
  created: Date;
  updated: Date;
}

const instagramTokenSchema = new Schema<IInstagramToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    userAccessToken: { type: String, required: true },
    accounts: [
      {
        instagramUserId: { type: String, required: true },
        username: { type: String, required: true },
        name: { type: String },
        pageId: { type: String, required: true },
        pageName: { type: String, required: true },
        pageAccessToken: { type: String, required: true },
        isActive: { type: Boolean, default: true },
      },
    ],
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: { createdAt: 'created', updatedAt: 'updated' },
  }
);

export const InstagramToken = model<IInstagramToken>('InstagramToken', instagramTokenSchema);
