import { Request, Response } from 'express';
import { denialService } from './denial.service';
import { Denial } from './denial.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { assertUnsafeMutationAllowed } from '../shared/rcm-lifecycle-safety';

export const denialController = {
  async assignOwner(req: Request, res: Response) {
    const item = await denialService.assignOwner(req.params.id, req.body.owner, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async changeStatus(req: Request, res: Response) {
    const item = await denialService.changeStatus(req.params.id, req.body.denialStatus, req.body.resolutionNotes, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async addResolutionNotes(req: Request, res: Response) {
    const item = await denialService.addResolutionNotes(req.params.id, req.body.resolutionNotes, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async markPreventable(req: Request, res: Response) {
    const item = await denialService.markPreventable(req.params.id, req.body.preventableFlag, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async markReadyForCorrectedClaim(req: Request, res: Response) {
    const item = await denialService.markReadyForCorrectedClaim(req.params.id, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async markReadyForAppeal(req: Request, res: Response) {
    const item = await denialService.markReadyForAppeal(req.params.id, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async writeOff(req: Request, res: Response) {
    const item = await denialService.writeOff(req.params.id, req.body.resolutionNotes, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async transferToPatient(req: Request, res: Response) {
    const item = await denialService.transferToPatient(req.params.id, req.body.resolutionNotes, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async reopen(req: Request, res: Response) {
    const item = await denialService.reopen(req.params.id, req.body.reason, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async recommendation(req: Request, res: Response) {
    const result = await denialService.getRecommendation(req.params.id, req.locale || 'en');
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async aiAnalysis(req: Request, res: Response) {
    const item = await denialService.runAiAnalysis(req.params.id, req.locale || 'en', (req as any).user._id);
    req.entityType = 'denial';
    req.denial = item;
    await serviceUtil.addActivity(req, 'Denial', 'AIAnalysis', `AI analyzed denial: ${item.denialCode ?? item._id}`, 'denialAiAnalysis');
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const item = await denialService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'denial';
    req.denial = item;
    await serviceUtil.addActivity(
      req,
      'Denial',
      'Create',
      `Created denial: ${item.denialCode ?? item._id}`,
      'denialCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'denials');
    const query = await serviceUtil.generateListQuery(req, 'denial');

    const items = await (Denial as any).list(query);
    query.pagination.totalCount = await (Denial as any).totalCount(query);

    req.entityType = 'denials';
    req.denials = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await denialService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'denial';
    req.denial = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Denial.findById(req.params.id);
    const item = await denialService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'denial';
    req.denial = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Denial',
      'denialUpdate',
      'denialCode'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Denial.findById(req.params.id);
    await denialService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'denial';
    req.denial = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Denial',
        'Delete',
        `Deleted denial: ${itemToDelete.denialCode ?? itemToDelete._id}`,
        'denialDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Denial', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Denial, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Denial',
      'BulkDelete',
      `Bulk deleted ${ids.length} denials`,
      'denialDelete'
    );

    req.i18nKey = 'denial.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Denial', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Denial, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Denial',
      'BulkUpdate',
      `Bulk updated ${ids.length} denials`,
      'denialUpdate'
    );

    req.i18nKey = 'denial.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
