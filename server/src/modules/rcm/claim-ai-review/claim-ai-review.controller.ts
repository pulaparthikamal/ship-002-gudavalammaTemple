import { Request, Response } from 'express';
import { claimAiReviewService } from './claim-ai-review.service';
import { ClaimAiReview } from './claim-ai-review.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const claimAiReviewController = {
  async create(req: Request, res: Response) {
    const item = await claimAiReviewService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimAiReview';
    req.claimAiReview = item;
    await serviceUtil.addActivity(
      req,
      'Claim AI Review',
      'Create',
      `Created claim ai review: ${item.denialPrediction ?? item._id}`,
      'claimAiReviewCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'claim-ai-reviews');
    const query = await serviceUtil.generateListQuery(req, 'claimAiReview');

    const items = await (ClaimAiReview as any).list(query);
    query.pagination.totalCount = await (ClaimAiReview as any).totalCount(query);

    req.entityType = 'claimAiReviews';
    req.claimAiReviews = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await claimAiReviewService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'claimAiReview';
    req.claimAiReview = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await ClaimAiReview.findById(req.params.id);
    const item = await claimAiReviewService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimAiReview';
    req.claimAiReview = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Claim AI Review',
      'claimAiReviewUpdate',
      'denialPrediction'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async approveOverride(req: Request, res: Response) {
    const result = await claimAiReviewService.approveOverride(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id,
      req.body.overrideReason
    );

    req.entityType = 'claimAiReview';
    req.claimAiReview = result.claimAiReview;
    await serviceUtil.addActivity(
      req,
      'Claim AI Review',
      'Override',
      `Approved AI review override for claim: ${result.claim?._id ?? result.claimAiReview.claimId}`,
      'claimAiReviewUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'AI claim review override approved successfully.'));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await ClaimAiReview.findById(req.params.id);
    await claimAiReviewService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimAiReview';
    req.claimAiReview = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Claim AI Review',
        'Delete',
        `Deleted claim ai review: ${itemToDelete.denialPrediction ?? itemToDelete._id}`,
        'claimAiReviewDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(ClaimAiReview, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Claim AI Review',
      'BulkDelete',
      `Bulk deleted ${ids.length} claim ai reviews`,
      'claimAiReviewDelete'
    );

    req.i18nKey = 'claimAiReview.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(ClaimAiReview, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Claim AI Review',
      'BulkUpdate',
      `Bulk updated ${ids.length} claim ai reviews`,
      'claimAiReviewUpdate'
    );

    req.i18nKey = 'claimAiReview.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
