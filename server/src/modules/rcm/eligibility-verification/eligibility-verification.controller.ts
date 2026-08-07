import { Request, Response } from 'express';
import { eligibilityVerificationService } from './eligibility-verification.service';
import { EligibilityVerification } from './eligibility-verification.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';

export const eligibilityVerificationController = {
  async create(req: Request, res: Response) {
    const item = await eligibilityVerificationService.create(
      req.body,
      req.locale || 'en',
      req.user as any
    );

    req.entityType = 'eligibilityVerification';
    req.eligibilityVerification = item;
    await serviceUtil.addActivity(
      req,
      'Eligibility Verification',
      'Create',
      `Created eligibility verification: ${item.eligibilityStatus ?? item._id}`,
      'eligibilityVerificationCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async run(req: Request, res: Response) {
    const item = await eligibilityVerificationService.runRealtimeVerification(
      req.body,
      req.locale || 'en',
      req.user as any
    );

    req.entityType = 'eligibilityVerification';
    req.eligibilityVerification = item;
    await serviceUtil.addActivity(
      req,
      'Eligibility Verification',
      'Create',
      `Ran real-time eligibility verification: ${item.externalVerificationId ?? item.correlationId ?? item._id}`,
      'eligibilityVerificationCreate'
    );

    return res.json(
      respUtil.dataSuccessResponse(
        req,
        item,
        'Eligibility verification completed successfully.'
      )
    );
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'eligibility-verifications');
    const query = await serviceUtil.generateListQuery(req, 'eligibilityVerification');

    const items = await (EligibilityVerification as any).list(query);
    query.pagination.totalCount = await (EligibilityVerification as any).totalCount(query);

    req.entityType = 'eligibilityVerifications';
    req.eligibilityVerifications = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await eligibilityVerificationService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'eligibilityVerification';
    req.eligibilityVerification = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await EligibilityVerification.findById(req.params.id);
    const item = await eligibilityVerificationService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      req.user as any
    );

    req.entityType = 'eligibilityVerification';
    req.eligibilityVerification = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Eligibility Verification',
      'eligibilityVerificationUpdate',
      'eligibilityStatus'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await EligibilityVerification.findById(req.params.id);
    await eligibilityVerificationService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'eligibilityVerification';
    req.eligibilityVerification = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Eligibility Verification',
        'Delete',
        `Deleted eligibility verification: ${itemToDelete.eligibilityStatus ?? itemToDelete._id}`,
        'eligibilityVerificationDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(EligibilityVerification, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Eligibility Verification',
      'BulkDelete',
      `Bulk deleted ${ids.length} eligibility verifications`,
      'eligibilityVerificationDelete'
    );

    req.i18nKey = 'eligibilityVerification.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(EligibilityVerification, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Eligibility Verification',
      'BulkUpdate',
      `Bulk updated ${ids.length} eligibility verifications`,
      'eligibilityVerificationUpdate'
    );

    req.i18nKey = 'eligibilityVerification.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
