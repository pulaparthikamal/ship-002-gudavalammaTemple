import { Request, Response } from 'express';
import { configService } from '../services/config.service';

export const serverConfigController = {
  async get(req: Request, res: Response) {
    const config = await configService.get(String(req.query.serverId));
    return res.json({
      success: true,
      data: config,
    });
  },

  async save(req: Request, res: Response) {
    const { serverId, ...payload } = req.body as Record<string, unknown> & { serverId: string };
    const config = await configService.save(serverId, payload as any);
    return res.json({
      success: true,
      data: config,
      message: 'Configuration saved.',
    });
  },
};
