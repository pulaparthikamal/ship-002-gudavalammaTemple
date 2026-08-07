import { Request, Response } from 'express';
import * as platformService from './platform.service';
import respUtil from '../../utils/resp.util';

export const platformController = {
  async getPlatforms(req: Request, res: Response) {
    const result = await platformService.getPlatforms();
    req.entityType = 'platforms';
    (req as any).platforms = result;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async createPlatform(req: Request, res: Response) {
    const result = await platformService.createPlatform(req.body);
    req.entityType = 'platform';
    (req as any).platform = result;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async deletePlatform(req: Request, res: Response) {
    await platformService.deletePlatform(req.params.id);
    req.entityType = 'platform';
    return res.json(respUtil.removeSuccessResponse(req));
  }
};
