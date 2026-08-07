import { logger } from '../../../utils/logger.util';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { ServerConnection } from '../models/serverConnection.model';
import { configService } from './config.service';
import { scanService } from './scan.service';

const schedulerTickMs = Math.max(
  60000,
  Number(process.env.CLEANUP_SCHEDULER_TICK_MS) || 60000,
);
let cleanupInterval: NodeJS.Timeout | null = null;
let cleanupLoopInFlight = false;
const serversInFlight = new Set<string>();

export const cleanupSchedulerService = {
  start() {
    if (cleanupInterval) {
      return;
    }

    cleanupInterval = setInterval(() => {
      void this.runDueCleanups();
    }, schedulerTickMs);

    setTimeout(() => {
      void this.runDueCleanups();
    }, 15000);

    logger.info('Cleanup scheduler started');
  },

  stop() {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
      cleanupInterval = null;
    }
  },

  async runDueCleanups() {
    if (cleanupLoopInFlight) {
      return;
    }

    cleanupLoopInFlight = true;
    try {
      const servers = await ServerConnection.find({ active: true, status: { $ne: 'disabled' } })
        .select({ _id: 1, host: 1, name: 1 })
        .lean();

      for (const server of servers) {
        const serverId = String(server._id);
        if (serversInFlight.has(serverId)) {
          continue;
        }

        try {
          const config = await configService.get(serverId);
          if (!config.cleanupAutomationEnabled) {
            continue;
          }

          const dueAfterMs = Math.max(config.cleanupFrequencyMinutes, 1) * 60000;
          const lastRunAt = config.lastCleanupRunAt?.getTime() || 0;
          if (lastRunAt && Date.now() - lastRunAt < dueAfterMs) {
            continue;
          }

          serversInFlight.add(serverId);
          await this.runCleanupForServer(serverId);
        } catch (error) {
          logger.warn(
            `Scheduled cleanup failed for server ${server.name || server.host || server._id}`,
            error,
          );
        } finally {
          serversInFlight.delete(serverId);
        }
      }
    } finally {
      cleanupLoopInFlight = false;
    }
  },

  async runCleanupForServer(serverId: string) {
    await configService.markCleanupRunStarted(serverId, new Date());
    const preview = await scanService.recommendCleanup(serverId, undefined, 'scheduled');
    const execution = await scanService.executeCleanupRecommendations(serverId, preview.scanId, 'scheduled');
    const succeeded = execution.recommendations.filter((item) => item.executionStatus === 'success').length;
    const failed = execution.recommendations.filter((item) => item.executionStatus === 'failed').length;
    await configService.markCleanupRunCompleted(serverId, new Date());

    await MaintenanceLog.create({
      server: serverId,
      action: 'decision',
      status: failed ? 'failed' : 'success',
      reason: `Scheduled cleanup completed with ${succeeded} succeeded and ${failed} failed actions.`,
      aiDecisionTrace: [
        'Cleanup scheduler used cleanupFrequencyMinutes to determine due work.',
        'Duplicate server cleanup jobs were blocked by an in-memory in-flight lock.',
        'Execution consumed only persisted recommendation records for this scan.',
      ],
      metadata: {
        scanId: preview.scanId,
        auditLogId: preview.audit.logId,
        recommendationSummary: preview.summary,
        executableCount: execution.recommendations.filter((item) =>
          item.recommendedAction === 'archive' || item.recommendedAction === 'delete',
        ).length,
        succeeded,
        failed,
        executionSummary: execution.executionSummary,
      },
      created: new Date(),
    });

    return {
      scanId: preview.scanId,
      executableCount: execution.recommendations.filter((item) =>
        item.recommendedAction === 'archive' || item.recommendedAction === 'delete',
      ).length,
      succeeded,
      failed,
      executionSummary: execution.executionSummary,
    };
  },
};
