import { Request, Response } from 'express';
import { serverProjectService } from '../services/serverProject.service';

export const projectController = {
  async list(req: Request, res: Response) {
    const projects = await serverProjectService.list(req.params.serverId);
    return res.json({
      success: true,
      data: projects,
    });
  },

  async sync(req: Request, res: Response) {
    const projects = await serverProjectService.sync(req.params.serverId);
    return res.json({
      success: true,
      data: projects,
      message: 'Project discovery synced.',
    });
  },
};
