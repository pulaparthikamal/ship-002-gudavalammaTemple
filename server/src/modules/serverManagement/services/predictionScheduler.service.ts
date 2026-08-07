import { logger } from '../../../utils/logger.util';
import { ServerConnection } from '../models/serverConnection.model';
import { agentService } from './agent.service';
import { configService } from './config.service';

let predictionInterval: NodeJS.Timeout | null = null;
let predictionsInFlight = false;

export const predictionSchedulerService = {
  start() {
    if (predictionInterval) {
      return;
    }

    predictionInterval = setInterval(() => {
      void this.runDuePredictions();
    }, 60000);

    setTimeout(() => {
      void this.runDuePredictions();
    }, 10000);

    logger.info('Prediction scheduler started');
  },

  stop() {
    if (predictionInterval) {
      clearInterval(predictionInterval);
      predictionInterval = null;
    }
  },

  async runDuePredictions() {
    if (predictionsInFlight) {
      return;
    }

    predictionsInFlight = true;
    try {
      const servers = await ServerConnection.find({ active: true, status: { $ne: 'disabled' } })
        .select({ _id: 1, host: 1, name: 1 })
        .lean();

      for (const server of servers) {
        try {
          const config = await configService.get(String(server._id));
          const dueAfterMs = Math.max(config.predictionIntervalMinutes, 1) * 60000;
          const lastRunAt = config.lastPredictionRunAt?.getTime() || 0;

          if (lastRunAt && Date.now() - lastRunAt < dueAfterMs) {
            continue;
          }

          await configService.markPredictionRun(server._id, new Date());
          await agentService.predictMaintenance(String(server._id));
        } catch (error) {
          logger.warn(
            `Scheduled prediction failed for server ${server.name || server.host || server._id}`,
            error,
          );
        }
      }
    } catch (error) {
      logger.error('Error running due predictions in scheduler:', error);
    } finally {
      predictionsInFlight = false;
    }
  },
};
