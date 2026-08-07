import { Request, Response } from 'express';
import { claimSubmissionService } from './claim-submission.service';
import { ClaimSubmission } from './claim-submission.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';

export const claimSubmissionController = {
  async retry(req: Request, res: Response) {
    const result = await claimSubmissionService.retry(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimSubmission';
    req.claimSubmission = result.claimSubmission;

    await serviceUtil.addActivity(
      req,
      'Claim Submission',
      'Update',
      `Retried claim submission: ${result.claimSubmission.batchId ?? result.claimSubmission._id}`,
      'claimSubmissionUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Claim submission retried successfully.'));
  },

  async ingestAcknowledgement(req: Request, res: Response) {
    const webhookSecret = typeof req.headers['x-clearinghouse-webhook-secret'] === 'string'
      ? req.headers['x-clearinghouse-webhook-secret']
      : undefined;

    if (!claimSubmissionService.verifyWebhookSecret(webhookSecret)) {
      throw new AppError('Claim submission webhook secret is invalid.', HTTP_STATUS.UNAUTHORIZED);
    }

    const result = await claimSubmissionService.ingestAcknowledgement(
      req.body,
      req.locale || 'en',
      String((req as any).user?._id ?? 'system')
    );

    req.entityType = 'claimSubmission';
    req.claimSubmission = result.claimSubmission;

    return res.json(respUtil.dataSuccessResponse(req, result, 'Acknowledgement processed successfully.'));
  },

  async ingestX12Acknowledgement(req: Request, res: Response) {
    const result = await claimSubmissionService.ingestX12Acknowledgement(
      req.body,
      req.locale || 'en',
      String((req as any).user?._id ?? 'system')
    );

    req.entityType = 'claimSubmission';
    req.claimSubmission = result.claimSubmission;

    return res.json(respUtil.dataSuccessResponse(req, result, 'Native X12 acknowledgement processed successfully.'));
  },

  async create(req: Request, res: Response) {
    const item = await claimSubmissionService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimSubmission';
    req.claimSubmission = item;
    await serviceUtil.addActivity(
      req,
      'Claim Submission',
      'Create',
      `Created claim submission: ${item.batchId ?? item._id}`,
      'claimSubmissionCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'claim-submissions');
    const query = await serviceUtil.generateListQuery(req, 'claimSubmission');

    const items = await (ClaimSubmission as any).list(query);
    query.pagination.totalCount = await (ClaimSubmission as any).totalCount(query);

    req.entityType = 'claimSubmissions';
    req.claimSubmissions = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await claimSubmissionService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'claimSubmission';
    req.claimSubmission = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await ClaimSubmission.findById(req.params.id);
    const item = await claimSubmissionService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimSubmission';
    req.claimSubmission = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Claim Submission',
      'claimSubmissionUpdate',
      'batchId'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await ClaimSubmission.findById(req.params.id);
    await claimSubmissionService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claimSubmission';
    req.claimSubmission = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Claim Submission',
        'Delete',
        `Deleted claim submission: ${itemToDelete.batchId ?? itemToDelete._id}`,
        'claimSubmissionDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    await serviceUtil.bulkDelete(ClaimSubmission, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Claim Submission',
      'BulkDelete',
      `Bulk deleted ${ids.length} claim submissions`,
      'claimSubmissionDelete'
    );

    req.i18nKey = 'claimSubmission.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(ClaimSubmission, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Claim Submission',
      'BulkUpdate',
      `Bulk updated ${ids.length} claim submissions`,
      'claimSubmissionUpdate'
    );

    req.i18nKey = 'claimSubmission.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
