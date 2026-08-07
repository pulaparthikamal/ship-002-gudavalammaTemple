import { Request, Response } from 'express';
import { auditLogService } from './audit-log.service';
import respUtil from '../../../utils/resp.util';

export const auditLogController = {
  async list(req: Request, res: Response) {
    const result = await auditLogService.list(req.query ?? {});
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async getById(req: Request, res: Response) {
    const item = await auditLogService.getById(req.params.id, req.locale || 'en');
    return res.json(respUtil.dataSuccessResponse(req, item));
  },

  async getByEntity(req: Request, res: Response) {
    const result = await auditLogService.getByEntity(
      req.params.entityType,
      req.params.entityId,
      req.query ?? {}
    );
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async getAppointmentSummaries(req: Request, res: Response) {
    const result = await auditLogService.getAppointmentSummaries(req.query ?? {});
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async getClaimSummaries(req: Request, res: Response) {
    const result = await auditLogService.getClaimSummaries(req.query ?? {});
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async getClaimTimeline(req: Request, res: Response) {
    const result = await auditLogService.getClaimTimeline(req.params.claimId, req.query ?? {});
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async getAppointmentTimeline(req: Request, res: Response) {
    const result = await auditLogService.getAppointmentTimeline(req.params.appointmentId, req.query ?? {});
    return res.json(respUtil.dataSuccessResponse(req, result));
  },

  async export(req: Request, res: Response) {
    const exported = await auditLogService.export(req.query ?? {});
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    return res.send(exported.content);
  },

  async mutationNotAllowed(_req: Request, res: Response) {
    return res.status(405).json({
      success: false,
      message: 'Audit logs are append-only and cannot be mutated.',
    });
  },
};
