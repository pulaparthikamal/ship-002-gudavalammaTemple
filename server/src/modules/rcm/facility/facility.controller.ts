import { Request, Response } from 'express';
import { facilityService } from './facility.service';
import { Facility } from './facility.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const facilityController = {
  async create(req: Request, res: Response) {
    const item = await facilityService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'facility';
    req.facility = item;
    await serviceUtil.addActivity(
      req,
      'Facility',
      'Create',
      `Created facility: ${item.facilityName ?? item._id}`,
      'facilityCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'facilities');
    const query = await serviceUtil.generateListQuery(req, 'facility');

    const items = await (Facility as any).list(query);
    query.pagination.totalCount = await (Facility as any).totalCount(query);

    req.entityType = 'facilities';
    req.facilities = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await facilityService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'facility';
    req.facility = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Facility.findById(req.params.id);
    const item = await facilityService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'facility';
    req.facility = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Facility',
      'facilityUpdate',
      'facilityName'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Facility.findById(req.params.id);
    await facilityService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'facility';
    req.facility = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Facility',
        'Delete',
        `Deleted facility: ${itemToDelete.facilityName ?? itemToDelete._id}`,
        'facilityDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Facility, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Facility',
      'BulkDelete',
      `Bulk deleted ${ids.length} facilities`,
      'facilityDelete'
    );

    req.i18nKey = 'facility.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Facility, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Facility',
      'BulkUpdate',
      `Bulk updated ${ids.length} facilities`,
      'facilityUpdate'
    );

    req.i18nKey = 'facility.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
