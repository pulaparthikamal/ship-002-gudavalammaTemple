import { Request, Response } from 'express';
import respUtil from '../../../utils/resp.util';
import { commandCenterService } from './command-center.service';

export const commandCenterController = {
  async getSnapshot(req: Request, res: Response) {
    const snapshot = await commandCenterService.getSnapshot();
    req.entityType = 'commandCenter';
    req.commandCenter = snapshot;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },
};
