import { Request, Response } from 'express';
import respUtil from '../../../utils/resp.util';
import serviceUtil from '../../../utils/service.util';
import { TimelyFilingAlert } from './timely-filing-alert.model';
import { timelyFilingAlertService } from './timely-filing-alert.service';

export const timelyFilingAlertController = {
  async list(req: Request, res: Response) {
    await serviceUtil.checkPermission(req, res, 'View', 'claims');
    const query = await serviceUtil.generateListQuery(req, 'timelyFilingAlert');

    const items = await (TimelyFilingAlert as any).list(query);
    query.pagination.totalCount = await (TimelyFilingAlert as any).totalCount(query);

    req.entityType = 'timelyFilingAlerts';
    req.timelyFilingAlerts = items;
    (req as any).pagination = query.pagination;

    return res.json(respUtil.getListSuccessResponse(req));
  },

  async getById(req: Request, res: Response) {
    const item = await TimelyFilingAlert.findOne({ _id: req.params.id, isDeleted: false });

    req.entityType = 'timelyFilingAlert';
    req.timelyFilingAlert = item;
    return res.json(respUtil.getDetailsSuccessResponse(req));
  },

  async refresh(req: Request, res: Response) {
    const result = await timelyFilingAlertService.refreshOpenClaims((req as any).user._id);

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Timely filing compliance scan completed.')
    );
  },

  async refreshClaim(req: Request, res: Response) {
    const result = await timelyFilingAlertService.evaluateClaim(req.params.id, {
      triggerZapier: true,
      updatedBy: (req as any).user._id,
    });

    return res.json(
      respUtil.dataSuccessResponse(req, result, 'Timely filing compliance refreshed for claim.')
    );
  },
};
