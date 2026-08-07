import { Request, Response } from 'express';
import { alertService } from '../services/alert.service';
import { withDashboardEndpointLog } from '../utils/dashboardEndpointLog.util';

export const alertsController = {
  async list(req: Request, res: Response) {
    const alerts = await withDashboardEndpointLog(
      'alerts',
      'mongo',
      () => alertService.list(
        req.query.serverId ? String(req.query.serverId) : undefined,
        req.query.limit ? Number(req.query.limit) : 20,
      ),
    );
    return res.json({
      success: true,
      data: alerts,
    });
  },
};
