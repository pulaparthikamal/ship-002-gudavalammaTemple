import { Request, Response } from 'express';
import { templeEventService } from './templeEvent.service';
import respUtil from '../../utils/resp.util';
import { resolveBooker } from '../../utils/guestCheckout.util';

const currentUserId = (req: Request): string | undefined => {
  const user = req.user as { _id?: string } | undefined;
  return user?._id ? String(user._id) : undefined;
};

export const templeEventController = {
  async list(req: Request, res: Response) {
    const events = await templeEventService.listUpcoming();
    req.entityType = 'templeEvents';
    req.templeEvents = events;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const event = await templeEventService.create(req.body);
    req.entityType = 'templeEvent';
    req.templeEvent = event;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const event = await templeEventService.update(req.params.id, req.body, req.locale || 'en');
    req.entityType = 'templeEvent';
    req.templeEvent = event;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await templeEventService.delete(req.params.id, req.locale || 'en');
    req.entityType = 'templeEvent';
    req.templeEvent = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },

  async listRegistrations(req: Request, res: Response) {
    const registrations = await templeEventService.listRegistrations(req.params.eventId);
    return res.json({ registrations });
  },

  async listMyRegistrations(req: Request, res: Response) {
    const devoteeId = currentUserId(req);
    const registrations = devoteeId ? await templeEventService.listMyRegistrations(devoteeId) : [];
    return res.json({ registrations });
  },

  async register(req: Request, res: Response) {
    const booker = resolveBooker(req, req.body, req.locale || 'en');
    const registration = await templeEventService.register(booker, req.body.eventId, req.locale || 'en');
    return res.json({ registration });
  },
};
