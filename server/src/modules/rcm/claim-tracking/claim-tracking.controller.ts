import { Request, Response } from 'express';
import { claimTrackingService } from './claim-tracking.service';
import { ClaimTracking } from './claim-tracking.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const claimTrackingController = {
  async create(req: Request, res: Response) {
    const item = await claimTrackingService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimTracking';
    req.claimTracking = item;
    await serviceUtil.addActivity(
      req,
      'Claim Tracking',
      'Create',
      `Created claim tracking: ${item.claimControlNumber ?? item._id}`,
      'claimTrackingCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'claim-trackings');
    const query = await serviceUtil.generateListQuery(req, 'claimTracking');

    const items = await (ClaimTracking as any).list(query);
    query.pagination.totalCount = await (ClaimTracking as any).totalCount(query);

    req.entityType = 'claimTrackings';
    req.claimTrackings = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await claimTrackingService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'claimTracking';
    req.claimTracking = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async analyzeRejection(req: Request, res: Response) {
    const item = await claimTrackingService.analyzeRejection(req.params.id, req.locale || 'en', (req as any).user._id);
    req.entityType = 'claimTracking';
    req.claimTracking = item;
    await serviceUtil.addActivity(
      req,
      'Claim Tracking',
      'AIAnalysis',
      `AI analyzed claim tracking rejection: ${item.claimControlNumber ?? item._id}`,
      'claimTrackingAiAnalysis'
    );
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await ClaimTracking.findById(req.params.id);
    const item = await claimTrackingService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimTracking';
    req.claimTracking = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Claim Tracking',
      'claimTrackingUpdate',
      'claimControlNumber'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await ClaimTracking.findById(req.params.id);
    await claimTrackingService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimTracking';
    req.claimTracking = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Claim Tracking',
        'Delete',
        `Deleted claim tracking: ${itemToDelete.claimControlNumber ?? itemToDelete._id}`,
        'claimTrackingDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(ClaimTracking, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Claim Tracking',
      'BulkDelete',
      `Bulk deleted ${ids.length} claim trackings`,
      'claimTrackingDelete'
    );

    req.i18nKey = 'claimTracking.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(ClaimTracking, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Claim Tracking',
      'BulkUpdate',
      `Bulk updated ${ids.length} claim trackings`,
      'claimTrackingUpdate'
    );

    req.i18nKey = 'claimTracking.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
