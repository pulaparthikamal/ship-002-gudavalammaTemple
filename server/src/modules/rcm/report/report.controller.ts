import { Request, Response } from 'express';
import { reportService } from './report.service';
import respUtil from '../../../utils/resp.util';

async function sendReport(req: Request, res: Response, reportType: Parameters<typeof reportService.getReport>[0]) {
  const report = await reportService.getReport(reportType, req.query ?? {});
  return res.json(respUtil.dataSuccessResponse(req, report));
}

export const reportController = {
  async dashboard(req: Request, res: Response) {
    return sendReport(req, res, 'dashboard');
  },

  async claims(req: Request, res: Response) {
    return sendReport(req, res, 'claims');
  },

  async financial(req: Request, res: Response) {
    return sendReport(req, res, 'financial');
  },

  async denials(req: Request, res: Response) {
    return sendReport(req, res, 'denials');
  },

  async appeals(req: Request, res: Response) {
    return sendReport(req, res, 'appeals');
  },

  async ar(req: Request, res: Response) {
    return sendReport(req, res, 'ar');
  },

  async patientBilling(req: Request, res: Response) {
    return sendReport(req, res, 'patient-billing');
  },

  async productivity(req: Request, res: Response) {
    return sendReport(req, res, 'productivity');
  },

  async realtime(req: Request, res: Response) {
    return sendReport(req, res, 'realtime');
  },

  async claimClosure(req: Request, res: Response) {
    return sendReport(req, res, 'claim-closure');
  },

  async financialRisk(req: Request, res: Response) {
    return sendReport(req, res, 'financial-risk');
  },

  async timelyFiling(req: Request, res: Response) {
    return sendReport(req, res, 'timely-filing');
  },

  async aiOperations(req: Request, res: Response) {
    return sendReport(req, res, 'ai-operations');
  },

  async rcmOperations(req: Request, res: Response) {
    return sendReport(req, res, 'dashboard');
  },

  async export(req: Request, res: Response) {
    const exported = await reportService.exportReport(req.query ?? {});
    res.setHeader('Content-Type', exported.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exported.fileName}"`);
    return res.send(exported.content);
  },
};
