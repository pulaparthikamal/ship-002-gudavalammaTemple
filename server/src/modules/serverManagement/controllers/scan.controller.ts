import { Request, Response } from 'express';
import { scanService } from '../services/scan.service';
import { getRequestUserId } from '../utils/user.util';
import { withDashboardEndpointLog } from '../utils/dashboardEndpointLog.util';

export const scanController = {
  async start(req: Request, res: Response) {
    const { serverId, directories } = req.body as { serverId: string; directories?: string[] };
    
    // Start scan in background to avoid blocking the HTTP response
    void scanService.startScan(serverId, directories, 'manual').catch((err) => {
      console.error(`Manual scan failed for server ${serverId}:`, err);
    });

    return res.status(202).json({
      success: true,
      message: 'Scan initiated in background. You will be notified via the dashboard when results are available.',
    });
  },

  async results(req: Request, res: Response) {
    const results = await withDashboardEndpointLog(
      'scan/results',
      'mongo',
      () => scanService.getResults({
        ...(req.query as Record<string, string>),
        markReviewed: false,
        latest: req.query.latest === 'true',
        reviewedBy: getRequestUserId(req),
      }),
      'markReviewed=false',
    );

    return res.json({
      success: true,
      data: results,
      meta: {
        reviewLifecycle:
          'pending_review results are marked reviewed when displayed by the dashboard.',
      },
    });
  },

  async cleanupRecommendations(req: Request, res: Response) {
    const { serverId, directories } = req.body as { serverId: string; directories?: string[] };
    const data = await scanService.recommendCleanup(serverId, directories);

    return res.json({
      success: true,
      data,
      message: 'Cleanup recommendations prepared. No files were modified.',
    });
  },
};
