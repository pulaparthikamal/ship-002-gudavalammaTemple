import { InterestTopic, IInterestTopic } from './interestTopic.model';

export const getInterestTopics = async () => {
  return await InterestTopic.find({ active: true }).sort({ order: 1 });
};

export const createInterestTopic = async (payload: Partial<IInterestTopic>) => {
  return await InterestTopic.create(payload);
};
