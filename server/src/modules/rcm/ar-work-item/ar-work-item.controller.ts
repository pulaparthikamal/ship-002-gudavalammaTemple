import { Request, Response } from 'express';
import { arWorkItemService } from './ar-work-item.service';
import { ArWorkItem } from './ar-work-item.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { rejectAppendOnlyMutation } from '../shared/rcm-lifecycle-safety';

export const arWorkItemController = {
  async create(req: Request, res: Response) {
    const item = await arWorkItemService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItem';
    req.arWorkItem = item;
    await serviceUtil.addActivity(
      req,
      'AR Work Item',
      'Create',
      `Created ar work item: ${item.agingBucket ?? item._id}`,
      'arWorkItemCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'ar-work-items');
    const query = await serviceUtil.generateListQuery(req, 'arWorkItem');

    const items = await (ArWorkItem as any).list(query);
    query.pagination.totalCount = await (ArWorkItem as any).totalCount(query);

    req.entityType = 'arWorkItems';
    req.arWorkItems = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await arWorkItemService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'arWorkItem';
    req.arWorkItem = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await ArWorkItem.findById(req.params.id);
    const item = await arWorkItemService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItem';
    req.arWorkItem = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'AR Work Item',
      'arWorkItemUpdate',
      'agingBucket'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async generate(req: Request, res: Response) {
    const result = await arWorkItemService.generateOperationalWorkQueue(
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItems';
    req.arWorkItems = result.items;
    (req as any).arWorkItemGeneration = {
      createdOrUpdatedCount: result.createdOrUpdatedCount,
    };
    return res.json(respUtil.successResponse(req));
  },

  async changeStatus(req: Request, res: Response) {
    const item = await arWorkItemService.changeStatus(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItem';
    req.arWorkItem = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async addContact(req: Request, res: Response) {
    const item = await arWorkItemService.addContactHistory(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItem';
    req.arWorkItem = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async aiPrioritize(req: Request, res: Response) {
    const item = await arWorkItemService.prioritizeWithAi(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItem';
    req.arWorkItem = item;
    await serviceUtil.addActivity(req, 'AR Work Item', 'AIPrioritize', `AI prioritized AR item: ${item.agingBucket ?? item._id}`, 'arWorkItemAiPrioritize');
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await ArWorkItem.findById(req.params.id);
    await arWorkItemService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'arWorkItem';
    req.arWorkItem = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'AR Work Item',
        'Delete',
        `Deleted ar work item: ${itemToDelete.agingBucket ?? itemToDelete._id}`,
        'arWorkItemDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    rejectAppendOnlyMutation('AR work item', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(ArWorkItem, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'AR Work Item',
      'BulkDelete',
      `Bulk deleted ${ids.length} ar work items`,
      'arWorkItemDelete'
    );

    req.i18nKey = 'arWorkItem.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    rejectAppendOnlyMutation('AR work item', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(ArWorkItem, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'AR Work Item',
      'BulkUpdate',
      `Bulk updated ${ids.length} ar work items`,
      'arWorkItemUpdate'
    );

    req.i18nKey = 'arWorkItem.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
