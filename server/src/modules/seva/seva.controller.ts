import { Request, Response } from 'express';
import { sevaService } from './seva.service';
import respUtil from '../../utils/resp.util';
import { resolveBooker } from '../../utils/guestCheckout.util';

export const sevaController = {
  async list(req: Request, res: Response) {
    const sevas = await sevaService.listActive();
    req.entityType = 'sevas';
    req.sevas = sevas;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const seva = await sevaService.create(req.body);
    req.entityType = 'seva';
    req.seva = seva;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const seva = await sevaService.update(req.params.id, req.body, req.locale || 'en');
    req.entityType = 'seva';
    req.seva = seva;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await sevaService.delete(req.params.id, req.locale || 'en');
    req.entityType = 'seva';
    req.seva = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },

  async createBooking(req: Request, res: Response) {
    const booker = resolveBooker(req, req.body, req.locale || 'en');
    const booking = await sevaService.createBooking(booker, req.body, req.locale || 'en');
    req.entityType = 'sevaBooking';
    req.sevaBooking = booking;
    return res.json(respUtil.createSuccessResponse(req));
  },
};
