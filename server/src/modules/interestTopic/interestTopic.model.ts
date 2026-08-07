import { Schema, model } from 'mongoose';
import { BaseDocument } from '../../types/common.types';

export interface IInterestTopic extends BaseDocument {
  category: string;
  subTopics: string[];
  active: boolean;
  order: number;
}

const interestTopicSchema = new Schema<IInterestTopic>(
  {
    category: { type: String, required: true, unique: true },
    subTopics: { type: [String], default: [] },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

export const InterestTopic = model<IInterestTopic>('InterestTopic', interestTopicSchema);
