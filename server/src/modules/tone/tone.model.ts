import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface ITone extends BaseDocument {
  name: string;
  active: boolean;
  sortOrder: number;
}

const toneSchema = new Schema<ITone>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    active: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 1000 },
  },
  {
    timestamps: true,
  }
);

export const Tone = model<ITone>('Tone', toneSchema);
