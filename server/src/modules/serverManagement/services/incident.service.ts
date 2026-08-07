import crypto from 'crypto';
import { Types } from 'mongoose';
import { envConfig } from '../../../config/env.config';
import { ServerConnection } from '../models/serverConnection.model';
import { Alert } from '../models/alert.model';
import { Metric } from '../models/metric.model';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { ScanResult } from '../models/scanResult.model';
import { Incident, IIncidentEvidence, IIncident } from '../models/incident.model';
import { logger } from '../../../utils/logger.util';

const DEFAULT_WINDOW_MINUTES = 15;
const THRESHOLD_DEDUP_MS = 10 * 60 * 1000;
const CREWAI_INCIDENT_RETRY_MS = 15 * 60 * 1000;
let crewAiIncidentUnavailableUntil = 0;

interface AnalyzeIncidentPayload {
  serverId: string;
  windowMinutes?: number;
}

interface IncidentListResult {
  incidents: IIncident[];
  total: number;
  page: number;
  limit: number;
}

const createIncidentKey = (serverId: string, rootCause: string) => {
  return crypto
    .createHash('sha256')
    .update(`${serverId}:${rootCause.trim().slice(0, 250)}`)
    .digest('hex');
};

const createEvidence = (
  alerts: Array<any>,
  metrics: Array<any>,
  logs: Array<any>,
  scans: Array<any>,
) => {
  const evidence: IIncidentEvidence[] = [];

  evidence.push(
    ...alerts.slice(0, 12).map((alert) => ({
      source: 'alert' as const,
      type: alert.type,
      title: alert.title,
      detail: alert.message,
      severity: alert.severity,
      timestamp: alert.created,
      metadata: alert.metadata || {},
    }))
  );

  evidence.push(
    ...metrics.slice(0, 6).map((metric) => ({
      source: 'metric' as const,
      type: 'system_metric',
      title: `Metric snapshot ${metric.collectedAt?.toISOString?.() ?? ''}`,
      detail: `CPU ${metric.cpuUsagePercent}%, memory ${metric.memoryUsagePercent}%, disk ${metric.diskUsagePercent}%`,
      severity:
        metric.diskUsagePercent >= 90 || metric.cpuUsagePercent >= 95 || metric.memoryUsagePercent >= 95
          ? 'critical'
          : metric.cpuUsagePercent >= 80 || metric.memoryUsagePercent >= 80 || metric.diskUsagePercent >= 85
          ? 'warning'
          : 'info',
      timestamp: metric.collectedAt,
      metadata: {
        cpuUsagePercent: metric.cpuUsagePercent,
        memoryUsagePercent: metric.memoryUsagePercent,
        diskUsagePercent: metric.diskUsagePercent,
        loadAverage: metric.loadAverage,
        topProcesses: metric.topProcesses,
      },
    }))
  );

  evidence.push(
    ...logs.slice(0, 10).map((log) => ({
      source: 'log' as const,
      type: log.action,
      title: log.reason || log.action,
      detail: String(log.metadata?.message || log.reason || log.status),
      severity: log.status === 'failed' ? 'warning' : 'info',
      timestamp: log.created,
      metadata: { status: log.status, ...log.metadata },
    }))
  );

  evidence.push(
    ...scans.slice(0, 8).map((scan) => ({
      source: 'scan' as const,
      type: scan.category,
      title: scan.fileName,
      detail: `Scan result recommends ${scan.aiRecommendation?.action} with confidence ${scan.aiRecommendation?.confidence ?? 0}.`,
      severity: scan.aiRecommendation?.action === 'delete' ? 'critical' : 'warning',
      timestamp: scan.discoveredAt,
      metadata: {
        path: scan.path,
        reviewStatus: scan.reviewStatus,
        aiRecommendation: scan.aiRecommendation,
      },
    }))
  );

  return evidence;
};

