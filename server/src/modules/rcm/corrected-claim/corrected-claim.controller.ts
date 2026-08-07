import { Request, Response } from 'express';
import { correctedClaimService } from './corrected-claim.service';
import { CorrectedClaim } from './corrected-claim.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { assertUnsafeMutationAllowed } from '../shared/rcm-lifecycle-safety';

export const correctedClaimController = {
  async createFromDenial(req: Request, res: Response) {
    const item = await correctedClaimService.createFromDenial(
      req.params.denialId,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'correctedClaim';
    req.correctedClaim = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async createFromClaim(req: Request, res: Response) {
    const item = await correctedClaimService.createFromClaim(
      req.params.claimId,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'correctedClaim';
    req.correctedClaim = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async applyCorrections(req: Request, res: Response) {
    const result = await correctedClaimService.applyCorrections(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async readiness(req: Request, res: Response) {
    const result = await correctedClaimService.getReadiness(req.params.id, req.locale || 'en');
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async submit(req: Request, res: Response) {
    const result = await correctedClaimService.submit(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async lineage(req: Request, res: Response) {
    const result = await correctedClaimService.getLineageByClaimId(req.params.claimId, req.locale || 'en');
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async create(req: Request, res: Response) {
    const item = await correctedClaimService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'correctedClaim';
    req.correctedClaim = item;
    await serviceUtil.addActivity(
      req,
      'Corrected Claim',
      'Create',
      `Created corrected claim: ${item.submittedDate ?? item._id}`,
      'correctedClaimCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'corrected-claims');
    const query = await serviceUtil.generateListQuery(req, 'correctedClaim');

    const items = await (CorrectedClaim as any).list(query);
    query.pagination.totalCount = await (CorrectedClaim as any).totalCount(query);

    req.entityType = 'correctedClaims';
    req.correctedClaims = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await correctedClaimService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'correctedClaim';
    req.correctedClaim = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await CorrectedClaim.findById(req.params.id);
    const item = await correctedClaimService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'correctedClaim';
    req.correctedClaim = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Corrected Claim',
      'correctedClaimUpdate',
      'submittedDate'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await CorrectedClaim.findById(req.params.id);
    await correctedClaimService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'correctedClaim';
    req.correctedClaim = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Corrected Claim',
        'Delete',
        `Deleted corrected claim: ${itemToDelete.submittedDate ?? itemToDelete._id}`,
        'correctedClaimDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Corrected claim', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(CorrectedClaim, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Corrected Claim',
      'BulkDelete',
      `Bulk deleted ${ids.length} corrected claims`,
      'correctedClaimDelete'
    );

    req.i18nKey = 'correctedClaim.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Corrected claim', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(CorrectedClaim, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Corrected Claim',
      'BulkUpdate',
      `Bulk updated ${ids.length} corrected claims`,
      'correctedClaimUpdate'
    );

    req.i18nKey = 'correctedClaim.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
