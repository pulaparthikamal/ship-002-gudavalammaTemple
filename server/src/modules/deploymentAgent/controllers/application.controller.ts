import { Request, Response } from 'express';
import { applicationService } from '../services/application.service';
import { getRequestUserId } from '../../serverManagement/utils/user.util';

export const applicationController = {
  async create(req: Request, res: Response) {
    const application = await applicationService.create(req.body, getRequestUserId(req));
    return res.status(201).json({
      success: true,
      data: applicationService.toPublicView(application),
      message: 'Application created.',
    });
  },

  async list(req: Request, res: Response) {
    const result = await applicationService.list(getRequestUserId(req), req.query as any);
    return res.json({
      success: true,
      data: result.items.map((a) => applicationService.toPublicView(a)),
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  },

  async getById(req: Request, res: Response) {
    const application = await applicationService.getById(req.params.id, getRequestUserId(req));
    return res.json({ success: true, data: applicationService.toPublicView(application) });
  },

  async update(req: Request, res: Response) {
    const application = await applicationService.update(req.params.id, req.body, getRequestUserId(req));
    return res.json({
      success: true,
      data: applicationService.toPublicView(application),
      message: 'Application updated.',
    });
  },

  async remove(req: Request, res: Response) {
    await applicationService.remove(req.params.id, getRequestUserId(req));
    return res.json({ success: true, data: null, message: 'Application deleted.' });
  },

  async rotateWebhookSecret(req: Request, res: Response) {
    const plainSecret = await applicationService.rotateWebhookSecret(req.params.id, getRequestUserId(req));
    return res.json({
      success: true,
      data: { secret: plainSecret },
      message: 'Webhook secret rotated. Store this value — it will not be shown again.',
    });
  },

  async updateAutoDeploy(req: Request, res: Response) {
    const application = await applicationService.updateAutoDeploy(req.params.id, req.body, getRequestUserId(req));
    return res.json({
      success: true,
      data: applicationService.toPublicView(application),
      message: 'Auto-deploy settings updated.',
    });
  },
};
