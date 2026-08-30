import { Request, Response } from 'express';
import { darshanService } from './darshan.service';
import respUtil from '../../utils/resp.util';
import { resolveBooker } from '../../utils/guestCheckout.util';

export const darshanController = {
  async list(req: Request, res: Response) {
    const quotas = await darshanService.listActive();
    req.entityType = 'darshanQuotas';
    req.darshanQuotas = quotas;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const quota = await darshanService.create(req.body);
    req.entityType = 'darshanQuota';
    req.darshanQuota = quota;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const quota = await darshanService.update(req.params.id, req.body, req.locale || 'en');
    req.entityType = 'darshanQuota';
    req.darshanQuota = quota;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await darshanService.delete(req.params.id, req.locale || 'en');
    req.entityType = 'darshanQuota';
    req.darshanQuota = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },

  async createBooking(req: Request, res: Response) {
    const booker = resolveBooker(req, req.body, req.locale || 'en');
    const booking = await darshanService.createBooking(booker, req.body, req.locale || 'en');
    req.entityType = 'darshanBooking';
    req.darshanBooking = booking;
    return res.json(respUtil.createSuccessResponse(req));
  },
};
