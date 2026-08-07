import { Request, Response } from 'express';
import { chargeService } from './charge.service';
import { Charge } from './charge.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const chargeController = {
  async create(req: Request, res: Response) {
    const item = await chargeService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'charge';
    req.charge = item;
    await serviceUtil.addActivity(
      req,
      'Charge',
      'Create',
      `Created charge: ${item.serviceDate ?? item._id}`,
      'chargeCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async createFromEncounter(req: Request, res: Response) {
    const item = await chargeService.createFromEncounter(
      req.params.encounterId,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'charge';
    req.charge = item;
    await serviceUtil.addActivity(
      req,
      'Charge',
      'Create',
      `Generated charge from encounter: ${item.serviceDate ?? item._id}`,
      'chargeCreate'
    );

    return res.json(respUtil.dataSuccessResponse(req, item, 'Charge draft created successfully.'));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'charges');
    const query = await serviceUtil.generateListQuery(req, 'charge');

    const items = await (Charge as any).list(query);
    query.pagination.totalCount = await (Charge as any).totalCount(query);

    req.entityType = 'charges';
    req.charges = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await chargeService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'charge';
    req.charge = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Charge.findById(req.params.id);
    const item = await chargeService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'charge';
    req.charge = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Charge',
      'chargeUpdate',
      'serviceDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async submitReview(req: Request, res: Response) {
    const result = await chargeService.submitForReview(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'charge';
    req.charge = result.charge;
    await serviceUtil.addActivity(
      req,
      'Charge',
      'Update',
      `Submitted charge for coding review: ${result.charge.serviceDate ?? result.charge._id}`,
      'chargeUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Charge submitted for coding review successfully.'));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Charge.findById(req.params.id);
    await chargeService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'charge';
    req.charge = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Charge',
        'Delete',
        `Deleted charge: ${itemToDelete.serviceDate ?? itemToDelete._id}`,
        'chargeDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    for (const id of ids) {
      await chargeService.softDelete(id, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Charge',
      'BulkDelete',
      `Bulk deleted ${ids.length} charges`,
      'chargeDelete'
    );

    req.i18nKey = 'charge.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    for (const id of ids) {
      await chargeService.update(id, data, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Charge',
      'BulkUpdate',
      `Bulk updated ${ids.length} charges`,
      'chargeUpdate'
    );

    req.i18nKey = 'charge.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
