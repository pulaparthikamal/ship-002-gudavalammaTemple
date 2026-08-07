import { Request, Response } from 'express';
import { refundService } from './refund.service';
import { Refund } from './refund.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { rejectAppendOnlyMutation } from '../shared/rcm-lifecycle-safety';

export const refundController = {
  async create(req: Request, res: Response) {
    const item = await refundService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'refund';
    req.refund = item;
    await serviceUtil.addActivity(
      req,
      'Refund',
      'Create',
      `Created refund: ${item.refundType ?? item._id}`,
      'refundCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'refunds');
    const query = await serviceUtil.generateListQuery(req, 'refund');

    const items = await (Refund as any).list(query);
    query.pagination.totalCount = await (Refund as any).totalCount(query);

    req.entityType = 'refunds';
    req.refunds = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await refundService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'refund';
    req.refund = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Refund.findById(req.params.id);
    const item = await refundService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'refund';
    req.refund = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Refund',
      'refundUpdate',
      'refundType'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async action(req: Request, res: Response) {
    const item = await refundService.applyAction(
      req.params.id,
      req.params.action,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'refund';
    req.refund = item;
    await serviceUtil.addActivity(
      req,
      'Refund',
      'WorkflowAction',
      `Applied ${req.params.action} to refund: ${item._id}`,
      'refundUpdate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Refund.findById(req.params.id);
    await refundService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'refund';
    req.refund = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Refund',
        'Delete',
        `Deleted refund: ${itemToDelete.refundType ?? itemToDelete._id}`,
        'refundDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    rejectAppendOnlyMutation('Refund', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Refund, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Refund',
      'BulkDelete',
      `Bulk deleted ${ids.length} refunds`,
      'refundDelete'
    );

    req.i18nKey = 'refund.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    rejectAppendOnlyMutation('Refund', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Refund, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Refund',
      'BulkUpdate',
      `Bulk updated ${ids.length} refunds`,
      'refundUpdate'
    );

    req.i18nKey = 'refund.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
