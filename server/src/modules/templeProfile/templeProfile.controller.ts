import { Request, Response } from 'express';
import { templeProfileService } from './templeProfile.service';

export const templeProfileController = {
  async get(req: Request, res: Response) {
    const profile = await templeProfileService.getOrCreate();
    return res.json({ templeProfile: profile });
  },

  async update(req: Request, res: Response) {
    const profile = await templeProfileService.update(req.body);
    return res.json({ templeProfile: profile });
  },
};
