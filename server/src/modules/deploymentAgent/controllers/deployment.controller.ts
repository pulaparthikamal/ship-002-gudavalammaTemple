import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { deploymentService } from '../services/deployment.service';
import { deploymentPredictionService } from '../services/deploymentPrediction.service';
import { getRequestUserId } from '../../serverManagement/utils/user.util';

export const deploymentController = {
  async trigger(req: Request, res: Response) {
    const deployment = await deploymentService.trigger({
      ...req.body,
      triggeredBy: getRequestUserId(req),
    });
    return res.status(202).json({
      success: true,
      data: deployment,
      message: 'Deployment started. Monitor logs for progress.',
    });
  },

  async list(req: Request, res: Response) {
    const result = await deploymentService.list(req.query as any);
    return res.json({
      success: true,
      data: result.items,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  },

  async getById(req: Request, res: Response) {
    const deployment = await deploymentService.getById(req.params.id);
    return res.json({ success: true, data: deployment });
  },

  async cancel(req: Request, res: Response) {
    await deploymentService.cancel(req.params.id);
    return res.json({ success: true, data: null, message: 'Deployment cancelled.' });
  },

  async rollback(req: Request, res: Response) {
    const userId = getRequestUserId(req);
    const deployment = await deploymentService.rollback(
      req.params.id,
      req.body?.reason,
      {
        targetVersion: req.body?.targetVersion,
        confidenceScore: req.body?.confidenceScore,
        riskLevel: req.body?.riskLevel,
        triggeredBy: userId ? new Types.ObjectId(userId) : undefined,
      },
    );
    return res.json({ success: true, data: deployment, message: 'Rollback initiated.' });
  },

  async getLogs(req: Request, res: Response) {
    const logs = await deploymentService.getLogs(req.params.id, req.query as any);
    return res.json({ success: true, data: logs });
  },

  async getVersionHistory(req: Request, res: Response) {
    const versions = await deploymentService.getVersionHistory(req.params.id);
    return res.json({ success: true, data: versions });
  },

  async analyzeRollback(req: Request, res: Response) {
    const analysis = await deploymentService.analyzeRollback(req.params.id, req.body?.targetVersion);
    return res.json({ success: true, data: analysis });
  },

  async getRollbackHistory(req: Request, res: Response) {
    const history = await deploymentService.getRollbackHistory(req.params.id);
    return res.json({ success: true, data: history });
  },

  async getRollbackStats(_req: Request, res: Response) {
    const stats = await deploymentService.getRollbackStats();
    return res.json({ success: true, data: stats });
  },

  // ─── Predictive Intelligence ──────────────────────────────────────────────

  async predict(req: Request, res: Response) {
    const userId = getRequestUserId(req);
    const prediction = await deploymentPredictionService.predict({
      ...req.body,
      triggeredBy: userId ? new Types.ObjectId(userId) : undefined,
    });
    return res.json({ success: true, data: prediction });
  },

  async listPredictions(req: Request, res: Response) {
    const result = await deploymentPredictionService.list(req.query as any);
    return res.json({
      success: true,
      data: result.items,
      meta: { total: result.total, page: result.page, limit: result.limit },
    });
  },

  async getPredictionById(req: Request, res: Response) {
    const prediction = await deploymentPredictionService.getById(req.params.id);
    return res.json({ success: true, data: prediction });
  },

  async getDeploymentPrediction(req: Request, res: Response) {
    const prediction = await deploymentPredictionService.getByDeployment(req.params.id);
    return res.json({ success: true, data: prediction });
  },

  async getApplicationVersionHistory(req: Request, res: Response) {
    const versions = await deploymentService.getApplicationVersionHistory(req.query.applicationId as string);
    return res.json({ success: true, data: versions });
  },

  async rollbackToVersion(req: Request, res: Response) {
    const userId = getRequestUserId(req);
    const deployment = await deploymentService.rollbackToVersion(
      req.params.targetDeploymentId,
      req.body?.reason,
      {
        confidenceScore: req.body?.confidenceScore,
        riskLevel: req.body?.riskLevel,
        triggeredBy: userId ? new Types.ObjectId(userId) : undefined,
      },
    );
    return res.status(202).json({ success: true, data: deployment, message: 'Rollback initiated.' });
  },
};
