import cron from 'node-cron';
import { logger } from '../../../../utils/logger.util';
import { DiskCleanupPolicy } from '../../models/diskCleanup.model';
import { cleanupPolicyService } from './cleanupPolicy.service';
import { diskCleanupAgentService } from './diskCleanupAgent.service';

let task: ReturnType<typeof cron.schedule> | null = null;
let inFlight = false;

export const diskCleanupCronService = {
  start() {
    if (task) {
      return;
    }
    task = cron.schedule(process.env.DISK_CLEANUP_CRON_EXPRESSION || '0 2 * * *', () => {
      void this.runDailyCleanup();
    });
    logger.info('[DiskCleanup] daily cron scheduled');
  },

  stop() {
    task?.stop();
    task = null;
  },

  async runDailyCleanup() {
    if (inFlight) {
      return;
    }
    inFlight = true;
    try {
      const policies = await cleanupPolicyService.listActiveCronPolicies();
      for (const policy of policies) {
        const serverId = String(policy.serverId);
        try {
          await diskCleanupAgentService.execute(serverId, 'DAILY_CRON');
          await DiskCleanupPolicy.updateOne(
            { _id: policy._id },
            { lastCronRunAt: new Date(), updatedAt: new Date() },
          );
        } catch (error) {
          logger.warn(
            `[DiskCleanup] daily cleanup failed server=${serverId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }
    } finally {
      inFlight = false;
    }
  },
};
