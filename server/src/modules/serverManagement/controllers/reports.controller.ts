import { Request, Response } from 'express';
import { reportService } from '../services/report.service';

export const reportsController = {
  async get(req: Request, res: Response) {
    const report = await reportService.build(
      req.query.serverId ? String(req.query.serverId) : undefined,
      {
        startDate: req.query.startDate ? String(req.query.startDate) : undefined,
        endDate: req.query.endDate ? String(req.query.endDate) : undefined,
      }
    );
    return res.json({
      success: true,
      data: report,
    });
  },
};