const callCrewAiRootCauseAnalysis = async (payload: AnalyzeIncidentPayload, context: any) => {
  if (!envConfig.crewaiIncidentAnalysisEnabled) {
    return null;
  }

  const apiUrl = envConfig.crewaiApiUrl.replace(/\/$/, '');
  if (!apiUrl) {
    throw new Error('CrewAI endpoint is not configured.');
  }

  if (Date.now() < crewAiIncidentUnavailableUntil) {
    throw new Error('CrewAI incident analysis endpoint is temporarily unavailable; using fallback summary.');
  }

  const analysisResponse = await fetch(`${apiUrl}/incidents/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...context, serverId: payload.serverId }),
  });

  if (!analysisResponse.ok) {
    const rawMessage = await analysisResponse.text();
    const message = rawMessage
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 240);
    if (analysisResponse.status === 404) {
      crewAiIncidentUnavailableUntil = Date.now() + 24 * 60 * 60 * 1000;
    }
    throw new Error(`CrewAI analysis failed: ${analysisResponse.status} ${message}`);
  }

  const result = await analysisResponse.json();
  return result;
};

const buildFallbackAnalysis = (context: any) => {
  const evidence = context.evidence || [];
  const mostUrgent = evidence.find((item: any) => item.severity === 'critical') ?? evidence[0];
  const rootCause = mostUrgent
    ? `Most likely cause is related to ${mostUrgent.title}.`
    : 'Unable to determine root cause from the available event window.';

  return {
    status: 'success',
    rootCause,
    evidence: evidence.slice(0, 5),
    confidence: mostUrgent ? 0.72 : 0.25,
    severity: mostUrgent?.severity ?? 'info',
    nextActions: mostUrgent
      ? [`Investigate ${mostUrgent.source} evidence and confirm whether the source is transient or systemic.`]
      : ['Collect additional incident evidence and re-run RCA.'],
    aiNarrative: `Fallback RCA narrative generated from event correlation summary.`,
    aiGeneratedResponse: false,
  };
};

const normalizeAnalysis = (analysis: any) => {
  return {
    rootCause: String(analysis.rootCause || analysis.title || 'Unknown root cause.'),
    evidence: Array.isArray(analysis.evidence)
      ? analysis.evidence.map((item: any) => ({
          source: String(item.source || 'alert'),
          type: String(item.type || 'unknown'),
          title: String(item.title || 'Evidence item'),
          detail: String(item.detail || ''),
          severity: String(item.severity || 'info'),
          timestamp: item.timestamp ? new Date(item.timestamp) : undefined,
          metadata: item.metadata || {},
        }))
      : [],
    confidence: Math.min(1, Math.max(0, Number(analysis.confidence ?? analysis.confidenceScore ?? 0.5))),
    severity: String(analysis.severity || 'warning'),
    nextActions: Array.isArray(analysis.nextActions) ? analysis.nextActions.map(String) : [],
    aiNarrative: String(analysis.aiNarrative || analysis.narrative || ''),
  };
};

export const incidentService = {
  async analyze(serverId: string, windowMinutes = DEFAULT_WINDOW_MINUTES) {
    if (!Types.ObjectId.isValid(serverId)) {
      throw new Error('Invalid server id.');
    }

    const server = await ServerConnection.findById(serverId);
    if (!server) {
      throw new Error('Server not found.');
    }

    const end = new Date();
    const start = new Date(end.getTime() - windowMinutes * 60 * 1000);

    const [alerts, metrics, logs, scanResults] = await Promise.all([
      Alert.find({ server: server._id, created: { $gte: start, $lte: end } }).sort({ created: -1 }).lean(),
      Metric.find({ server: server._id, collectedAt: { $gte: start, $lte: end } }).sort({ collectedAt: -1 }).lean(),
      MaintenanceLog.find({ server: server._id, created: { $gte: start, $lte: end } }).sort({ created: -1 }).lean(),
      ScanResult.find({ server: server._id, discoveredAt: { $gte: start, $lte: end } }).sort({ discoveredAt: -1 }).lean(),
    ]);

    const evidence = createEvidence(alerts, metrics, logs, scanResults);
    const context = {
      server: {
        id: server._id.toString(),
        name: server.name,
        host: server.host,
        status: server.status,
      },
      timeWindow: { start: start.toISOString(), end: end.toISOString(), minutes: windowMinutes },
      alerts,
      metrics,
      logs,
      scanResults,
      evidence,
    };

    let analysis = buildFallbackAnalysis(context);
    try {
      const crewResult = await callCrewAiRootCauseAnalysis({ serverId, windowMinutes }, context);
      if (crewResult?.status === 'success' && crewResult.rootCause) {
        analysis = { ...analysis, ...normalizeAnalysis(crewResult), aiGeneratedResponse: true };
      }
    } catch (error) {
      // logger.debug(
      //   `CrewAI root cause analysis unavailable; using fallback summary. ${
      //     error instanceof Error ? error.message : String(error)
      //   }`,
      // );
    }

    const incidentKey = createIncidentKey(serverId, analysis.rootCause);
    const existingOpenIncident = await Incident.findOne({
      server: server._id,
      incidentKey,
      status: { $in: ['open', 'acknowledged'] },
      windowEnd: { $gte: start },
    });

    const correlatedAlerts = alerts.map((alert) => alert._id);
    const correlatedMetrics = metrics.map((metric) => metric._id);
    const correlatedLogs = logs.map((log) => log._id);
    const correlatedScanResults = scanResults.map((scan) => scan._id);

    const incidentPayload: Partial<IIncident> = {
      server: server._id,
      incidentKey,
      title: analysis.rootCause.slice(0, 180),
      summary: analysis.aiNarrative || analysis.rootCause,
      rootCause: analysis.rootCause,
      evidence: analysis.evidence,
      confidence: analysis.confidence,
      severity: ['info', 'warning', 'critical'].includes(analysis.severity) ? (analysis.severity as any) : 'warning',
      nextActions: analysis.nextActions,
      aiNarrative: analysis.aiNarrative,
      correlatedAlerts,
      correlatedMetrics,
      correlatedLogs,
      correlatedScanResults,
      windowStart: start,
      windowEnd: end,
      updated: new Date(),
    };

    if (existingOpenIncident) {
      existingOpenIncident.set({
        ...incidentPayload,
        evidence: analysis.evidence,
        correlatedAlerts: Array.from(new Set([...(existingOpenIncident.correlatedAlerts || []), ...correlatedAlerts])),
        correlatedMetrics: Array.from(new Set([...(existingOpenIncident.correlatedMetrics || []), ...correlatedMetrics])),
        correlatedLogs: Array.from(new Set([...(existingOpenIncident.correlatedLogs || []), ...correlatedLogs])),
        correlatedScanResults: Array.from(new Set([...(existingOpenIncident.correlatedScanResults || []), ...correlatedScanResults])),
        windowEnd: end,
      });
      await existingOpenIncident.save();
      return existingOpenIncident;
    }

    const incident = await Incident.create({
      ...incidentPayload,
      status: 'open',
      created: new Date(),
    });

    return incident;
  },

  async list(serverId?: string, page = 1, limit = 10): Promise<IncidentListResult> {
    const query: any = {};
    if (serverId && Types.ObjectId.isValid(serverId)) {
      query.server = new Types.ObjectId(serverId);
    }

    const [incidents, total] = await Promise.all([
      Incident.find(query)
        .sort({ updated: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<IIncident[]>(),
      Incident.countDocuments(query),
    ]);

    return { incidents, total, page, limit };
  },

  async getById(incidentId: string) {
    if (!Types.ObjectId.isValid(incidentId)) {
      throw new Error('Invalid incident id.');
    }

    const incident = await Incident.findById(incidentId).lean<IIncident>();
    if (!incident) {
      throw new Error('Incident not found.');
    }
    return incident;
  },

  async acknowledge(incidentId: string) {
    if (!Types.ObjectId.isValid(incidentId)) {
      throw new Error('Invalid incident id.');
    }

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      throw new Error('Incident not found.');
    }

    incident.status = 'acknowledged';
    incident.acknowledgedAt = new Date();
    incident.updated = new Date();
    await incident.save();
    return incident;
  },

  async resolve(incidentId: string) {
    if (!Types.ObjectId.isValid(incidentId)) {
      throw new Error('Invalid incident id.');
    }

    const incident = await Incident.findById(incidentId);
    if (!incident) {
      throw new Error('Incident not found.');
    }

    incident.status = 'resolved';
    incident.resolvedAt = new Date();
    incident.updated = new Date();
    await incident.save();
    return incident;
  },
};
