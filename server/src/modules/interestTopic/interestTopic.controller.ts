import { Request, Response } from 'express';
import * as interestTopicService from './interestTopic.service';
import respUtil from '../../utils/resp.util';

export const interestTopicController = {
  async getInterestTopics(req: Request, res: Response) {
    const result = await interestTopicService.getInterestTopics();
    req.entityType = 'interestTopics';
    (req as any).interestTopics = result;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async createInterestTopic(req: Request, res: Response) {
    const result = await interestTopicService.createInterestTopic(req.body);
    req.entityType = 'interestTopic';
    (req as any).interestTopic = result;
    return res.json(respUtil.createSuccessResponse(req));
  }
};
