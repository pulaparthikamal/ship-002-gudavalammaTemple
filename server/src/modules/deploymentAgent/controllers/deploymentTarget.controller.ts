import { Request, Response } from 'express';
import { deploymentTargetService } from '../services/deploymentTarget.service';
import { getRequestUserId } from '../../serverManagement/utils/user.util';

export const deploymentTargetController = {
  async create(req: Request, res: Response) {
    const target = await deploymentTargetService.create(req.body, getRequestUserId(req));
    return res.status(201).json({ success: true, data: target, message: 'Deployment target registered.' });
  },

  async list(req: Request, res: Response) {
    const targets = await deploymentTargetService.list(getRequestUserId(req));
    return res.json({ success: true, data: targets });
  },

  async getById(req: Request, res: Response) {
    const target = await deploymentTargetService.getById(req.params.id, getRequestUserId(req));
    return res.json({ success: true, data: target });
  },

  async update(req: Request, res: Response) {
    const target = await deploymentTargetService.update(req.params.id, req.body, getRequestUserId(req));
    return res.json({ success: true, data: target, message: 'Deployment target updated.' });
  },

  async remove(req: Request, res: Response) {
    await deploymentTargetService.remove(req.params.id, getRequestUserId(req));
    return res.json({ success: true, data: null, message: 'Deployment target removed.' });
  },

  async testConnection(req: Request, res: Response) {
    const result = await deploymentTargetService.testConnection(req.params.id, getRequestUserId(req));
    return res.json({ success: true, data: result, message: `Connection ${result.status}.` });
  },
};
