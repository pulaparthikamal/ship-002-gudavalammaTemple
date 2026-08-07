import { Request, Response } from 'express';
import { FileAction } from '../models/scanResult.model';
import { executionService } from '../services/execution.service';

export const manualController = {
  async action(req: Request, res: Response) {
    const { serverId, fileIds, action, reason } = req.body as {
      serverId: string;
      fileIds: string[];
      action: FileAction;
      reason?: string;
    };
    const result = await executionService.executeManualAction(serverId, fileIds, action, reason);
    return res.json({
      success: true,
      data: result,
      message: `Manual ${action} action completed.`,
    });
  },
};
