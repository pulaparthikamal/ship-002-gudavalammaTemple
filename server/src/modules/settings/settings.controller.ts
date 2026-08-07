import { Request, Response } from 'express';
import { settingsService } from './settings.service';
import respUtil from '../../utils/resp.util';
import { getPagination } from '../../utils/pagination.util';

export const settingsController = {
  async create(req: Request, res: Response) {
    const setting = await settingsService.create(req.body, req.locale || 'en');
    req.entityType = 'settings';
    req.settings = setting;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    const { page, limit, skip, sort } = getPagination(req);
    const { data, meta } = await settingsService.list(req.query, skip, limit, sort);
    return res.json({
      settings: data,
      pagination: meta
    });
  },

  async getPublic(req: Request, res: Response) {
    const data = await settingsService.getPublicSettings();
    return res.json({
      details: data
    });
  },

  async getByKey(req: Request, res: Response) {
    const setting = await settingsService.getByKey(req.params.key, req.locale || 'en');
    return res.json({
      details: setting
    });
  },

  async update(req: Request, res: Response) {
    const setting = await settingsService.updateByKey(req.params.key, req.body, req.locale || 'en');
    req.entityType = 'settings';
    req.settings = setting;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await settingsService.deleteByKey(req.params.key, req.locale || 'en');
    req.entityType = 'settings';
    req.settings = { _id: req.params.key }; // Settings use key as identifier often, but respUtil expects _id. I'll use key if _id is missing or just provide the object.
    return res.json(respUtil.removeSuccessResponse(req));
  },
};
