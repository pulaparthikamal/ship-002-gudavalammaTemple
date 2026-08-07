import mongoose, { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IFacebookPage {
  pageId: string;
  pageName: string;
  pageAccessToken: string;
  isActive: boolean;
}

export interface IFacebookToken extends BaseDocument {
  user: ObjectIdType;
  userAccessToken: string;
  pages: IFacebookPage[];
  created: Date;
  updated: Date;
}

const facebookTokenSchema = new Schema<IFacebookToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    userAccessToken: { type: String, required: true },
    pages: [
      {
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

export const FacebookToken = model<IFacebookToken>('FacebookToken', facebookTokenSchema);
