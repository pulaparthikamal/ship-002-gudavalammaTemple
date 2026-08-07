import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IPublishingFrequency extends BaseDocument {
  label: string;
  value: number;
  active: boolean;
  order: number;
}

const publishingFrequencySchema = new Schema<IPublishingFrequency>(
  {
    label: { type: String, required: true, unique: true },
    value: { type: Number, required: true },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const PublishingFrequency = model<IPublishingFrequency>('PublishingFrequency', publishingFrequencySchema);
