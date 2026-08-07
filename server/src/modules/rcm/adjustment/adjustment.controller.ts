import { Request, Response } from 'express';
import { adjustmentService } from './adjustment.service';
import { Adjustment } from './adjustment.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export const adjustmentController = {
  async create(req: Request, res: Response) {
    const item = await adjustmentService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'adjustment';
    req.adjustment = item;
    await serviceUtil.addActivity(
      req,
      'Adjustment',
      'Create',
      `Created adjustment: ${item.adjustmentDate ?? item._id}`,
      'adjustmentCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'adjustments');
    const query = await serviceUtil.generateListQuery(req, 'adjustment');

    const items = await (Adjustment as any).list(query);
    query.pagination.totalCount = await (Adjustment as any).totalCount(query);

    req.entityType = 'adjustments';
    req.adjustments = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await adjustmentService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'adjustment';
    req.adjustment = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Adjustment.findById(req.params.id);
    const item = await adjustmentService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'adjustment';
    req.adjustment = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Adjustment',
      'adjustmentUpdate',
      'adjustmentDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Adjustment.findById(req.params.id);
    await adjustmentService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'adjustment';
    req.adjustment = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Adjustment',
        'Delete',
        `Deleted adjustment: ${itemToDelete.adjustmentDate ?? itemToDelete._id}`,
        'adjustmentDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    throw new AppError('Adjustments are append-only and cannot be bulk deleted.', HTTP_STATUS.BAD_REQUEST);
  },

  async bulkUpdate(req: Request, res: Response) {
    throw new AppError('Adjustments are append-only and cannot be bulk updated.', HTTP_STATUS.BAD_REQUEST);
  },
};
