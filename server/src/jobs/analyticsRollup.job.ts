import cron from 'node-cron';
import { analyticsEventService } from '../modules/analytics/analyticsEvent.service';
import { logger } from '../utils/logger.util';

const yesterdayKey = (): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
};

/**
 * Nightly at 01:00 server time: pre-aggregate the previous day's raw
 * AnalyticsEvent rows into one AnalyticsDailyRollup document. The staff
 * Analytics page's daily-visits trend reads from this rollup (fast,
 * pre-computed) rather than re-aggregating raw events on every page load;
 * top pages/clicks/funnels still query raw events live for flexibility.
 */
export const startAnalyticsRollupCron = () => {
  cron.schedule('0 1 * * *', async () => {
    const date = yesterdayKey();
    try {
      await analyticsEventService.computeDailyRollup(date);
      logger.info(`Analytics daily rollup computed for ${date}`);
    } catch (error) {
      logger.error(`Analytics daily rollup failed for ${date}:`, error as Error);
    }
  });
};
