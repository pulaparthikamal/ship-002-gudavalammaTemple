import { Request, Response } from 'express';
import { payerService } from './payer.service';
import { Payer } from './payer.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const payerController = {
  async create(req: Request, res: Response) {
    const item = await payerService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'payer';
    req.payer = item;
    await serviceUtil.addActivity(
      req,
      'Payer',
      'Create',
      `Created payer: ${item.payerName ?? item._id}`,
      'payerCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'payers');
    const query = await serviceUtil.generateListQuery(req, 'payer');

    const items = await (Payer as any).list(query);
    query.pagination.totalCount = await (Payer as any).totalCount(query);

    req.entityType = 'payers';
    req.payers = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await payerService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'payer';
    req.payer = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Payer.findById(req.params.id);
    const item = await payerService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'payer';
    req.payer = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Payer',
      'payerUpdate',
      'payerName'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Payer.findById(req.params.id);
    await payerService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'payer';
    req.payer = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Payer',
        'Delete',
        `Deleted payer: ${itemToDelete.payerName ?? itemToDelete._id}`,
        'payerDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Payer, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Payer',
      'BulkDelete',
      `Bulk deleted ${ids.length} payers`,
      'payerDelete'
    );

    req.i18nKey = 'payer.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Payer, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Payer',
      'BulkUpdate',
      `Bulk updated ${ids.length} payers`,
      'payerUpdate'
    );

    req.i18nKey = 'payer.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
