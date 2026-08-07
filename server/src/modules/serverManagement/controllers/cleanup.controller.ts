import { Request, Response } from 'express';
import { scanService } from '../services/scan.service';

export const cleanupController = {
  async timeline(req: Request, res: Response) {
    const serverId = typeof req.query.serverId === 'string' ? req.query.serverId : undefined;
    const data = await scanService.getCleanupTimeline(serverId);
    return res.json({ success: true, data });
  },

  async summary(req: Request, res: Response) {
    const serverId = typeof req.query.serverId === 'string' ? req.query.serverId : undefined;
    const data = await scanService.getCleanupSummary(req.params.scanId, serverId);
    return res.json({ success: true, data });
  },

  async execute(req: Request, res: Response) {
    const serverId = typeof req.body.serverId === 'string' ? req.body.serverId : undefined;
    if (!serverId) {
      return res.status(400).json({ success: false, message: 'serverId is required.' });
    }
    const data = await scanService.executeCleanupRecommendations(serverId, req.params.scanId, 'manual');
    return res.json({ success: true, data });
  },
};
