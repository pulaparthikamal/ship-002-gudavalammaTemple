import { Types } from 'mongoose';
import { DeploymentLog, LogLevel } from '../models/deploymentLog.model';

export const deploymentLogService = {
  async write(
    deploymentId: string | Types.ObjectId,
    message: string,
    level: LogLevel = 'info',
    stepName?: string,
  ) {
    return DeploymentLog.create({
      deploymentId: new Types.ObjectId(String(deploymentId)),
      stepName,
      level,
      message,
      timestamp: new Date(),
    });
  },

  async getLogs(
    deploymentId: string,
    options: {
      stepName?: string;
      level?: LogLevel;
      since?: Date;
      limit?: number;
    } = {},
  ) {
    const filter: Record<string, unknown> = {
      deploymentId: new Types.ObjectId(deploymentId),
    };
    if (options.stepName) filter.stepName = options.stepName;
    if (options.level) filter.level = options.level;
    if (options.since) filter.timestamp = { $gte: options.since };

    const limit = Math.min(5000, options.limit || 1000);
    return DeploymentLog.find(filter).sort({ timestamp: 1 }).limit(limit);
  },

  async clearForDeployment(deploymentId: string) {
    return DeploymentLog.deleteMany({ deploymentId: new Types.ObjectId(deploymentId) });
  },

  createLogger(deploymentId: string | Types.ObjectId, stepName?: string) {
    const id = String(deploymentId);
    return {
      info: (msg: string) => deploymentLogService.write(id, msg, 'info', stepName),
      warn: (msg: string) => deploymentLogService.write(id, msg, 'warn', stepName),
      error: (msg: string) => deploymentLogService.write(id, msg, 'error', stepName),
      debug: (msg: string) => deploymentLogService.write(id, msg, 'debug', stepName),
    };
  },
};
