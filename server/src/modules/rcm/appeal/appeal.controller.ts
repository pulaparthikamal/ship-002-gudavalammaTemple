import { Request, Response } from 'express';
import { appealService } from './appeal.service';
import { Appeal } from './appeal.model';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { assertUnsafeMutationAllowed } from '../shared/rcm-lifecycle-safety';

export const appealController = {
  async createFromDenial(req: Request, res: Response) {
    const item = await appealService.createFromDenial(
      req.params.denialId,
      req.body ?? {},
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async changeStatus(req: Request, res: Response) {
    const item = await appealService.changeStatus(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async generatePacket(req: Request, res: Response) {
    const item = await appealService.generatePacket(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async generateAiPacket(req: Request, res: Response) {
    const item = await appealService.generateAiPacket(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    await serviceUtil.addActivity(req, 'Appeal', 'AIPacket', `AI drafted appeal packet: ${item.appealLevel ?? item._id}`, 'appealAiPacket');
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async runReadinessReview(req: Request, res: Response) {
    const item = await appealService.runReadinessReview(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async generateFinalPacket(req: Request, res: Response) {
    const item = await appealService.generateFinalPacket(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async previewTemplate(req: Request, res: Response) {
    const preview = await appealService.previewTemplate(req.params.id, req.body ?? req.query ?? {}, req.locale || 'en');
    req.entityType = 'appealTemplatePreview';
    (req as any).appealTemplatePreview = preview;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async addDocument(req: Request, res: Response) {
    const item = await appealService.addDocument(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async replaceDocument(req: Request, res: Response) {
    const item = await appealService.replaceDocument(req.params.id, req.params.documentId, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async removeDocument(req: Request, res: Response) {
    const item = await appealService.removeDocument(req.params.id, req.params.documentId, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async recordCorrespondence(req: Request, res: Response) {
    const item = await appealService.recordCorrespondence(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async recordSubmissionProof(req: Request, res: Response) {
    const item = await appealService.recordSubmissionProof(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async getTimeline(req: Request, res: Response) {
    const timeline = await appealService.getTimeline(req.params.id, req.locale || 'en');
    req.entityType = 'appealTimeline';
    (req as any).appealTimeline = timeline;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async getDashboard(req: Request, res: Response) {
    const dashboard = await appealService.getDashboard(req.query ?? {});
    req.entityType = 'appealDashboard';
    (req as any).appealDashboard = dashboard;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async listTemplates(req: Request, res: Response) {
    const result = await appealService.listTemplates(req.query ?? {});
    req.entityType = 'appealTemplates';
    (req as any).appealTemplates = result.data;
    (req as any).pagination = result.pagination;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async listPayerRules(req: Request, res: Response) {
    const result = await appealService.listPayerRules(req.query ?? {});
    req.entityType = 'appealPayerRules';
    (req as any).appealPayerRules = result.data;
    (req as any).pagination = result.pagination;
    return res.json(respUtil.getListSuccessResponse(req));
  },

  async createPayerRule(req: Request, res: Response) {
    const item = await appealService.createPayerRule(req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appealPayerRule';
    (req as any).appealPayerRule = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async createTemplate(req: Request, res: Response) {
    const item = await appealService.createTemplate(req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appealTemplate';
    (req as any).appealTemplate = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async createTemplateVersion(req: Request, res: Response) {
    const item = await appealService.createTemplateVersion(req.params.templateId, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appealTemplate';
    (req as any).appealTemplate = item;
    return res.json(respUtil.createSuccessResponse(req));
  },

  async activateTemplate(req: Request, res: Response) {
    const item = await appealService.setTemplateActive(req.params.templateId, true, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appealTemplate';
    (req as any).appealTemplate = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async deactivateTemplate(req: Request, res: Response) {
    const item = await appealService.setTemplateActive(req.params.templateId, false, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appealTemplate';
    (req as any).appealTemplate = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async submit(req: Request, res: Response) {
    const item = await appealService.submit(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async recordPayerReceived(req: Request, res: Response) {
    const item = await appealService.recordPayerReceived(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async requestMoreInfo(req: Request, res: Response) {
    const item = await appealService.requestMoreInfo(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async submitEvidence(req: Request, res: Response) {
    const item = await appealService.submitEvidence(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async recordOutcome(req: Request, res: Response) {
    const item = await appealService.recordOutcome(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async close(req: Request, res: Response) {
    const item = await appealService.close(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async withdraw(req: Request, res: Response) {
    const item = await appealService.withdraw(req.params.id, req.body ?? {}, req.locale || 'en', (req as any).user._id);
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.updateSuccessResponse(req));
  },

  async create(req: Request, res: Response) {
    const item = await appealService.create(
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appeal';
    req.appeal = item;
    await serviceUtil.addActivity(
      req,
      'Appeal',
      'Create',
      `Created appeal: ${item.appealLevel ?? item._id}`,
      'appealCreate'
    );

    return res.json(respUtil.createSuccessResponse(req));
  },

  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'appeals');
    const query = await serviceUtil.generateListQuery(req, 'appeal');

    const items = await (Appeal as any).list(query);
    query.pagination.totalCount = await (Appeal as any).totalCount(query);

    req.entityType = 'appeals';
    req.appeals = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await appealService.getById(req.params.id, req.locale || 'en');
    req.entityType = 'appeal';
    req.appeal = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async update(req: Request, res: Response) {
    const oldItem = await Appeal.findById(req.params.id);
    const item = await appealService.update(
      req.params.id,
      req.body,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appeal';
    req.appeal = item;
    await serviceUtil.logUpdateActivity(
      req,
      oldItem,
      item,
      'Appeal',
      'appealUpdate',
      'appealLevel'
    );

    return res.json(respUtil.updateSuccessResponse(req));
  },

  async delete(req: Request, res: Response) {
    const itemToDelete = await Appeal.findById(req.params.id);
    await appealService.softDelete(
      req.params.id,
      req.locale || 'en',
      (req as any).user._id
    );

    req.entityType = 'appeal';
    req.appeal = { _id: req.params.id };

    if (itemToDelete) {
      await serviceUtil.addActivity(
        req,
        'Appeal',
        'Delete',
        `Deleted appeal: ${itemToDelete.appealLevel ?? itemToDelete._id}`,
        'appealDelete'
      );
    }

    return res.json(respUtil.removeSuccessResponse(req));
  },

  async bulkDelete(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Appeal', 'bulk deleted');
    const { ids } = req.body;
    await serviceUtil.bulkDelete(Appeal, ids, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Appeal',
      'BulkDelete',
      `Bulk deleted ${ids.length} appeals`,
      'appealDelete'
    );

    req.i18nKey = 'appeal.bulkDeleteSuccess';
    return res.json(respUtil.successResponse(req));
  },

  async bulkUpdate(req: Request, res: Response) {
    assertUnsafeMutationAllowed('Appeal', 'bulk updated');
    const { ids, data } = req.body;
    await serviceUtil.bulkUpdate(Appeal, ids, data, (req as any).user._id);
    await serviceUtil.addActivity(
      req,
      'Appeal',
      'BulkUpdate',
      `Bulk updated ${ids.length} appeals`,
      'appealUpdate'
    );

    req.i18nKey = 'appeal.bulkUpdateSuccess';
    return res.json(respUtil.successResponse(req));
  },
};
