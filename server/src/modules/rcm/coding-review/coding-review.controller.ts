import { Request, Response } from 'express';
import { codingReviewService } from './coding-review.service';
import { CodingReview } from './coding-review.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const codingReviewController = {
  async create(req: Request, res: Response) {
    const item = await codingReviewService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'codingReview';
    req.codingReview = item;
    await serviceUtil.addActivity(
      req,
      'Coding Review',
      'Create',
      `Created coding review: ${item.scrubStatus ?? item._id}`,
      'codingReviewCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async createFromCharge(req: Request, res: Response) {
    const item = await codingReviewService.createFromCharge(
      req.params.chargeId,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'codingReview';
    req.codingReview = item;
    await serviceUtil.addActivity(
      req,
      'Coding Review',
      'Create',
      `Created coding review from charge: ${item.scrubStatus ?? item._id}`,
      'codingReviewCreate'
    );

    return res.json(respUtil.dataSuccessResponse(req, item, 'Coding review created successfully.'));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'coding-reviews');
    const query = await serviceUtil.generateListQuery(req, 'codingReview');

    const items = await (CodingReview as any).list(query);
    query.pagination.totalCount = await (CodingReview as any).totalCount(query);

    req.entityType = 'codingReviews';
    req.codingReviews = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await codingReviewService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'codingReview';
    req.codingReview = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await CodingReview.findById(req.params.id);
    const item = await codingReviewService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'codingReview';
    req.codingReview = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Coding Review',
      'codingReviewUpdate',
      'scrubStatus'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async approve(req: Request, res: Response) {
    const result = await codingReviewService.approve(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'codingReview';
    req.codingReview = result.codingReview;
    await serviceUtil.addActivity(
      req,
      'Coding Review',
      'Update',
      `Approved coding review for claim: ${result.codingReview.scrubStatus ?? result.codingReview._id}`,
      'codingReviewUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Coding review approved for claim successfully.'));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await CodingReview.findById(req.params.id);
    await codingReviewService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'codingReview';
    req.codingReview = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Coding Review',
        'Delete',
        `Deleted coding review: ${itemToDelete.scrubStatus ?? itemToDelete._id}`,
        'codingReviewDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    for (const id of ids) {
      await codingReviewService.softDelete(id, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Coding Review',
      'BulkDelete',
      `Bulk deleted ${ids.length} coding reviews`,
      'codingReviewDelete'
    );

    req.i18nKey = 'codingReview.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    for (const id of ids) {
      await codingReviewService.update(id, data, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Coding Review',
      'BulkUpdate',
      `Bulk updated ${ids.length} coding reviews`,
      'codingReviewUpdate'
    );

    req.i18nKey = 'codingReview.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
