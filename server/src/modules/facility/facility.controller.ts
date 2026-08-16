import { Request, Response } from 'express';
import { facilityService } from './facility.service';

export const facilityController = {
  async list(req: Request, res: Response) {
    const facilities = await facilityService.list();
    return res.json({ facilities });
  },

  async listAll(req: Request, res: Response) {
    const facilities = await facilityService.listAll();
    return res.json({ facilities });
  },

  async create(req: Request, res: Response) {
    const facility = await facilityService.create(req.body);
    return res.json({ facility });
  },

  async update(req: Request, res: Response) {
    const facility = await facilityService.update(req.params.id, req.body, req.locale || 'en');
    return res.json({ facility });
  },

  async delete(req: Request, res: Response) {
    await facilityService.delete(req.params.id, req.locale || 'en');
    return res.json({ success: true });
  },
};
