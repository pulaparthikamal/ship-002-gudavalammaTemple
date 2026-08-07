import { PublishingFrequency, IPublishingFrequency } from './publishingFrequency.model';

export const getFrequencies = async () => {
  return await PublishingFrequency.find({ active: true }).sort({ order: 1 });
};

export const createFrequency = async (payload: Partial<IPublishingFrequency>) => {
  return await PublishingFrequency.create(payload);
};
