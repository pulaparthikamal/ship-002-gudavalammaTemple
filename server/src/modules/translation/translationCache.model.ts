import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface ITranslationCache extends BaseDocument {
  sourceHash: string;
  sourceLocale: string;
  targetLocale: string;
  sourceText: string;
  translatedText: string;
  created: Date;
}

const translationCacheSchema = new Schema<ITranslationCache>(
  {
    sourceHash: { type: String, required: true, index: true },
    sourceLocale: { type: String, required: true },
    targetLocale: { type: String, required: true },
    sourceText: { type: String, required: true },
    translatedText: { type: String, required: true },
    created: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

translationCacheSchema.index({ sourceHash: 1, sourceLocale: 1, targetLocale: 1 }, { unique: true });

export const TranslationCache = model<ITranslationCache>('TranslationCache', translationCacheSchema);
