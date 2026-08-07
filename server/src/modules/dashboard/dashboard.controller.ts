import { Request, Response } from 'express';
import { dashboardService } from './dashboard.service';
import respUtil from '../../utils/resp.util';
import { getPagination } from '../../utils/pagination.util';

export const dashboardController = {
  async create(req: Request, res: Response) {
    const dashboard = await dashboardService.create(req.body);
    req.entityType = 'common'; // Dashboard uses common i18n keys
    req.common = dashboard;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async getAll(req: Request, res: Response) {
    const { page, limit, skip, sort } = getPagination(req);
    const { data, meta } = await dashboardService.getAll(req.query, skip, limit, sort);
    return res.json({
      dashboards: data,
      pagination: meta
    });
  },

  async getById(req: Request, res: Response) {
    const dashboard = await dashboardService.getById(req.params.id, req.locale || 'en');
    return res.json({
      details: dashboard
    });
  },

  async update(req: Request, res: Response) {
    const dashboard = await dashboardService.update(req.params.id, req.body, req.locale || 'en');
    req.entityType = 'common';
    req.common = dashboard;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await dashboardService.delete(req.params.id, req.locale || 'en');
    req.entityType = 'common';
    req.common = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },
};
