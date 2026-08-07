import { Request, Response } from 'express';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { DocumentationComplianceAlert } from './documentation-compliance-alert.model';
import { documentationComplianceAlertService } from './documentation-compliance-alert.service';

export const documentationComplianceAlertController = {
  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'claims');
    const query = await serviceUtil.generateListQuery(req, 'documentationComplianceAlert');

    const items = await (DocumentationComplianceAlert as any).list(query);
    query.pagination.totalCount = await (DocumentationComplianceAlert as any).totalCount(query);

    req.entityType = 'documentationComplianceAlerts';
    (req as any).documentationComplianceAlerts = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await DocumentationComplianceAlert.findOne({ _id: req.params.id, isDeleted: false });

    req.entityType = 'documentationComplianceAlert';
    (req as any).documentationComplianceAlert = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async refresh(req: Request, res: Response) {
    const result = await documentationComplianceAlertService.refreshOpenClaims((req as any).user._id);

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Documentation compliance scan completed.')
    );
  },

  async refreshClaim(req: Request, res: Response) {
    const result = await documentationComplianceAlertService.evaluateClaim(req.params.id, {
      triggerZapier: true,
      updatedBy: (req as any).user._id,
    });

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Documentation compliance refreshed for claim.')
    );
  },
};
