import { Request, Response } from 'express';
import { agentService } from '../services/agent.service';
import { withDashboardEndpointLog } from '../utils/dashboardEndpointLog.util';

export const agentController = {
  async run(req: Request, res: Response) {
    const { serverId, scanId, execute } = req.body as {
      serverId: string;
      scanId?: string;
      execute?: boolean;
    };
    const result = await agentService.run(serverId, scanId, Boolean(execute));
    return res.json({
      success: true,
      data: result,
      message: execute
        ? 'Agent run completed with review guardrails applied.'
        : 'Agent decision preview generated.',
    });
  },

  async predictMaintenance(req: Request, res: Response) {
    const { serverId } = req.body as { serverId: string };
    const result = await agentService.predictMaintenance(serverId);
    return res.json({
      success: true,
      data: result,
      message: 'Predictive maintenance analysis completed.',
    });
  },

  async listPredictions(req: Request, res: Response) {
    const { serverId, limit } = req.query as { serverId?: string; limit?: string };
    const result = await withDashboardEndpointLog(
      'agent/predictions',
      'mongo',
      () => agentService.getPredictions(serverId, Number(limit) || undefined),
    );
    return res.json({
      success: true,
      data: result,
    });
  },

  async getLatestPrediction(req: Request, res: Response) {
    const { serverId } = req.query as { serverId: string };
    const result = await withDashboardEndpointLog(
      'agent/predictions/latest',
      'mongo',
      () => agentService.getLatestPrediction(serverId),
    );
    return res.json({
      success: true,
      data: result,
    });
  },

  async addFeedback(req: Request, res: Response) {
    const { id } = req.params;
    const { rating, comment } = req.body as { rating: number; comment?: string };
    const result = await agentService.addFeedback(id, rating, comment);
    return res.json({
      success: true,
      data: result,
      message: 'Feedback collected successfully.',
    });
  },
};
