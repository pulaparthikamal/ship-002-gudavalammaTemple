import { Request, Response } from 'express';
import * as toneService from './tone.service';
import respUtil from '../../utils/resp.util';

export const toneController = {
  async getTones(req: Request, res: Response) {
    const result = await toneService.getTones();
    req.entityType = 'tones';
    (req as any).tones = result;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async createTone(req: Request, res: Response) {
    const result = await toneService.createTone(req.body);
    req.entityType = 'tone';
    (req as any).tone = result;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async deleteTone(req: Request, res: Response) {
    const locale = req.locale || 'en';
    await toneService.deleteTone(req.params.id, locale);
    req.entityType = 'tone';
    // Success response if no error was thrown
    return res.json(respUtil.removeSuccessResponse(req));
  }
};
