import crypto from 'crypto';
import { Types } from 'mongoose';
import {
  IncidentPattern,
  ILogProcessed,
  LogProcessed,
  LogRaw,
  LogSeverity,
  SupportedLogSource,
} from '../../models/logAnalysis.model';
import { Alert } from '../../models/alert.model';
import { ServerConnection } from '../../models/serverConnection.model';
import { alertService } from '../alert.service';
import { configService } from '../config.service';
import { sshService } from '../ssh.service';
import { logAggregationService } from './logAggregation.service';
import { logCleanupService } from './logCleanup.service';
import { logParserService } from './logParser.service';
import { retentionPolicyService } from './retentionPolicy.service';

interface IngestPayload {
  serverId: string;
  source: SupportedLogSource;
  lines: string[];
  path?: string;
}

interface IntelligenceQuery {
  serverId?: string;
  severity?: LogSeverity[];
}

interface LogsQuery {
  serverId?: string;
  timeRange?: '30m' | '1h' | '4h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom';
  startTime?: string;
  endTime?: string;
  severity?: LogSeverity[];
  source?: SupportedLogSource[];
  logType?: string;
  serviceName?: string;
  keyword?: string;
  errorSecurityOnly?: boolean;
  limit?: number;
  page?: number;
  sort?: 'asc' | 'desc';
}

const supportedSources: SupportedLogSource[] = [
  'syslog',
  'auth',
  'nginx',
  'apache',
  'application',
  'docker',
  'kernel',
  'journald',
];

const sourceCommands: Record<SupportedLogSource, string> = {
  syslog: 'test -r /var/log/syslog && tail -n 250 /var/log/syslog || true',
  auth: 'test -r /var/log/auth.log && tail -n 250 /var/log/auth.log || test -r /var/log/secure && tail -n 250 /var/log/secure || true',
  nginx: 'test -r /var/log/nginx/error.log && tail -n 250 /var/log/nginx/error.log || true',
  apache: 'test -r /var/log/apache2/error.log && tail -n 250 /var/log/apache2/error.log || test -r /var/log/httpd/error_log && tail -n 250 /var/log/httpd/error_log || true',
  application: 'find /var/log -maxdepth 2 -type f \\( -name "app.log" -o -name "application.log" \\) -print -quit 2>/dev/null | xargs -r tail -n 250 || true',
  docker: 'command -v docker >/dev/null 2>&1 && docker ps --format "{{.Names}}" | head -n 5 | xargs -r -I{} docker logs --tail 80 {} 2>&1 || true',
  kernel: 'dmesg --ctime --level=err,warn,crit,alert,emerg 2>/dev/null | tail -n 250 || true',
  journald: 'command -v journalctl >/dev/null 2>&1 && journalctl -n 250 --no-pager --output short-iso || true',
};

const hashLine = (serverId: string, source: SupportedLogSource, line: string) =>
  crypto.createHash('sha256').update([serverId, source, line].join('|')).digest('hex');

