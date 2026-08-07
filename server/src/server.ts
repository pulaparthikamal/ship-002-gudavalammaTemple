import app from './app';
import http from 'http';
import { appConfig } from './config/app.config';
import { connectDB } from './config/db.config';
import { monitoringService } from './modules/serverManagement/services/monitoring.service';
import { infrastructureMonitorService } from './modules/serverManagement/services/monitoring/infrastructureMonitor.service';
import { predictionSchedulerService } from './modules/serverManagement/services/predictionScheduler.service';
import { cleanupSchedulerService } from './modules/serverManagement/services/cleanupScheduler.service';
import { diskCleanupCronService } from './modules/serverManagement/services/diskCleanup/diskCleanupCron.service';
import { reportCronService } from './modules/deploymentAgent/services/reportCron.service';
import { socketService } from './modules/serverManagement/services/socket.service';
import { cpuMemLivePollerService } from './modules/serverManagement/services/monitoring/cpuMemLivePoller.service';
import { fileScannerService } from './modules/serverManagement/services/fileScanner.service';
import { logger } from './utils/logger.util';
import { startSocialCron } from './jobs/socialCron';
import { startAutomationSeedCron, runSeedCatchUp } from './jobs/automationSeedCron';
import { validateClaimSubmissionStartupConfig } from './modules/rcm/claim-submission/claim-submission.integration.config';
import { timelyFilingAlertScheduler } from './modules/rcm/timely-filing-alert/timely-filing-alert.scheduler';
import {
  startMongoRcmQueueWorker,
  stopMongoRcmQueueWorker,
  validateRcmQueueStartupConfig,
} from './modules/rcm/background-job/rcm-queue.service';
// import { startSocialScheduler } from './workers/social-scheduler/scheduler'; // Disabled: replaced by automationSeedCron

/**
 * Start a background service without letting it block or crash startup.
 * - Synchronous throws are caught and logged.
 * - Returned promises are not awaited (so a slow service can't delay boot) but
 *   their rejections are logged instead of becoming unhandled rejections.
 */
const safeStart = (name: string, fn: () => unknown): void => {
  try {
    const result = fn();
    if (result && typeof (result as { catch?: unknown }).catch === 'function') {
      (result as Promise<unknown>).catch((err: unknown) =>
        logger.error(`[Startup] ${name} failed: ${(err as Error)?.message || err}`)
      );
    }
  } catch (err) {
    logger.error(`[Startup] ${name} failed: ${(err as Error)?.message || err}`);
  }
};

/**
 * Kick off all monitors, schedulers and crons. Called AFTER the HTTP server is
 * already listening, so none of them (notably the infrastructure monitor's initial
 * SSH sweep, which previously blocked startup for ~10 minutes) can delay the port
 * from binding. Order is preserved; nothing here is awaited.
 */
const bootstrapBackgroundServices = (): void => {
  safeStart('monitoringService', () => monitoringService.start());
  safeStart('rcmQueueWorker', () => startMongoRcmQueueWorker());
  safeStart('timelyFilingAlertScheduler', () => timelyFilingAlertScheduler.start());

  // Previously `await`-ed before server.listen() — this was the main cause of the
  // ~10 minute startup. Now started in the background; the server is already up.
  safeStart('infrastructureMonitorService', () => infrastructureMonitorService.start());

  safeStart('socialCron', () => startSocialCron());
  safeStart('automationSeedCron', () => startAutomationSeedCron());

  // Fix #3: on startup, catch up any missed seed windows from server downtime.
  safeStart('seedCatchUp', () => runSeedCatchUp());

  safeStart('predictionScheduler', () => predictionSchedulerService.start());
  safeStart('fileScanner', () => fileScannerService.start());
  safeStart('cleanupScheduler', () => cleanupSchedulerService.start());
  safeStart('diskCleanupCron', () => diskCleanupCronService.start());
  safeStart('reportCron', () => reportCronService.start());

  logger.info('[Startup] Background services initialised.');
};

