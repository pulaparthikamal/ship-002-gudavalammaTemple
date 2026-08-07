import { Request, Response } from 'express';
import { collectionService } from './collection.service';
import { Collection } from './collection.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { rejectAppendOnlyMutation } from '../shared/rcm-lifecycle-safety';

export const collectionController = {
  async create(req: Request, res: Response) {
    const item = await collectionService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'collection';
    req.collection = item;
    await serviceUtil.addActivity(
      req,
      'Collection',
      'Create',
      `Created collection: ${item.agencyName ?? item._id}`,
      'collectionCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'collections');
    const query = await serviceUtil.generateListQuery(req, 'collection');

    const items = await (Collection as any).list(query);
    query.pagination.totalCount = await (Collection as any).totalCount(query);

    req.entityType = 'collections';
    req.collections = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await collectionService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'collection';
    req.collection = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Collection.findById(req.params.id);
    const item = await collectionService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'collection';
    req.collection = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Collection',
      'collectionUpdate',
      'agencyName'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async generate(req: Request, res: Response) {
    const result = await collectionService.generateFromPatientBilling(
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async rules(req: Request, res: Response) {
    return res.json(respUtil.dataSuccessResponse(req, collectionService.getRules()));
  },

  async action(req: Request, res: Response) {
    const item = await collectionService.applyAction(
      req.params.id,
      req.params.action,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'collection';
    req.collection = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Collection.findById(req.params.id);
    await collectionService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'collection';
    req.collection = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Collection',
        'Delete',
        `Deleted collection: ${itemToDelete.agencyName ?? itemToDelete._id}`,
        'collectionDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    rejectAppendOnlyMutation('Collection', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Collection, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Collection',
      'BulkDelete',
      `Bulk deleted ${ids.length} collections`,
      'collectionDelete'
    );

    req.i18nKey = 'collection.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    rejectAppendOnlyMutation('Collection', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Collection, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Collection',
      'BulkUpdate',
      `Bulk updated ${ids.length} collections`,
      'collectionUpdate'
    );

    req.i18nKey = 'collection.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
