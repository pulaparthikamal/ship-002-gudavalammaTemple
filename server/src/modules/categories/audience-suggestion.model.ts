import mongoose, { Schema, model } from 'mongoose';
import { BaseDocument, ObjectIdType } from '../../types/common.types';

export interface IAudienceSuggestion extends BaseDocument {
  userId: ObjectIdType;
  value: string;
  normalizedValue: string;
  createdAt: Date;
  updatedAt: Date;
}

const audienceSuggestionSchema = new Schema<IAudienceSuggestion>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    value: { type: String, required: true, trim: true },
    normalizedValue: { type: String, required: true, trim: true, lowercase: true },
  },
  {
    timestamps: true,
  },
);

audienceSuggestionSchema.index({ userId: 1, normalizedValue: 1 }, { unique: true });

export const AudienceSuggestion = model<IAudienceSuggestion>('AudienceSuggestion', audienceSuggestionSchema);
