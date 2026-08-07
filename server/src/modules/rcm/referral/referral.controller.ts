import { Request, Response } from 'express';
import { referralService } from './referral.service';
import { Referral } from './referral.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const referralController = {
  async create(req: Request, res: Response) {
    const item = await referralService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'referral';
    req.referral = item;
    await serviceUtil.addActivity(
      req,
      'Referral',
      'Create',
      `Created referral: ${item.referralNumber ?? item._id}`,
      'referralCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'referrals');
    const query = await serviceUtil.generateListQuery(req, 'referral');

    const items = await (Referral as any).list(query);
    query.pagination.totalCount = await (Referral as any).totalCount(query);

    req.entityType = 'referrals';
    req.referrals = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await referralService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'referral';
    req.referral = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Referral.findById(req.params.id);
    const item = await referralService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'referral';
    req.referral = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Referral',
      'referralUpdate',
      'referralNumber'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Referral.findById(req.params.id);
    await referralService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'referral';
    req.referral = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Referral',
        'Delete',
        `Deleted referral: ${itemToDelete.referralNumber ?? itemToDelete._id}`,
        'referralDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Referral, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Referral',
      'BulkDelete',
      `Bulk deleted ${ids.length} referrals`,
      'referralDelete'
    );

    req.i18nKey = 'referral.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Referral, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Referral',
      'BulkUpdate',
      `Bulk updated ${ids.length} referrals`,
      'referralUpdate'
    );

    req.i18nKey = 'referral.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
