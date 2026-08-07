import { Request, Response } from 'express';
import { rcmOpsService } from './rcm-ops.service';
import respUtil from '../../../utils/resp.util';

export const rcmOpsController = {
  async health(req: Request, res: Response) {
    const result = await rcmOpsService.health();
    return res.json(respUtil.dataSuccessResponse(req, result, 'RCM operational health generated.'));
  },
};
