import { Request, Response } from 'express';
import { nearbyPlaceService } from './nearbyPlace.service';
import respUtil from '../../utils/resp.util';

export const nearbyPlaceController = {
  async list(req: Request, res: Response) {
    const places = await nearbyPlaceService.listActive();
    req.entityType = 'nearbyPlaces';
    (req as any).nearbyPlaces = places;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const place = await nearbyPlaceService.create(req.body);
    req.entityType = 'nearbyPlace';
    (req as any).nearbyPlace = place;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const place = await nearbyPlaceService.update(req.params.id, req.body, req.locale || 'en');
    req.entityType = 'nearbyPlace';
    (req as any).nearbyPlace = place;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await nearbyPlaceService.delete(req.params.id, req.locale || 'en');
    req.entityType = 'nearbyPlace';
    (req as any).nearbyPlace = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },
};
