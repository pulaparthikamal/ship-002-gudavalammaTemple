import { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IToken extends BaseDocument {
  user: ObjectIdType;
  accessToken: string;
  refreshToken: string;
  active: boolean;
  created: Date;
  updated: Date;
}

const tokenSchema = new Schema<IToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String, required: true },
    active: { type: Boolean, default: true },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
  }
);

tokenSchema.index({ accessToken: 1 });
tokenSchema.index({ refreshToken: 1 });
tokenSchema.index({ user: 1 });

export const Token = model<IToken>('Token', tokenSchema);
