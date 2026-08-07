import { Request, Response } from 'express';
import * as publishingFrequencyService from './publishingFrequency.service';
import respUtil from '../../utils/resp.util';

export const publishingFrequencyController = {
  async getFrequencies(req: Request, res: Response) {
    const result = await publishingFrequencyService.getFrequencies();
    req.entityType = 'publishingFrequencies';
    (req as any).publishingFrequencies = result;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async createFrequency(req: Request, res: Response) {
    const result = await publishingFrequencyService.createFrequency(req.body);
    req.entityType = 'publishingFrequency';
    (req as any).publishingFrequency = result;
    return res.json(respUtil.createSuccessResponse(req));
  }
};
