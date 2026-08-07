import { Request, Response } from 'express';
import { cleanupPolicyService } from '../services/diskCleanup/cleanupPolicy.service';
import { diskCleanupAgentService } from '../services/diskCleanup/diskCleanupAgent.service';
import { cleanupHistoryService } from '../services/diskCleanup/cleanupHistory.service';

export const diskCleanupController = {
  async getPolicy(req: Request, res: Response) {
    const data = await cleanupPolicyService.get(req.params.serverId);
    return res.json({ success: true, data });
  },

  async savePolicy(req: Request, res: Response) {
    const data = await cleanupPolicyService.save(req.body);
    return res.json({ success: true, data, message: 'Disk cleanup policy saved.' });
  },

  async scan(req: Request, res: Response) {
    const data = await diskCleanupAgentService.scan(req.params.serverId, {
      dryRun: req.body?.dryRun ?? true,
      triggerType: 'MANUAL',
      domainName: req.body?.domainName ? String(req.body.domainName) : undefined,
    });
    return res.json({ success: true, data, message: 'Disk cleanup scan completed. No files were deleted.' });
  },

  async execute(req: Request, res: Response) {
    const data = await diskCleanupAgentService.execute(req.params.serverId, 'MANUAL', {
      dryRun: req.body?.dryRun,
      domainName: req.body?.domainName ? String(req.body.domainName) : undefined,
    });
    return res.json({ success: true, data, message: 'Disk cleanup execution completed.' });
  },

  async history(req: Request, res: Response) {
    const data = await cleanupHistoryService.listHistory(req.params.serverId, req.query.limit ? Number(req.query.limit) : undefined);
    return res.json({ success: true, data });
  },

  async jobs(req: Request, res: Response) {
    const data = await cleanupHistoryService.listJobs(req.params.serverId, req.query.limit ? Number(req.query.limit) : undefined);
    return res.json({ success: true, data });
  },

  async latestSummary(req: Request, res: Response) {
    const data = await cleanupHistoryService.latestSummary(req.params.serverId);
    return res.json({ success: true, data });
  },
};
