import cron from 'node-cron';
import { envConfig } from '../../../config/env.config';
import { logger } from '../../../utils/logger.util';
import { timelyFilingAlertService } from './timely-filing-alert.service';

let task: ReturnType<typeof cron.schedule> | null = null;
let inFlight = false;

export const timelyFilingAlertScheduler = {
  start() {
    if (task || !envConfig.rcmTimelyFilingScanEnabled) {
      if (!envConfig.rcmTimelyFilingScanEnabled) {
        logger.info('[RCM Timely Filing] automatic scan scheduler disabled');
      }
      return;
    }

    task = cron.schedule(
      envConfig.rcmTimelyFilingScanCron,
      () => {
        void this.runScheduledScan();
      },
      {
        timezone: envConfig.rcmTimelyFilingScanTimezone,
      }
    );

    logger.info(
      `[RCM Timely Filing] automatic scan scheduled: "${envConfig.rcmTimelyFilingScanCron}" timezone=${envConfig.rcmTimelyFilingScanTimezone}`
    );

    if (envConfig.rcmTimelyFilingScanOnStartup) {
      setTimeout(() => {
        void this.runScheduledScan();
      }, 1000).unref?.();
    }
  },

  stop() {
    task?.stop();
    task = null;
  },

  async runScheduledScan() {
    if (inFlight) {
      logger.info('[RCM Timely Filing] scheduled scan skipped because a scan is already running');
      return;
    }

    inFlight = true;
    try {
      logger.info('[RCM Timely Filing] scheduled scan started');
      const result = await timelyFilingAlertService.refreshOpenClaims();
      logger.info(
        `[RCM Timely Filing] scheduled scan completed: scanned=${result.scannedClaims}, updated=${result.alertsUpdated}, risks=${result.riskAlerts}, expired=${result.expiredAlerts}`
      );
    } catch (error) {
      logger.error(
        `[RCM Timely Filing] scheduled scan failed: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      inFlight = false;
    }
  },
};