const parseSeverity = (value: unknown): LogSeverity[] | undefined => {
  if (!value) {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : String(value).split(',');
  const allowed: LogSeverity[] = ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'];
  const values = rawValues
    .map((item) => String(item).trim().toUpperCase())
    .filter((item): item is LogSeverity => allowed.includes(item as LogSeverity));

  return values.length ? values : undefined;
};

const cleanDisplayMessage = (message = '') =>
  message
    .replace(/<\/?(?:num|ip|path|hex)>/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

const timeRangeToMs = (range: LogsQuery['timeRange'] = '24h') => {
  const ranges: Record<Exclude<LogsQuery['timeRange'], 'custom' | undefined>, number> = {
    '30m': 30 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '4h': 4 * 60 * 60 * 1000,
    '12h': 12 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '48h': 48 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  };
  return range === 'custom' ? ranges['24h'] : ranges[range || '24h'];
};

const resolveWindow = (query: LogsQuery) => {
  const end = query.timeRange === 'custom' && query.endTime ? new Date(query.endTime) : new Date();
  const start = query.timeRange === 'custom' && query.startTime
    ? new Date(query.startTime)
    : new Date(end.getTime() - timeRangeToMs(query.timeRange));
  return { start, end };
};

const splitValues = <T extends string>(value?: T[] | T | string) => {
  if (!value) return undefined;
  const values = Array.isArray(value) ? value : String(value).split(',');
  return values.map((item) => String(item).trim()).filter(Boolean) as T[];
};

const logToDashboardRecord = (log: any) => ({
  ...log,
  serverId: String(log.server),
  logType: log.logType || log.category,
  serviceName: log.serviceName || log.service,
  processId: log.processId || log.pid,
  filePath: log.filePath || String(log.metadata?.path || ''),
  rawLine: log.rawMessage,
  message: log.displayMessage || log.rawMessage || log.message,
  parsedFields: log.parsedFields || {
    host: log.host,
    serviceName: log.serviceName || log.service,
    processId: log.processId || log.pid,
    actor: log.actor,
    ipAddress: log.ipAddress,
    tags: log.tags,
  },
  createdAt: log.processedAt,
  probableRootCause: log.rootCauseSuggestion || 'Correlate this log with nearby metrics, alerts, and incident patterns.',
  relatedMetricsLink: `/serverAgent/metrics?serverId=${String(log.server)}`,
});

const buildLogFilter = (query: LogsQuery) => {
  const { start, end } = resolveWindow(query);
  const filter: Record<string, unknown> = {
    timestamp: { $gte: start, $lte: end },
  };
  if (query.serverId) {
    filter.server = new Types.ObjectId(query.serverId);
  }
  const severity = query.errorSecurityOnly
    ? ['ERROR', 'CRITICAL', 'SECURITY']
    : query.severity;
  if (severity?.length) {
    filter.severity = { $in: severity };
  }
  if (query.source?.length) {
    filter.source = { $in: query.source };
  }
  if (query.logType) {
    filter.$or = [
      { logType: query.logType },
      { category: query.logType },
    ];
  }
  if (query.serviceName) {
    filter.$and = [
      ...((filter.$and as unknown[]) || []),
      {
        $or: [
          { serviceName: query.serviceName },
          { service: query.serviceName },
        ],
      },
    ];
  }
  if (query.keyword) {
    const escaped = query.keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$and = [
      ...((filter.$and as unknown[]) || []),
      {
        $or: [
          { rawMessage: regex },
          { displayMessage: regex },
          { normalizedPattern: regex },
          { service: regex },
          { serviceName: regex },
          { host: regex },
          { ipAddress: regex },
        ],
      },
    ];
  }
  return { filter, start, end };
};

const maybeCreateLogAlerts = async (logs: ILogProcessed[]) => {
  const alertable = logs.filter((log) => ['CRITICAL', 'SECURITY', 'ERROR'].includes(log.severity));
  for (const log of alertable) {
    const createdAfter = new Date(Date.now() - 15 * 60 * 1000);
    const alertType = log.severity === 'SECURITY'
      ? 'security_log'
      : log.severity === 'CRITICAL'
        ? 'critical_log'
        : 'repeated_error_log';
    const existing = await Alert.findOne({
      server: log.server,
      type: alertType,
      'metadata.fingerprint': log.fingerprint,
      created: { $gte: createdAfter },
    }).select('_id').lean();
    if (existing) continue;

    if (log.severity === 'ERROR') {
      const recentCount = await LogProcessed.countDocuments({
        server: log.server,
        fingerprint: log.fingerprint,
        severity: 'ERROR',
        timestamp: { $gte: new Date(log.timestamp.getTime() - 10 * 60 * 1000), $lte: log.timestamp },
      });
      if (recentCount < 3) continue;
    }

    await alertService.create({
      serverId: log.server,
      type: /crash|segmentation fault|service unavailable|failed/i.test(log.rawMessage)
        ? 'service_crash_pattern'
        : alertType,
      severity: log.severity === 'ERROR' ? 'warning' : 'critical',
      title: log.severity === 'SECURITY' ? 'Security log detected' : `${log.severity} log detected`,
      message: cleanDisplayMessage(log.displayMessage || log.rawMessage).slice(0, 240),
      metadata: {
        source: log.source,
        serviceName: log.serviceName || log.service,
        fingerprint: log.fingerprint,
        timestamp: log.timestamp,
      },
      email: false,
    });
  }
};

export const logAnalysisService = {
  supportedSources,

  parseSeverity,

  async ingest(payload: IngestPayload) {
    if (!supportedSources.includes(payload.source)) {
      throw new Error(`Unsupported log source: ${payload.source}`);
    }

    const serverObjectId = new Types.ObjectId(payload.serverId);
    const rawCreates = payload.lines
      .filter((line) => line.trim())
      .map((line) => ({
        server: serverObjectId,
        source: payload.source,
        path: payload.path,
        line,
        fingerprint: hashLine(payload.serverId, payload.source, line),
        observedAt: new Date(),
        collectedAt: new Date(),
        metadata: { ingestion: 'log_intelligence' },
      }));

    if (!rawCreates.length) {
      return { rawInserted: 0, processedInserted: 0 };
    }

    await LogRaw.bulkWrite(
      rawCreates.map((item) => ({
        updateOne: {
          filter: { server: item.server, fingerprint: item.fingerprint },
          update: { $setOnInsert: item },
          upsert: true,
        },
      })),
      { ordered: false },
    );

    const rawDocs = await LogRaw.find({
      server: serverObjectId,
      fingerprint: { $in: rawCreates.map((item) => item.fingerprint) },
    }).lean();
    const existingProcessed = await LogProcessed.find({
      rawLog: { $in: rawDocs.map((raw) => raw._id) },
    }).select('rawLog').lean();
    const processedRawIds = new Set(existingProcessed.map((item) => String(item.rawLog)));
    const newRawDocs = rawDocs.filter((raw) => !processedRawIds.has(String(raw._id)));

    const processedCreates = newRawDocs.map((raw) => {
      const parsed = logParserService.parse({
        source: raw.source,
        path: raw.path,
        line: raw.line,
        fallbackTimestamp: raw.observedAt,
      });
      const classification = logParserService.classifyParsed(parsed);

      return {
        rawLog: raw._id,
        server: serverObjectId,
        source: raw.source,
        logType: classification.category,
        severity: classification.severity,
        rawMessage: parsed.rawMessage,
        normalizedPattern: parsed.normalizedPattern,
        displayMessage: parsed.displayMessage,
        message: parsed.rawMessage,
        normalizedMessage: parsed.normalizedPattern,
        timestamp: parsed.timestamp,
        service: parsed.service,
        serviceName: parsed.service,
        host: parsed.host,
        pid: parsed.pid,
        processId: parsed.pid,
        actor: parsed.actor,
        ipAddress: parsed.ipAddress,
        filePath: raw.path,
        category: classification.category,
        tags: classification.tags,
        parsedFields: {
          host: parsed.host,
          serviceName: parsed.service,
          processId: parsed.pid,
          actor: parsed.actor,
          ipAddress: parsed.ipAddress,
          path: raw.path,
        },
        confidence: classification.confidence,
        rootCauseSuggestion: classification.rootCauseSuggestion,
        fingerprint: parsed.fingerprint,
        metadata: { path: raw.path, rawFingerprint: raw.fingerprint },
        processedAt: new Date(),
      };
    });

    const processed = processedCreates.length
      ? await LogProcessed.insertMany(processedCreates, { ordered: false })
      : [];

    await logAggregationService.recordPatterns(processed as ILogProcessed[]);
    await maybeCreateLogAlerts(processed as ILogProcessed[]);

    return {
      rawInserted: newRawDocs.length,
      processedInserted: processed.length,
    };
  },

  async collect(serverId: string, sources: SupportedLogSource[] = supportedSources) {
    const server = await ServerConnection.findById(serverId);
    if (!server) {
      throw new Error('Server not found');
    }

    const results = [];
    for (const source of sources.filter((item) => supportedSources.includes(item))) {
      const result = await sshService.execute(server, sourceCommands[source], 30000);
      const lines = result.stdout.split(/\r?\n/).filter(Boolean);
      const ingestResult = await this.ingest({ serverId, source, lines });
      results.push({ source, ...ingestResult, stderr: result.stderr });
    }

    const recommendations = await logCleanupService.recommend(serverId);
    await logCleanupService.auditRecommendations(serverId, recommendations);

    return { sources: results, cleanupRecommendations: recommendations };
  },

  async backfillDisplayFields(serverId?: string) {
    const query: Record<string, unknown> = {
      $or: [
        { rawMessage: { $exists: false } },
        { normalizedPattern: { $exists: false } },
        { displayMessage: { $exists: false } },
      ],
    };

    if (serverId) {
      query.server = new Types.ObjectId(serverId);
    }

    const staleLogs = await LogProcessed.find(query).sort({ processedAt: -1 }).limit(500).lean();
    if (!staleLogs.length) {
      return 0;
    }

    await LogProcessed.bulkWrite(
      staleLogs.map((log) => {
        const rawMessage = log.rawMessage || log.message || '';
        const normalizedPattern = log.normalizedPattern || log.normalizedMessage || rawMessage;

        return {
          updateOne: {
            filter: { _id: log._id },
            update: {
              $set: {
                rawMessage,
                normalizedPattern,
                displayMessage: cleanDisplayMessage(log.displayMessage || rawMessage),
              },
            },
          },
        };
      }),
      { ordered: false },
    );

    return staleLogs.length;
  },

  async getIntelligence(query: IntelligenceQuery) {
    await this.backfillDisplayFields(query.serverId);
    return logAggregationService.getSummary(query.serverId, query.severity);
  },

  async queryLogs(query: LogsQuery) {
    await this.backfillDisplayFields(query.serverId);
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 500);
    const { filter, start, end } = buildLogFilter(query);
    const sortDirection = query.sort === 'asc' ? 1 : -1;

    const [logs, total, bySeverity, topServices, topErrors, countOverTime, securityEvents, recentCritical, incidents] = await Promise.all([
      LogProcessed.find(filter)
        .sort({ timestamp: sortDirection })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<(ILogProcessed & { _id: unknown })[]>(),
      LogProcessed.countDocuments(filter),
      LogProcessed.aggregate<{ _id: LogSeverity; count: number }>([
        { $match: filter },
        { $group: { _id: '$severity', count: { $sum: 1 } } },
      ]),
      LogProcessed.aggregate<{ _id: string; count: number }>([
        { $match: filter },
        { $group: { _id: { $ifNull: ['$serviceName', '$service'] }, count: { $sum: 1 } } },
        { $match: { _id: { $ne: null } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      LogProcessed.aggregate<{ _id: string; message: string; count: number }>([
        { $match: { ...filter, severity: { $in: ['ERROR', 'CRITICAL'] } } },
        { $group: { _id: '$normalizedPattern', message: { $first: '$displayMessage' }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 8 },
      ]),
      LogProcessed.aggregate<{ _id: Date; count: number }>([
        { $match: filter },
        {
          $group: {
            _id: {
              $dateTrunc: {
                date: '$timestamp',
                unit: query.timeRange === '30d' || query.timeRange === '7d' ? 'day' : 'hour',
              },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      LogProcessed.countDocuments({ ...filter, severity: 'SECURITY' }),
      LogProcessed.find({ ...filter, severity: 'CRITICAL' }).sort({ timestamp: -1 }).limit(5).lean(),
      IncidentPattern.find(query.serverId ? { server: new Types.ObjectId(query.serverId) } : {})
        .sort({ lastSeenAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const severityCounts = ['INFO', 'WARN', 'ERROR', 'CRITICAL', 'SECURITY'].reduce<Record<LogSeverity, number>>((acc, item) => {
      acc[item as LogSeverity] = 0;
      return acc;
    }, {} as Record<LogSeverity, number>);
    bySeverity.forEach((item) => {
      if (item._id in severityCounts) {
        severityCounts[item._id as LogSeverity] = item.count;
      }
    });

    return {
      logs: logs.map(logToDashboardRecord),
      total,
      page,
      limit,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      summary: {
        infoCount: severityCounts.INFO,
        warnCount: severityCounts.WARN,
        errorCount: severityCounts.ERROR,
        criticalCount: severityCounts.CRITICAL,
        securityCount: severityCounts.SECURITY,
        topServices: topServices.map((item) => ({ serviceName: item._id, count: item.count })),
        topErrors: topErrors.map((item) => ({ pattern: item._id, message: cleanDisplayMessage(item.message || item._id), count: item.count })),
        countOverTime: countOverTime.map((item) => ({ timestamp: item._id, count: item.count })),
        securityEvents,
        recentCriticalLogs: recentCritical.map(logToDashboardRecord),
        incidentTimeline: incidents,
      },
    };
  },

  async getCleanupRecommendations(serverId: string) {
    const recommendations = await logCleanupService.recommend(serverId);
    await logCleanupService.auditRecommendations(serverId, recommendations);
    return recommendations;
  },

  async getRetentionPolicies(serverId?: string) {
    const config = serverId ? await configService.get(serverId) : undefined;
    return retentionPolicyService.listPolicies(config);
  },
};
