import { Request, Response } from 'express';
import { announcementService } from './announcement.service';

export const announcementController = {
  async listActive(req: Request, res: Response) {
    const announcements = await announcementService.listActive();
    return res.json({ announcements });
  },

  async list(req: Request, res: Response) {
    const announcements = await announcementService.list();
    return res.json({ announcements });
  },

  async create(req: Request, res: Response) {
    const announcement = await announcementService.create(req.body);
    return res.json({ announcement });
  },

  async update(req: Request, res: Response) {
    const announcement = await announcementService.update(req.params.id, req.body, req.locale || 'en');
    return res.json({ announcement });
  },

  async delete(req: Request, res: Response) {
    await announcementService.delete(req.params.id, req.locale || 'en');
    return res.json({ success: true });
  },
};
