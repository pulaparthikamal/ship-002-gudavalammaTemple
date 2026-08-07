import { Request, Response } from 'express';
import { remediationService } from '../services/remediation.service';

export const remediationController = {
  async plan(req: Request, res: Response) {
    const job =
      'intent' in req.body
        ? await remediationService.planRemediationFromIntent({
            ...req.body,
            plannedBy: (req as any).user?.id,
          })
        : await remediationService.planRemediation({
            ...req.body,
            plannedBy: (req as any).user?.id,
          });

    return res.status(201).json({
      success: true,
      data: job,
      message:
        'intent' in req.body
          ? 'AI remediation plan created and ready for approval or execution.'
          : 'Remediation plan created and pending execution.',
    });
  },

  async execute(req: Request, res: Response) {
    const { id } = req.params;
    const job = await remediationService.startJobExecution(id, (req as any).user?.id);
    return res.json({
      success: true,
      data: job,
      message: 'Remediation execution started and is running in the background.',
    });
  },

  async list(req: Request, res: Response) {
    const { serverId, limit } = req.query as { serverId?: string; limit?: string };
    const jobs = await remediationService.listJobs(serverId, limit ? parseInt(limit) : undefined);
    return res.json({
      success: true,
      data: jobs,
    });
  },

  async rollback(req: Request, res: Response) {
    const { id } = req.params;
    const job = await remediationService.rollbackJob(id, (req as any).user?.id);
    return res.json({
      success: true,
      data: job,
      message: 'Rollback initiated.',
    });
  },

  async cancel(req: Request, res: Response) {
    const { id } = req.params;
    const job = await remediationService.cancelJob(id);
    return res.json({
      success: true,
      data: job,
      message: 'Remediation plan cancelled.',
    });
  },
};
