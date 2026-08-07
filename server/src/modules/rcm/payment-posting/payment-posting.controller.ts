import { Request, Response } from 'express';
import { paymentPostingService } from './payment-posting.service';
import { PaymentPosting } from './payment-posting.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { assertUnsafeMutationAllowed } from '../shared/rcm-lifecycle-safety';

export const paymentPostingController = {
  async create(req: Request, res: Response) {
    const item = await paymentPostingService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'paymentPosting';
    req.paymentPosting = item;
    await serviceUtil.addActivity(
      req,
      'Payment Posting',
      'Create',
      `Created payment posting: ${item.paymentDate ?? item._id}`,
      'paymentPostingCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'payment-postings');
    const query = await serviceUtil.generateListQuery(req, 'paymentPosting');

    const items = await (PaymentPosting as any).list(query);
    query.pagination.totalCount = await (PaymentPosting as any).totalCount(query);

    req.entityType = 'paymentPostings';
    req.paymentPostings = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await paymentPostingService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'paymentPosting';
    req.paymentPosting = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await PaymentPosting.findById(req.params.id);
    const item = await paymentPostingService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'paymentPosting';
    req.paymentPosting = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Payment Posting',
      'paymentPostingUpdate',
      'paymentDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async reverse(req: Request, res: Response) {
    const item = await paymentPostingService.reverse(
      req.params.id,
      req.body.reason,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'paymentPosting';
    req.paymentPosting = item;
    await serviceUtil.addActivity(
      req,
      'Payment Posting',
      'Reverse',
      `Reversed payment posting: ${item.paymentDate ?? item._id}`,
      'paymentPostingReverse'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await PaymentPosting.findById(req.params.id);
    await paymentPostingService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'paymentPosting';
    req.paymentPosting = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Payment Posting',
        'Delete',
        `Deleted payment posting: ${itemToDelete.paymentDate ?? itemToDelete._id}`,
        'paymentPostingDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Payment posting', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(PaymentPosting, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Payment Posting',
      'BulkDelete',
      `Bulk deleted ${ids.length} payment postings`,
      'paymentPostingDelete'
    );

    req.i18nKey = 'paymentPosting.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Payment posting', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(PaymentPosting, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Payment Posting',
      'BulkUpdate',
      `Bulk updated ${ids.length} payment postings`,
      'paymentPostingUpdate'
    );

    req.i18nKey = 'paymentPosting.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
