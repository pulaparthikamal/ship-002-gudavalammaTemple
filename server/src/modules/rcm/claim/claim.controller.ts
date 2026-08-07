import { Request, Response } from 'express';
import { claimService } from './claim.service';
import { Claim } from './claim.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { claimScrubber } from './claim.scrubber';
import { claimDenialPredictionService } from './claim-denial-prediction.service';
import { claimRejectionService } from '../claim-rejection/claim-rejection.service';

export const claimController = {
  async create(req: Request, res: Response) {
    const item = await claimService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = item;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Create',
      `Created claim: ${item.claimDate ?? item._id}`,
      'claimCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async createFromCharge(req: Request, res: Response) {
    const item = await claimService.createFromCharge(
      req.params.chargeId,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = item;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Create',
      `Created claim from charge: ${item.claimDate ?? item._id}`,
      'claimCreate'
    );

    return res.json(respUtil.dataSuccessResponse(req, item, 'Claim draft created successfully.'));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'claims');
    const query = await serviceUtil.generateListQuery(req, 'claim');

    const items = await (Claim as any).list(query);
    query.pagination.totalCount = await (Claim as any).totalCount(query);

    req.entityType = 'claims';
    req.claims = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async listRejected(req: Request, res: Response) {
    const items = await claimRejectionService.listOpenRejectedClaims();

    req.entityType = 'claims';
    req.claims = items;
    (req as any).pagination = {
      page: 1,
      limit: items.length,
      totalCount: items.length,
    };

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await claimService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'claim';
    req.claim = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async getRejections(req: Request, res: Response) {
    const items = await claimRejectionService.listForClaim(req.params.id);

    return res.json(
      respUtil.dataSuccessResponse(req, items, 'Claim rejection history fetched successfully.')
    );
  },

  async update(req: Request, res: Response) {
    const oldItem = await Claim.findById(req.params.id);
    const item = await claimService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Claim',
      'claimUpdate',
      'claimDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async aiAnalysis(req: Request, res: Response) {
    const result = await claimRejectionService.analyzeClaim(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim rejection AI analysis completed.')
    );
  },

  async resubmit(req: Request, res: Response) {
    const result = await claimService.resubmit(
      req.params.id,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Resubmitted claim: ${result.resubmittedClaimId}`,
      'claimUpdate'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Claim resubmitted successfully.'));
  },

  async submit(req: Request, res: Response) {
    const result = await claimService.submit(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Submitted claim: ${result.claim.batchId ?? result.claim._id}`,
      'claimUpdate'
    );

    const responseMessage =
      result.claim?.claimStatus === 'Rejected' || result.claim?.submissionStatus === 'Rejected'
        ? `Claim rejected: ${result.claim.rejectionReason ?? 'Rejected by clearinghouse or payer.'}`
        : 'Claim submitted successfully.';

    return res.json(respUtil.dataSuccessResponse(req, result, responseMessage));
  },

  async scrub(req: Request, res: Response) {
    const item = await claimService.getById(req.params.id, req.locale || 'en');
    const scrubResult = claimScrubber(item.toObject ? item.toObject() : item);

    return res.json(
      respUtil.dataSuccessResponse(req, scrubResult, 'Claim scrub completed.')
    );
  },

  async readiness(req: Request, res: Response) {
    const result = await claimService.getReadiness(req.params.id, req.locale || 'en');

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim readiness validation completed.')
    );
  },

  async status(req: Request, res: Response) {
    const result = await claimService.getStatus(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'View',
      `Checked claim status: ${result.claim.claimId ?? result.claim._id}`,
      'claimView'
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim status refreshed from clearinghouse.')
    );
  },

  async evaluateClosure(req: Request, res: Response) {
    const result = await claimService.evaluateClosure(req.params.id, req.locale || 'en');

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim closure criteria evaluated.')
    );
  },

  async listClosureSnapshots(req: Request, res: Response) {
    const result = await claimService.listClosureSnapshots(req.params.id, req.locale || 'en');

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim closure snapshots retrieved.')
    );
  },

  async close(req: Request, res: Response) {
    const result = await claimService.close(
      req.params.id,
      req.body.reason,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Close',
      `Closed claim: ${result.claim.claimId ?? result.claim._id}`,
      'claimClose'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Claim closed successfully.'));
  },

  async reopen(req: Request, res: Response) {
    const result = await claimService.reopen(
      req.params.id,
      req.body.reason,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Reopen',
      `Reopened claim: ${result.claim.claimId ?? result.claim._id}`,
      'claimReopen'
    );

    return res.json(respUtil.dataSuccessResponse(req, result, 'Claim reopened successfully.'));
  },

  async refreshStatus(req: Request, res: Response) {
    const result = await claimService.getStatus(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Refreshed claim status: ${result.claim.claimId ?? result.claim._id}`,
      'claimUpdate'
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim status refreshed from lifecycle tracking.')
    );
  },

  async aiReadinessReview(req: Request, res: Response) {
    const result = await claimService.getAiReadinessReview(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'AI claim readiness review completed.')
    );
  },

  async runEligibility(req: Request, res: Response) {
    const result = await claimService.runEligibility(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Ran eligibility for claim: ${result.claim.claimId ?? result.claim._id}`,
      'claimUpdate'
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Eligibility verification completed for claim.')
    );
  },

  async refreshPricing(req: Request, res: Response) {
    const result = await claimService.refreshPricing(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Refreshed pricing for claim: ${result.claim.claimId ?? result.claim._id}`,
      'claimUpdate'
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim pricing refreshed from fee schedules.')
    );
  },

  async linkAuthorization(req: Request, res: Response) {
    const result = await claimService.linkAuthorization(
      req.params.id,
      req.body?.authorizationId,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Linked authorization for claim: ${result.claim.claimId ?? result.claim._id}`,
      'claimUpdate'
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Authorization linked to claim.')
    );
  },

  async linkReferral(req: Request, res: Response) {
    const result = await claimService.linkReferral(
      req.params.id,
      req.body?.referralId,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = result.claim;
    await serviceUtil.addActivity(
      req,
      'Claim',
      'Update',
      `Linked referral for claim: ${result.claim.claimId ?? result.claim._id}`,
      'claimUpdate'
    );

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Referral linked to claim.')
    );
  },

  async predictDenial(req: Request, res: Response) {
    const result = await claimDenialPredictionService.predict(req.body);

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Claim denial risk prediction completed.')
    );
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Claim.findById(req.params.id);
    await claimService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'claim';
    req.claim = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Claim',
        'Delete',
        `Deleted claim: ${itemToDelete.claimDate ?? itemToDelete._id}`,
        'claimDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    const { ids } = req.body;
    for (const id of ids) {
      await claimService.softDelete(id, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Claim',
      'BulkDelete',
      `Bulk deleted ${ids.length} claims`,
      'claimDelete'
    );

    req.i18nKey = 'claim.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    const { ids, data } = req.body;
    for (const id of ids) {
      await claimService.update(id, data, req.locale || 'en', (req as any).user._id);
    }
    await serviceUtil.addActivity(
      req,
      'Claim',
      'BulkUpdate',
      `Bulk updated ${ids.length} claims`,
      'claimUpdate'
    );

    req.i18nKey = 'claim.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
