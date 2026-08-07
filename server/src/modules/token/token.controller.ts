import { Request, Response } from 'express';
import { tokenService } from './token.service';
import respUtil from '../../utils/resp.util';
import { getPagination } from '../../utils/pagination.util';

export const tokenController = {
  async list(req: Request, res: Response) {
    const { page, limit, skip, sort } = getPagination(req);
    const { data, meta } = await tokenService.list(req.query, skip, limit, sort);
    return res.json({
      tokens: data,
      pagination: meta
    });
  },

  async toggleStatus(req: Request, res: Response) {
    const token = await tokenService.toggleStatus(req.params.id, req.body.isValid, req.locale || 'en');
    req.entityType = 'token';
    req.token = token;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    await tokenService.delete(req.params.id, req.locale || 'en');
    req.entityType = 'token';
    req.token = { _id: req.params.id };
    return res.json(respUtil.removeSuccessResponse(req));
  },
};
