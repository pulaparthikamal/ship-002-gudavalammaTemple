import { Types } from 'mongoose';
import {
  IncidentPattern,
  ILogProcessed,
  LogCleanupHistory,
  LogProcessed,
  LogSeverity,
} from '../../models/logAnalysis.model';

const severities: LogSeverity[] = ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'];

const stripNormalizationTokens = (value = '') =>
  value
    .replace(/<\/?(?:num|ip|path|hex)>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const getDisplayMessage = (log: {
  displayMessage?: string;
  rawMessage?: string;
  message?: string;
}) =>
  stripNormalizationTokens(log.displayMessage || log.rawMessage || log.message || '');

const patternTitle = (log: ILogProcessed) => {
  const service = log.service ? `${log.service}: ` : '';
  return `${service}${getDisplayMessage(log).slice(0, 90)}`;
};

const unique = (items: Array<string | undefined>) =>
  Array.from(new Set(items.filter((item): item is string => Boolean(item))));

export const logAggregationService = {
  async recordPatterns(logs: ILogProcessed[]) {
    for (const log of logs) {
      if (log.severity === 'INFO') {
        continue;
      }

      const now = new Date();
      await IncidentPattern.updateOne(
        { server: log.server, fingerprint: log.fingerprint },
        {
          $setOnInsert: {
            server: log.server,
            fingerprint: log.fingerprint,
            severity: log.severity,
            source: log.source,
            title: patternTitle(log),
            summary: getDisplayMessage(log).slice(0, 300),
            firstSeenAt: log.timestamp,
            createdAt: now,
            status: 'open',
          },
          $set: {
            lastSeenAt: log.timestamp,
            updatedAt: now,
          },
          $addToSet: {
            affectedServices: { $each: unique([log.service]) },
            sampleMessages: getDisplayMessage(log).slice(0, 500),
            rootCauseSuggestions: log.rootCauseSuggestion,
          },
          $inc: { occurrenceCount: 1 },
        },
        { upsert: true },
      );
    }
  },

  async getSummary(serverId?: string, severity?: LogSeverity[]) {
    const query: Record<string, unknown> = {};
    if (serverId) {
      query.server = new Types.ObjectId(serverId);
    }
    if (severity?.length) {
      query.severity = { $in: severity };
    }

    const [bySeverity, bySource, recentLogs, incidents, cleanupRecommendations] = await Promise.all([
      LogProcessed.aggregate([
        { $match: query },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      LogProcessed.aggregate([
        { $match: query },
        { $group: { _id: '$source', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      LogProcessed.find(query).sort({ timestamp: -1 }).limit(50).lean(),
      IncidentPattern.find(serverId ? { server: new Types.ObjectId(serverId) } : {})
        .sort({ lastSeenAt: -1 })
        .limit(25)
        .lean(),
      LogCleanupHistory.find({
        ...(serverId ? { server: new Types.ObjectId(serverId) } : {}),
        status: 'recommended',
      })
        .sort({ recommendedAt: -1 })
        .limit(25)
        .lean(),
    ]);

    const severityCounts = severities.reduce<Record<LogSeverity, number>>((acc, item) => {
      acc[item] = 0;
      return acc;
    }, {} as Record<LogSeverity, number>);

    bySeverity.forEach((item) => {
      if (severities.includes(item._id)) {
        severityCounts[item._id as LogSeverity] = item.count;
      }
    });

    return {
      severityCounts,
      sourceCounts: bySource.map((item) => ({ source: item._id, count: item.count })),
      recentLogs: recentLogs.map((log) => ({
        ...log,
        rawMessage: log.rawMessage || log.message || '',
        normalizedPattern: log.normalizedPattern || log.normalizedMessage || '',
        displayMessage: getDisplayMessage(log),
      })),
      incidents: incidents.map((incident) => ({
        ...incident,
        title: stripNormalizationTokens(incident.title),
        summary: stripNormalizationTokens(incident.summary),
        sampleMessages: incident.sampleMessages.map(stripNormalizationTokens),
        rootCauseSuggestions: incident.rootCauseSuggestions.map(stripNormalizationTokens),
      })),
      cleanupRecommendations,
      rootCauseSuggestions: incidents.slice(0, 8).map((incident) => ({
        patternId: incident._id,
        title: stripNormalizationTokens(incident.title),
        severity: incident.severity,
        suggestions: incident.rootCauseSuggestions.map(stripNormalizationTokens),
      })),
    };
  },
};