const startServer = async () => {
  try {
    const claimSubmissionConfigHealth = validateClaimSubmissionStartupConfig();
    // claimSubmissionConfigHealth.warnings.forEach((warning) => logger.debug(`[RCM Config] ${warning}`));
    if (claimSubmissionConfigHealth.errors.length) {
      throw new Error(`RCM claim submission configuration is invalid: ${claimSubmissionConfigHealth.errors.join(' ')}`);
    }
    const rcmQueueConfigHealth = validateRcmQueueStartupConfig();
    // rcmQueueConfigHealth.warnings.forEach((warning) => logger.debug(`[RCM Queue] ${warning}`));
    if (rcmQueueConfigHealth.errors.length) {
      throw new Error(`RCM queue configuration is invalid: ${rcmQueueConfigHealth.errors.join(' ')}`);
    }

    // The only genuine prerequisite for serving requests.
    await connectDB();

    const server = http.createServer(app);
    socketService.initialize(server);

    // Bind the port FIRST. Background services start from inside the listen
    // callback so a slow initial sweep can never hold up startup.
    server.listen(appConfig.port, () => {
      logger.info(
        `${appConfig.name} is running in ${appConfig.env} mode on port ${appConfig.port}`
      );
      logger.info(
        `API Documentation available at http://localhost:${appConfig.port}${appConfig.apiPrefix}/docs`
      );

      console.log('\n===================================================');
      console.log(`🚀 Server running on port: \x1b[32m${appConfig.port}\x1b[0m`);
      console.log(`🌐 Base URL: \x1b[36mhttp://localhost:${appConfig.port}\x1b[0m`);
      console.log(`📚 API Docs: \x1b[36mhttp://localhost:${appConfig.port}${appConfig.apiPrefix}/docs\x1b[0m`);
      console.log('===================================================\n');

      // Server is already accepting connections; warm up everything else now.
      bootstrapBackgroundServices();
    });


    // Set server timeout to 10 minutes (600,000ms) for AI tasks
    server.setTimeout(600_000);

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err: Error) => {
      const msg = err?.message || String(err);
      const name = (err as any)?.name || '';

      // Ignore transient SSH/network errors — SSH2 fires these after promises are settled
      const isTransientSshError = /ECONNRESET|EPIPE|ETIMEDOUT|connection lost|read ECONNRESET|handshake/i.test(msg);

      // Ignore transient MongoDB errors — Mongoose reconnects automatically, no need to crash
      const isTransientMongoError = /MongoPoolClearedError|MongoNetworkError|MongoServerSelectionError|PoolClearedOnNetworkError/i.test(name)
        || /connection.*timed out|ENETUNREACH|ECONNREFUSED|server selection timed out/i.test(msg);

      if (isTransientSshError || isTransientMongoError) return;

      logger.error('UNHANDLED REJECTION! Shutting down...', err);
      stopMongoRcmQueueWorker();
      timelyFilingAlertScheduler.stop();
      monitoringService.stop();
      infrastructureMonitorService.stop();
      predictionSchedulerService.stop();
      cleanupSchedulerService.stop();
      diskCleanupCronService.stop();
      reportCronService.stop();
      cpuMemLivePollerService.stopAll();
      fileScannerService.stop();
      server.close(() => {
        process.exit(1);
      });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (err: Error) => {
      const msg = err?.message || String(err);
      const name = (err as any)?.name || '';

      // Ignore transient SSH/network errors that fire on raw TCP sockets
      const isTransientSshError = /ECONNRESET|EPIPE|ETIMEDOUT|connection lost|read ECONNRESET|handshake/i.test(msg);

      // Ignore transient MongoDB errors — Mongoose reconnects automatically
      const isTransientMongoError = /MongoPoolClearedError|MongoNetworkError|MongoServerSelectionError|PoolClearedOnNetworkError/i.test(name)
        || /connection.*timed out|ENETUNREACH|ECONNREFUSED|server selection timed out/i.test(msg);

      if (isTransientSshError || isTransientMongoError) return;

      logger.error('UNCAUGHT EXCEPTION! Shutting down...', err);
      stopMongoRcmQueueWorker();
      timelyFilingAlertScheduler.stop();
      process.exit(1);
    });

    process.on('SIGTERM', () => {
      logger.info('SIGTERM received. Stopping RCM queue worker and closing server...');
      stopMongoRcmQueueWorker();
      timelyFilingAlertScheduler.stop();
      diskCleanupCronService.stop();
      reportCronService.stop();
      server.close(() => process.exit(0));
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
