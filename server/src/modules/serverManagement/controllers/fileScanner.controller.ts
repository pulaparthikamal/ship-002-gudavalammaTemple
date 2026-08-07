import { Request, Response } from 'express';
import { fileScannerService } from '../services/fileScanner.service';

const buildQuery = (req: Request) => ({
  serverId: req.params.serverId ? String(req.params.serverId) : req.query.serverId ? String(req.query.serverId) : undefined,
  riskLevel: req.query.riskLevel ? String(req.query.riskLevel) : undefined,
  scanStatus: req.query.scanStatus ? String(req.query.scanStatus) : undefined,
  timeRange: req.query.timeRange ? String(req.query.timeRange) as any : undefined,
  startTime: req.query.startTime ? String(req.query.startTime) : undefined,
  endTime: req.query.endTime ? String(req.query.endTime) : undefined,
  page: req.query.page ? Number(req.query.page) : undefined,
  limit: req.query.limit ? Number(req.query.limit) : undefined,
});

export const fileScannerController = {
  async status(req: Request, res: Response) {
    const data = fileScannerService.status(req.params.serverId ? String(req.params.serverId) : undefined);
    return res.json({ success: true, data });
  },

  async scanNow(req: Request, res: Response) {
    const serverId = req.params.serverId ? String(req.params.serverId) : req.query.serverId ? String(req.query.serverId) : undefined;
    if (!serverId) {
      return res.status(400).json({ success: false, message: 'serverId is required.' });
    }
    const data = await fileScannerService.scanNow(serverId);
    return res.json({ success: true, data, message: 'Server-wide file scanner sweep completed.' });
  },

  async events(req: Request, res: Response) {
    const data = await fileScannerService.listEvents(buildQuery(req));
    return res.json({ success: true, data: data.items, meta: { total: data.total, page: data.page, limit: data.limit } });
  },

  async results(req: Request, res: Response) {
    const data = await fileScannerService.listResults(buildQuery(req));
    return res.json({ success: true, data: data.items, meta: { total: data.total, page: data.page, limit: data.limit } });
  },

  async result(req: Request, res: Response) {
    const data = await fileScannerService.getResult(String(req.params.id));
    return res.json({ success: true, data });
  },

  async quarantine(req: Request, res: Response) {
    const data = await fileScannerService.listQuarantine(buildQuery(req));
    return res.json({ success: true, data });
  },

  async alerts(req: Request, res: Response) {
    const data = await fileScannerService.listAlerts(buildQuery(req));
    return res.json({ success: true, data: data.items, meta: { total: data.total, page: data.page, limit: data.limit } });
  },

  async restore(req: Request, res: Response) {
    const data = await fileScannerService.restore(String(req.params.id));
    return res.json({ success: true, data, message: 'File restored from backup.' });
  },

  async markSafe(req: Request, res: Response) {
    const data = await fileScannerService.markSafe(String(req.params.id));
    return res.json({ success: true, data, message: 'File marked safe.' });
  },

  async permanentDelete(req: Request, res: Response) {
    const data = await fileScannerService.permanentDelete(String(req.params.id));
    return res.json({ success: true, data, message: 'Quarantined file permanently deleted after backup verification.' });
  },
};
