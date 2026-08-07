import { Request, Response } from 'express';
import { chargeMasterService } from './charge-master.service';
import { ChargeMaster } from './charge-master.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const chargeMasterController = {
  async create(req: Request, res: Response) {
    const item = await chargeMasterService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'chargeMaster';
    req.chargeMaster = item;
    await serviceUtil.addActivity(
      req,
      'Charge Master',
      'Create',
      `Created charge master: ${item.cptCode ?? item._id}`,
      'chargeMasterCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'charge-masters');
    const query = await serviceUtil.generateListQuery(req, 'chargeMaster');

    const items = await (ChargeMaster as any).list(query);
    query.pagination.totalCount = await (ChargeMaster as any).totalCount(query);

    req.entityType = 'chargeMasters';
    req.chargeMasters = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await chargeMasterService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'chargeMaster';
    req.chargeMaster = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await ChargeMaster.findById(req.params.id);
    const item = await chargeMasterService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'chargeMaster';
    req.chargeMaster = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Charge Master',
      'chargeMasterUpdate',
      'cptCode'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await ChargeMaster.findById(req.params.id);
    await chargeMasterService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'chargeMaster';
    req.chargeMaster = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Charge Master',
        'Delete',
        `Deleted charge master: ${itemToDelete.cptCode ?? itemToDelete._id}`,
        'chargeMasterDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(ChargeMaster, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Charge Master',
      'BulkDelete',
      `Bulk deleted ${ids.length} charge masters`,
      'chargeMasterDelete'
    );

    req.i18nKey = 'chargeMaster.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(ChargeMaster, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Charge Master',
      'BulkUpdate',
      `Bulk updated ${ids.length} charge masters`,
      'chargeMasterUpdate'
    );

    req.i18nKey = 'chargeMaster.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
