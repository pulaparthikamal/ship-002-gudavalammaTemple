import { Request, Response } from 'express';
import { reportService } from '../services/report.service';

export const reportController = {
  async getDashboardStats(req: Request, res: Response) {
    const stats = await reportService.getDashboardStats(req.query);
    return res.json({ success: true, data: stats });
  },

  async getDeploymentsReport(req: Request, res: Response) {
    const data = await reportService.getDeploymentsReport(req.query);
    return res.json({ success: true, data });
  },

  async getVersionsReport(req: Request, res: Response) {
    const data = await reportService.getVersionsReport(req.query);
    return res.json({ success: true, data });
  },

  async getServersReport(req: Request, res: Response) {
    const data = await reportService.getServersReport();
    return res.json({ success: true, data });
  },

  async getHealthChecksReport(req: Request, res: Response) {
    const data = await reportService.getHealthChecksReport(req.query);
    return res.json({ success: true, data });
  },

  async getPm2Report(req: Request, res: Response) {
    const targetId = req.query.targetId as string;
    const data = await reportService.getPm2Report(targetId);
    return res.json({ success: true, data });
  },

  async getFailuresReport(req: Request, res: Response) {
    const data = await reportService.getFailuresReport(req.query);
    return res.json({ success: true, data });
  },

  async getUserActivityReport(req: Request, res: Response) {
    const data = await reportService.getUserActivityReport();
    return res.json({ success: true, data });
  },

  async getAuditTrailReport(req: Request, res: Response) {
    const data = await reportService.getAuditTrailReport(req.query);
    return res.json({ success: true, data });
  },

  async getNotificationsReport(req: Request, res: Response) {
    const data = await reportService.getNotificationsReport(req.query);
    return res.json({ success: true, data });
  },

  async exportReport(req: Request, res: Response) {
    const { type, format, ...filters } = req.query as any;
    const { buffer, contentType, filename } = await reportService.exportReport(type, format, filters);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  },
};
