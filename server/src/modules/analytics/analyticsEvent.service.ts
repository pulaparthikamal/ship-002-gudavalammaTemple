import { Types } from 'mongoose';
import { AnalyticsEvent } from './analyticsEvent.model';
import { AnalyticsDailyRollup } from './analyticsDailyRollup.model';
import { FUNNEL_NAMES, INSTRUMENTED_CLICK_LABELS } from './analytics.constants';

interface RawEventInput {
  sessionId: string;
  path: string;
  eventType: 'pageview' | 'click' | 'funnel_step';
  targetLabel?: string;
  funnelName?: string;
  stepIndex?: number;
  stepName?: string;
  durationMs?: number;
  timestamp: Date;
}

const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

const dayRange = (dateStr: string): { start: Date; end: Date } => {
  const start = new Date(`${dateStr}T00:00:00.000Z`);
  const end = new Date(`${dateStr}T23:59:59.999Z`);
  return { start, end };
};

const dateNDaysAgo = (n: number): Date => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

async function aggregateFunnelForRange(funnelName: string, start: Date, end: Date) {
  const rows = await AnalyticsEvent.aggregate([
    { $match: { eventType: 'funnel_step', funnelName, timestamp: { $gte: start, $lte: end } } },
    {
      $group: {
        _id: { stepIndex: '$stepIndex', stepName: '$stepName' },
        sessions: { $addToSet: '$sessionId' },
      },
    },
    {
      $project: {
        _id: 0,
        stepIndex: '$_id.stepIndex',
        stepName: '$_id.stepName',
        count: { $size: '$sessions' },
      },
    },
    { $sort: { stepIndex: 1 } },
  ]);
  return rows as Array<{ stepIndex: number; stepName: string; count: number }>;
}

export const analyticsEventService = {
  async ingestBatch(events: RawEventInput[], userId?: string) {
    const docs = events.map((event) => ({
      ...event,
      userId: userId && Types.ObjectId.isValid(userId) ? new Types.ObjectId(userId) : undefined,
    }));
    await AnalyticsEvent.insertMany(docs, { ordered: false });
    return { ingested: docs.length };
  },

  async computeDailyRollup(dateStr: string) {
    const { start, end } = dayRange(dateStr);
    const match = { timestamp: { $gte: start, $lte: end } };

    const [totalPageviews, totalClicks, uniqueSessionRows, topPages, topClicks, funnels] = await Promise.all([
      AnalyticsEvent.countDocuments({ ...match, eventType: 'pageview' }),
      AnalyticsEvent.countDocuments({ ...match, eventType: 'click' }),
      AnalyticsEvent.aggregate([{ $match: match }, { $group: { _id: '$sessionId' } }, { $count: 'count' }]),
      AnalyticsEvent.aggregate([
        { $match: { ...match, eventType: 'pageview' } },
        { $group: { _id: '$path', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { ...match, eventType: 'click' } },
        { $group: { _id: '$targetLabel', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
        { $project: { _id: 0, key: '$_id', count: 1 } },
      ]),
      Promise.all(
        FUNNEL_NAMES.map(async (funnelName) => ({
          funnelName,
          steps: await aggregateFunnelForRange(funnelName, start, end),
        }))
      ),
    ]);

    const uniqueSessions = uniqueSessionRows[0]?.count ?? 0;

    const rollup = await AnalyticsDailyRollup.findOneAndUpdate(
      { date: dateStr },
      {
        $set: {
          date: dateStr,
          totalPageviews,
          totalClicks,
          uniqueSessions,
          topPages,
          topClicks,
          funnels: funnels.filter((f) => f.steps.length > 0),
          updated: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return rollup;
  },

  async getDailyTrend(days: number) {
    const since = dateNDaysAgo(days - 1);
    const sinceKey = dateKey(since);

    const rollups = await AnalyticsDailyRollup.find({ date: { $gte: sinceKey } })
      .sort({ date: 1 })
      .lean();

    const todayKey = dateKey(new Date());
    const hasToday = rollups.some((r) => r.date === todayKey);

    const result = rollups.map((r) => ({
      date: r.date,
      totalPageviews: r.totalPageviews,
      uniqueSessions: r.uniqueSessions,
    }));

    if (!hasToday) {
      const { start, end } = dayRange(todayKey);
      const [totalPageviews, sessionRows] = await Promise.all([
        AnalyticsEvent.countDocuments({ eventType: 'pageview', timestamp: { $gte: start, $lte: end } }),
        AnalyticsEvent.aggregate([
          { $match: { timestamp: { $gte: start, $lte: end } } },
          { $group: { _id: '$sessionId' } },
          { $count: 'count' },
        ]),
      ]);
      result.push({ date: todayKey, totalPageviews, uniqueSessions: sessionRows[0]?.count ?? 0 });
    }

    return result;
  },

  async getTopPages(days: number, limit = 10) {
    const since = dateNDaysAgo(days - 1);
    return AnalyticsEvent.aggregate([
      { $match: { eventType: 'pageview', timestamp: { $gte: since } } },
      { $group: { _id: '$path', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, key: '$_id', count: 1 } },
    ]);
  },

  async getTopClicks(days: number, limit = 10) {
    const since = dateNDaysAgo(days - 1);
    return AnalyticsEvent.aggregate([
      { $match: { eventType: 'click', timestamp: { $gte: since } } },
      { $group: { _id: '$targetLabel', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
      { $project: { _id: 0, key: '$_id', count: 1 } },
    ]);
  },

  async getFunnelDropoffs(days: number) {
    const since = dateNDaysAgo(days - 1);
    const now = new Date();
    const funnels = await Promise.all(
      FUNNEL_NAMES.map(async (funnelName) => ({
        funnelName,
        steps: await aggregateFunnelForRange(funnelName, since, now),
      }))
    );
    return funnels;
  },

  async getFeatureUsage(days: number) {
    const since = dateNDaysAgo(days - 1);
    const rows = await AnalyticsEvent.aggregate([
      { $match: { eventType: 'click', timestamp: { $gte: since }, targetLabel: { $in: [...INSTRUMENTED_CLICK_LABELS] } } },
      { $group: { _id: '$targetLabel', count: { $sum: 1 } } },
    ]);
    const counts = new Map(rows.map((r) => [r._id as string, r.count as number]));
    return INSTRUMENTED_CLICK_LABELS.map((label) => ({
      label,
      count: counts.get(label) ?? 0,
      used: (counts.get(label) ?? 0) > 0,
    }));
  },

  async getSummary(days: number) {
    const [dailyTrend, topPages, topClicks, funnels, featureUsage] = await Promise.all([
      this.getDailyTrend(days),
      this.getTopPages(days),
      this.getTopClicks(days),
      this.getFunnelDropoffs(days),
      this.getFeatureUsage(days),
    ]);
    return { dailyTrend, topPages, topClicks, funnels, featureUsage };
  },
};
