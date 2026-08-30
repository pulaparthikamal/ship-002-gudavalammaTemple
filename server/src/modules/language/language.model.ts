import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface ILanguage extends BaseDocument {
  code: string;
  name: string;
  nativeName: string;
  enabled: boolean;
  isDefault: boolean;
  created: Date;
  updated: Date;
}

const languageSchema = new Schema<ILanguage>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    nativeName: { type: String, required: true },
    enabled: { type: Boolean, default: false },
    isDefault: { type: Boolean, default: false },
    created: { type: Date, default: Date.now },
    updated: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

export const Language = model<ILanguage>('Language', languageSchema);
