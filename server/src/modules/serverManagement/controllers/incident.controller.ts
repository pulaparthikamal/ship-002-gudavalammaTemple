import { Request, Response } from 'express';
import { incidentService } from '../services/incident.service';

export const incidentController = {
  async analyze(req: Request, res: Response) {
    const serverId = String(req.body.serverId);
    const windowMinutes = req.body.windowMinutes ? Number(req.body.windowMinutes) : undefined;
    const incident = await incidentService.analyze(serverId, windowMinutes);
    return res.json({ success: true, data: incident });
  },

  async list(req: Request, res: Response) {
    const serverId = req.query.serverId ? String(req.query.serverId) : undefined;
    const page = req.query.page ? Number(req.query.page) : 1;
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const result = await incidentService.list(serverId, page, limit);
    return res.json({
      success: true,
      data: result.incidents,
      meta: { page: result.page, pageSize: result.limit, total: result.total },
    });
  },

  async getById(req: Request, res: Response) {
    const incidentId = String(req.params.incidentId);
    const incident = await incidentService.getById(incidentId);
    return res.json({ success: true, data: incident });
  },

  async acknowledge(req: Request, res: Response) {
    const incidentId = String(req.params.incidentId);
    const incident = await incidentService.acknowledge(incidentId);
    return res.json({ success: true, data: incident });
  },

  async resolve(req: Request, res: Response) {
    const incidentId = String(req.params.incidentId);
    const incident = await incidentService.resolve(incidentId);
    return res.json({ success: true, data: incident });
  },
};
