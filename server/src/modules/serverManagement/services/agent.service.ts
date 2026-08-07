import path from 'path';
import { Types } from 'mongoose';
import { IAutomationRule, IServerMaintenanceConfig } from '../models/config.model';
import {
  AnalysisStatus,
  FileAction,
  FileCategory,
  IAiRecommendation,
  IScanResult,
  ScanSeverity,
  ScanResult,
} from '../models/scanResult.model';
import { MaintenanceLog } from '../models/maintenanceLog.model';
import { configService } from './config.service';
import { executionService } from './execution.service';
import { ragMemoryService } from './ragMemory.service';
import { alertService } from './alert.service';
import { logger } from '../../../utils/logger.util';
import { computeTrends } from '../utils/trend.util';
import { Prediction } from '../models/prediction.model';
import { Anomaly } from '../models/anomaly.model';
import { healthService } from './health.service';
import { ServerConnection } from '../models/serverConnection.model';
import { socketService } from './socket.service';
import { MetricsHistory } from '../models/metricsHistory.model';
import { CrashHistory } from '../models/crashHistory.model';

export const AI_PREDICTION = 'AI_PREDICTION';
export const ANOMALY_DETECTED = 'ANOMALY_DETECTED';
export const FAILURE_FORECAST = 'FAILURE_FORECAST';

const automaticDeleteCategories: FileCategory[] = ['logs', 'unused'];
const protectedOperationalCategories: FileCategory[] = [
  'system',
  'config',
  'service',
  'application',
];

const getAgenticApiBaseUrl = () => {
  const configuredUrl = (process.env.AGENTIC_SERVER_URL || process.env.CREWAI_API_URL || '').trim();
  const trimmedUrl = configuredUrl.replace(/\/$/, '');

  if (!trimmedUrl) {
    return '';
  }

  return trimmedUrl.endsWith('/api/v1') ? trimmedUrl : `${trimmedUrl}/api/v1`;
};

const getErrorMessage = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  const cause = (error as { cause?: { code?: string; message?: string } })?.cause;

  if (cause?.code || cause?.message) {
    return `${message}${cause.code ? ` (${cause.code})` : ''}${cause.message ? `: ${cause.message}` : ''}`;
  }

  return message;
};

const getAgenticFetchSignal = () => {
  const timeoutMs = Number(process.env.AGENTIC_SERVER_TIMEOUT_MS || 8000);
  return AbortSignal.timeout(Math.max(1000, timeoutMs));
};

export interface FileDecisionFacts {
  fileName: string;
  path: string;
  sizeMb: number;
  lastAccessed: Date;
  category: string;
  tags: string[];
}

const ageInDays = (date: Date) => {
  const diff = Date.now() - date.getTime();
  return Math.max(0, Math.floor(diff / 86400000));
};

const isPathIgnored = (filePath: string, config: IServerMaintenanceConfig) =>
  config.ignoreFolders.some((folder) => filePath === folder || filePath.startsWith(`${folder}/`));

const getAutomaticDeleteCategory = (facts: Pick<FileDecisionFacts, 'category' | 'tags'>) =>
  automaticDeleteCategories.find(
    (category) => facts.category === category || facts.tags.includes(category),
  );

const getExtension = (fileName: string) => {
  const extension = fileName.includes('.') ? fileName.split('.').pop() : undefined;
  return extension?.toLowerCase();
};

const includesCategory = (
  facts: Pick<FileDecisionFacts, 'category' | 'tags'>,
  categories: FileCategory[],
) => categories.some((category) => facts.category === category || facts.tags.includes(category));

const matchesRule = (facts: FileDecisionFacts, rule: IAutomationRule) => {
  if (!rule.enabled) {
    return false;
  }

  if (rule.category && !facts.tags.includes(rule.category) && facts.category !== rule.category) {
    return false;
  }

  if (rule.olderThanDays !== undefined && ageInDays(facts.lastAccessed) < rule.olderThanDays) {
    return false;
  }

  if (rule.largerThanMb !== undefined && facts.sizeMb < rule.largerThanMb) {
    return false;
  }

  return true;
};

const normalizeActionForConfig = (
  action: FileAction,
  facts: FileDecisionFacts,
  config: IServerMaintenanceConfig,
  trace: string[],
): FileAction => {
  if (isPathIgnored(facts.path, config)) {
    trace.push('Path matched configured ignore folders, so the action was forced to ignore.');
    return 'ignore';
  }

  if (
    (action === 'delete' || action === 'archive') &&
    includesCategory(facts, protectedOperationalCategories)
  ) {
    trace.push(
      'Action changed to review because the file is part of a system, service, configuration, or application path.',
    );
    return 'review';
  }

  if (action === 'delete' && ageInDays(facts.lastAccessed) < config.deleteOlderThanDays) {
    trace.push(
      `Delete blocked because last access age is ${ageInDays(
        facts.lastAccessed,
      )} days and deleteOlderThanDays is ${config.deleteOlderThanDays}.`,
    );
    return 'review';
  }

  if (
    action === 'archive' &&
    facts.sizeMb < config.archiveLargeFileMb &&
    facts.category !== 'logs'
  ) {
    trace.push(
      `Archive blocked because size is ${facts.sizeMb.toFixed(
        1,
      )} MB and archiveLargeFileMb is ${config.archiveLargeFileMb}.`,
    );
    return 'review';
  }

  return action;
};

const buildLocalDecision = (
  facts: FileDecisionFacts,
  config: IServerMaintenanceConfig,
  history: Array<{ action: string; reason: string }>,
): IAiRecommendation => {
  const trace: string[] = [
    `Evaluated ${facts.path} as ${facts.category} with tags: ${facts.tags.join(', ') || 'none'}.`,
    `Config thresholds: delete older than ${config.deleteOlderThanDays} days, archive larger than ${config.archiveLargeFileMb} MB.`,
  ];

  if (isPathIgnored(facts.path, config)) {
    return {
      action: 'ignore',
      confidence: 1,
      reason: 'The file path is inside a configured ignored folder.',
      decisionTrace: [...trace, 'Configured ignore folder matched.'],
    };
  }

  if (includesCategory(facts, protectedOperationalCategories)) {
    return {
      action: 'review',
      confidence: 0.92,
      reason:
        'The file is operationally sensitive, so the agent will not clean it up without an operator decision.',
      decisionTrace: [
        ...trace,
        'Protected operational category matched; destructive cleanup requires manual review.',
      ],
    };
  }

  const explicitCleanupRule = config.rules.find(
    (candidate) =>
      candidate.category !== undefined &&
      automaticDeleteCategories.includes(candidate.category) &&
      matchesRule(facts, candidate),
  );
  if (explicitCleanupRule) {
    const action = normalizeActionForConfig(explicitCleanupRule.action, facts, config, trace);
    return {
      action,
      confidence: action === explicitCleanupRule.action ? 0.9 : 0.65,
      reason: `Matched user-defined ${explicitCleanupRule.action} rule for ${
        explicitCleanupRule.category || 'all categories'
      }.`,
      decisionTrace: [
        ...trace,
        `Matched rule action=${explicitCleanupRule.action}, category=${
          explicitCleanupRule.category || 'any'
        }.`,
        `Normalized action=${action}.`,
      ],
    };
  }

  const automaticDeleteCategory = getAutomaticDeleteCategory(facts);
  if (automaticDeleteCategory && ageInDays(facts.lastAccessed) >= config.deleteOlderThanDays) {
    const action = normalizeActionForConfig('delete', facts, config, trace);
    return {
      action,
      confidence: action === 'delete' ? 0.88 : 0.65,
      reason: `${automaticDeleteCategory} file exceeds the configured deletion age.`,
      decisionTrace: [
        ...trace,
        `${automaticDeleteCategory} cleanup matched deleteOlderThanDays=${config.deleteOlderThanDays}.`,
        `Normalized action=${action}.`,
      ],
    };
  }

  const rule = config.rules.find((candidate) => matchesRule(facts, candidate));
  if (rule) {
    const action = normalizeActionForConfig(rule.action, facts, config, trace);
    return {
      action,
      confidence: action === rule.action ? 0.9 : 0.65,
      reason: `Matched user-defined ${rule.action} rule for ${rule.category || 'all categories'}.`,
      decisionTrace: [
        ...trace,
        `Matched rule action=${rule.action}, category=${rule.category || 'any'}.`,
        `Normalized action=${action}.`,
      ],
    };
  }

  let action: FileAction = 'review';
  let reason = 'No automation rule matched; keep this file in manual review.';

  if (facts.tags.includes('temp') && ageInDays(facts.lastAccessed) >= config.unusedFileDays) {
    action = 'delete';
    reason = 'Temporary file is older than the configured unused-file window.';
  } else if (facts.tags.includes('duplicate')) {
    action = 'review';
    reason = 'Duplicate content was detected; review the duplicate set before deleting one copy.';
  } else if (facts.tags.includes('crash')) {
    action = ageInDays(facts.lastAccessed) >= config.unusedFileDays ? 'archive' : 'review';
    reason =
      action === 'archive'
        ? 'Crash report is old enough to archive after incident review.'
        : 'Crash report may explain a recent service failure and should be reviewed first.';
  } else if (facts.tags.includes('large') && facts.sizeMb >= config.archiveLargeFileMb) {
    action = 'archive';
    reason = 'Large file exceeds the configured archive threshold.';
  } else if (facts.tags.includes('logs') && facts.sizeMb >= config.largeFileMb) {
    action = 'archive';
    reason = 'Log file is large enough to archive instead of deleting immediately.';
  } else if (
    facts.tags.includes('unused') &&
    ageInDays(facts.lastAccessed) >= config.deleteOlderThanDays
  ) {
    action = 'delete';
    reason = 'Unused file exceeds the configured deletion age.';
  }

  action = normalizeActionForConfig(action, facts, config, trace);

  const repeatedHistory = history.filter((item) => item.action === action);
  const confidence = Math.min(0.95, 0.68 + repeatedHistory.length * 0.07);
  if (repeatedHistory.length) {
    trace.push(`RAG history found ${repeatedHistory.length} similar successful ${action} actions.`);
  }

  return {
    action,
    confidence,
    reason,
    decisionTrace: trace,
  };
};

const callCrewAiAdvisor = async (
  serverId: string,
  facts: FileDecisionFacts[],
  config: IServerMaintenanceConfig,
) => {
  try {
    const apiBaseUrl = getAgenticApiBaseUrl();
    if (!apiBaseUrl || !facts.length) {
      return new Map<string, Partial<IAiRecommendation>>();
    }

    // Sort by size and limit to top 100 files to avoid massive payloads
    const limitedFacts = [...facts].sort((a, b) => (b.sizeMb || 0) - (a.sizeMb || 0)).slice(0, 100);

    const response = await fetch(`${apiBaseUrl}/maintenance/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serverId,
        files: limitedFacts,
        config,
        openAiKey: process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY,
        llmProvider:
          process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY
            ? 'openai'
            : undefined,
      }),
      signal: getAgenticFetchSignal(),
    });

    if (!response.ok) {
      throw new Error(`CrewAI advisor returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      decisions?: Array<Partial<IAiRecommendation> & { path?: string }>;
    };

    return new Map(
      (payload.decisions || [])
        .filter((decision) => decision.path)
        .map((decision) => [decision.path as string, decision]),
    );
  } catch (error) {
    logger.warn(
      `CrewAI advisor unavailable; using deterministic local decisions: ${getErrorMessage(error)}`,
    );
    return new Map<string, Partial<IAiRecommendation>>();
  }
};

const uniqueStrings = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.map((value) => String(value || '').trim()).filter(Boolean)));

const scanResultDirectory = (result: Pick<IScanResult, 'path'> & { directory?: string }) =>
  result.directory || path.posix.dirname(result.path);

const inferImpactedServices = (result: Pick<IScanResult, 'fileName' | 'path' | 'tags'>) => {
  const normalizedPath = result.path.toLowerCase();
  const services = new Set<string>();
  const serviceFile = result.fileName.match(/^(.+)\.(service|timer|socket)$/i);
  if (serviceFile?.[1]) {
    services.add(serviceFile[1]);
  }

  [
    'nginx',
    'apache2',
    'httpd',
    'mysql',
    'mariadb',
    'postgresql',
    'redis',
    'mongodb',
    'docker',
    'containerd',
    'kubelet',
    'ssh',
    'sshd',
    'pm2',
    'node',
  ].forEach((service) => {
    if (normalizedPath.includes(`/${service}/`) || normalizedPath.includes(`${service}.service`)) {
      services.add(service);
    }
  });

  if (normalizedPath.startsWith('/var/log/')) {
    const logName = path.posix.basename(result.fileName).split('.')[0];
    if (logName && !['syslog', 'messages', 'kern', 'auth', 'secure'].includes(logName)) {
      services.add(logName);
    }
  }

  if (result.tags.includes('system')) {
    services.add('system');
  }

  return Array.from(services).slice(0, 6);
};

const inferScanSeverity = (result: IScanResult): ScanSeverity => {
  if (result.tags.includes('crash')) {
    return 'critical';
  }

  if (
    (result.tags.includes('system') ||
      result.tags.includes('service') ||
      result.tags.includes('config')) &&
    (result.tags.includes('large') || result.tags.includes('unused'))
  ) {
    return 'high';
  }

  if (result.tags.includes('large') && result.sizeMb >= 1024) {
    return 'high';
  }

  if (
    result.tags.includes('duplicate') ||
    result.tags.includes('large') ||
    result.tags.includes('logs')
  ) {
    return 'medium';
  }

  return 'low';
};

const buildRootCauseAnalysis = (result: IScanResult) => {
  if (result.tags.includes('crash')) {
    return 'Crash artefacts indicate a process or service terminated unexpectedly and left diagnostic output behind.';
  }

  if (result.tags.includes('duplicate')) {
    return 'Identical file content was found in more than one path, usually caused by repeated deployments, backups, or manual copies.';
  }

  if (result.tags.includes('logs') && result.tags.includes('large')) {
    return 'Log retention or rotation appears insufficient, allowing service logs to keep growing.';
  }

  if (result.tags.includes('temp') || result.tags.includes('unused')) {
    return 'Temporary or stale files are accumulating past the configured age threshold.';
  }

  if (includesCategory(result, protectedOperationalCategories)) {
    return 'Operational files were discovered in sensitive system, service, configuration, or application paths and need review rather than automatic cleanup.';
  }

  if (result.tags.includes('large')) {
    return 'Large file growth may be consuming storage and should be tied back to an owning process or retention policy.';
  }

  return 'The file was discovered during the full-server maintenance scan and needs routine classification review.';
};

const buildRemediationSteps = (result: IScanResult) => {
  if (result.tags.includes('crash')) {
    return [
      'Review the crash report before cleanup.',
      'Correlate the crash timestamp with service logs and system metrics.',
      'Archive the report after the root cause has been captured.',
    ];
  }

  if (result.tags.includes('duplicate')) {
    return [
      'Compare duplicate paths and confirm the canonical copy.',
      'Update backup or deployment jobs that created the duplicate.',
      'Delete only the confirmed redundant copy.',
    ];
  }

  if (includesCategory(result, protectedOperationalCategories)) {
    return [
      'Identify the owning package, service, or application.',
      'Review change history before modifying the file.',
      'Use remediation approval for any archive or delete action.',
    ];
  }

  if (result.aiRecommendation.action === 'archive') {
    return [
      'Archive the file into the configured archive directory.',
      'Verify service health and free disk space after archival.',
      'Tune retention policy to prevent recurrence.',
    ];
  }

  if (result.aiRecommendation.action === 'delete') {
    return [
      'Delete the file after dashboard review.',
      'Validate disk usage and application health after cleanup.',
      'Add or tune scheduled cleanup for this file pattern.',
    ];
  }

  return [
    'Review the file owner, age, and category.',
    'Choose delete, archive, or ignore from the dashboard.',
    'Capture the decision so future recommendations improve.',
  ];
};

const buildDevOpsRecommendations = (result: IScanResult) => {
  const recommendations = new Set<string>();
  if (result.tags.includes('logs')) {
    recommendations.add('Add or tighten logrotate rules for the owning service.');
  }
  if (result.tags.includes('temp')) {
    recommendations.add('Schedule cleanup for stale temporary and cache directories.');
  }
  if (result.tags.includes('large')) {
    recommendations.add('Create size-based alerts for the impacted directory.');
  }
  if (result.tags.includes('duplicate')) {
    recommendations.add('Review deployment, backup, or sync jobs that duplicate files.');
  }
  if (result.tags.includes('crash')) {
    recommendations.add('Correlate crash artefacts with service restarts and error logs.');
  }
  if (includesCategory(result, protectedOperationalCategories)) {
    recommendations.add('Protect operational files with manual approval and change tracking.');
  }

  recommendations.add(
    'Keep this path visible in the next scheduled predictive maintenance review.',
  );
  return Array.from(recommendations);
};

const buildScanPredictionIssues = (
  results: IScanResult[],
  healthScore: number,
): Array<Record<string, unknown>> => {
  const countByCategory = results.reduce<Record<string, number>>((acc, result) => {
    acc[result.category] = (acc[result.category] || 0) + 1;
    return acc;
  }, {});
  const totalSizeMb = results.reduce((sum, result) => sum + result.sizeMb, 0);
  const topDirectories = uniqueStrings(results.map((result) => scanResultDirectory(result))).slice(
    0,
    6,
  );
  const impactedServices = uniqueStrings(
    results.flatMap((result) => inferImpactedServices(result)),
  ).slice(0, 8);
  const highRiskCount = results.filter((result) =>
    ['high', 'critical'].includes(result.severity),
  ).length;
  const issues: Array<Record<string, unknown>> = [];

  if (countByCategory.large || 0 || countByCategory.logs || 0 || countByCategory.temp || 0) {
    issues.push({
      issue: 'Storage maintenance pressure detected',
      predictedFailure: 'Disk exhaustion or degraded application writes if file growth continues.',
      recommendation: 'Review the largest, log, temporary, and unused files from the latest scan.',
      rootCauseAnalysis:
        'The latest full-server scan found cleanup candidates across storage-heavy categories.',
      severity: highRiskCount > 0 || totalSizeMb > 10240 || healthScore < 70 ? 'high' : 'medium',
      confidence: Math.min(0.95, 0.62 + Math.min(results.length, 100) / 300),
      horizonMinutes: 720,
      evidence: [
        {
          source: 'event',
          title: 'Latest scan summary',
          detail: `${results.length} files totaling ${totalSizeMb.toFixed(2)} MB were classified.`,
          severity: highRiskCount > 0 ? 'high' : 'medium',
          metadata: { countByCategory, totalSizeMb },
        },
      ],
      recommendedActions: [
        'Archive large log files after review.',
        'Delete stale temporary files approved by the dashboard.',
        'Add retention policies for high-growth directories.',
      ],
      affectedComponents: uniqueStrings(['Disk', ...impactedServices]),
      impactedDirectories: topDirectories,
      impactedServices,
    });
  }

  if (countByCategory.crash) {
    issues.push({
      issue: 'Crash artefacts require root cause review',
      predictedFailure: 'Repeated service failures may recur without incident analysis.',
      recommendation: 'Inspect crash reports before cleanup and correlate them with service logs.',
      rootCauseAnalysis:
        'Crash report files indicate one or more processes terminated unexpectedly.',
      severity: 'critical',
      confidence: 0.86,
      horizonMinutes: 120,
      evidence: results
        .filter((result) => result.category === 'crash' || result.tags.includes('crash'))
        .slice(0, 5)
        .map((result) => ({
          source: 'event',
          title: result.fileName,
          detail: result.path,
          severity: 'critical',
          timestamp: result.discoveredAt,
          metadata: { sizeMb: result.sizeMb },
        })),
      recommendedActions: [
        'Run root cause analysis for crash timestamps.',
        'Restart or patch the impacted service only after reviewing logs.',
        'Archive crash artefacts after diagnosis.',
      ],
      affectedComponents: uniqueStrings(['Services', ...impactedServices]),
      impactedDirectories: topDirectories,
      impactedServices,
    });
  }

  if (
    (countByCategory.system || 0) +
    (countByCategory.config || 0) +
    (countByCategory.service || 0)
  ) {
    issues.push({
      issue: 'Operational files surfaced in maintenance scan',
      predictedFailure: 'Unsafe cleanup could affect service startup or configuration consistency.',
      recommendation:
        'Keep system, service, and configuration files under manual review guardrails.',
      rootCauseAnalysis:
        'The scan discovered files in sensitive operational paths while building the full-server inventory.',
      severity: highRiskCount > 0 ? 'high' : 'low',
      confidence: 0.78,
      horizonMinutes: 1440,
      evidence: results
        .filter((result) => includesCategory(result, protectedOperationalCategories))
        .slice(0, 5)
        .map((result) => ({
          source: 'event',
          title: result.fileName,
          detail: result.path,
          severity: result.severity,
          timestamp: result.discoveredAt,
          metadata: { category: result.category, tags: result.tags },
        })),
      recommendedActions: [
        'Require manual approval for protected operational paths.',
        'Confirm package or service ownership before remediation.',
        'Use configuration management for any corrective change.',
      ],
      affectedComponents: uniqueStrings(['Configuration', 'Services', ...impactedServices]),
      impactedDirectories: topDirectories,
      impactedServices,
    });
  }

  return issues;
};

const normalizePredictionIssue = (prediction: any) => {
  const severity = String(prediction.severity || 'low');
  const recommendedActions = Array.isArray(prediction.recommendedActions)
    ? prediction.recommendedActions.map(String)
    : prediction.recommendation
      ? [String(prediction.recommendation)]
      : ['Continue monitoring'];

  return {
    issue: String(prediction.issue || 'Predictive maintenance finding'),
    predictedFailure: String(
      prediction.predictedFailure ||
        prediction.failure ||
        prediction.issue ||
        'Potential service degradation',
    ),
    recommendation: String(
      prediction.recommendation || recommendedActions[0] || 'Review server health indicators.',
    ),
    rootCauseAnalysis: String(
      prediction.rootCauseAnalysis ||
        prediction.rootCause ||
        'Correlated metrics and scan artefacts indicate this maintenance risk.',
    ),
    severity,
    confidence: Math.min(1, Math.max(0, Number(prediction.confidence ?? 0.65))),
    horizonMinutes: Math.max(0, Number(prediction.horizonMinutes ?? 0)),
    evidence: (prediction.evidence || []).map((evidence: any) => {
      if (typeof evidence === 'string') {
        return {
          source: 'event',
          title: 'AI finding',
          detail: evidence,
          severity,
          metadata: {},
        };
      }

      return {
        source: String(evidence.source || 'event'),
        title: String(evidence.title || 'Evidence'),
        detail: String(evidence.detail || evidence.message || ''),
        severity: String(evidence.severity || severity),
        timestamp: evidence.timestamp ? new Date(evidence.timestamp) : undefined,
        metadata: evidence.metadata || {},
      };
    }),
    recommendedActions,
    affectedComponents: Array.isArray(prediction.affectedComponents)
      ? prediction.affectedComponents.map(String)
      : [],
    impactedServices: Array.isArray(prediction.impactedServices)
      ? prediction.impactedServices.map(String)
      : [],
    impactedDirectories: Array.isArray(prediction.impactedDirectories)
      ? prediction.impactedDirectories.map(String)
      : [],
    timeframe: prediction.timeframe ? String(prediction.timeframe) : undefined,
  };
};

const normalizeAnomaly = (serverId: string, anomaly: any, predictionId?: Types.ObjectId) => ({
  server: new Types.ObjectId(serverId),
  prediction: predictionId,
  type: String(anomaly.type || 'unknown'),
  title: String(anomaly.title || 'Anomaly detected'),
  component: String(anomaly.component || 'Unknown'),
  severity: String(anomaly.severity || 'warning'),
  value: Math.max(0, Number(anomaly.value ?? 0)),
  baseline: Math.max(0, Number(anomaly.baseline ?? 0)),
  threshold: Math.max(0, Number(anomaly.threshold ?? 0)),
  confidence: Math.min(1, Math.max(0, Number(anomaly.confidence ?? 0.5))),
  detector: String(anomaly.detector || 'threshold_statistical'),
  evidence: Array.isArray(anomaly.evidence) ? anomaly.evidence.map(String) : [],
  metadata: anomaly.metadata || {},
  detectedAt: anomaly.detectedAt ? new Date(anomaly.detectedAt) : new Date(),
  created: new Date(),
});

export const agentService = {
  async recommend(
    facts: FileDecisionFacts,
    config: IServerMaintenanceConfig,
  ): Promise<IAiRecommendation> {
    const history = await ragMemoryService.getHistoricalPatterns({
      ...facts,
      server: new Types.ObjectId(),
    } as unknown as IScanResult);
    return buildLocalDecision(facts, config, history);
  },

  async recommendMany(
    serverId: string,
    facts: FileDecisionFacts[],
    config: IServerMaintenanceConfig,
  ): Promise<IAiRecommendation[]> {
    if (!facts.length) {
      return [];
    }

    const history = await MaintenanceLog.find({
      server: new Types.ObjectId(serverId),
      action: { $in: ['delete', 'archive', 'ignore'] },
      status: 'success',
    })
      .sort({ created: -1 })
      .limit(200)
      .lean();

    const historyByExtension = history.reduce<
      Map<string, Array<{ action: string; reason: string }>>
    >((acc, item) => {
      const extension = String(item.metadata?.extension || '').toLowerCase();
      if (!extension) {
        return acc;
      }

      const entries = acc.get(extension) || [];
      entries.push({ action: String(item.action), reason: item.reason });
      acc.set(extension, entries.slice(0, 5));
      return acc;
    }, new Map());

    return facts.map((fact) =>
      buildLocalDecision(
        fact,
        config,
        historyByExtension.get(getExtension(fact.fileName) || '') || [],
      ),
    );
  },

  async recommendForScanResult(
    scanResult: IScanResult,
    config: IServerMaintenanceConfig,
  ): Promise<IAiRecommendation> {
    const history = await ragMemoryService.getHistoricalPatterns(scanResult);
    return buildLocalDecision(
      {
        fileName: scanResult.fileName,
        path: scanResult.path,
        sizeMb: scanResult.sizeMb,
        lastAccessed: scanResult.lastAccessed,
        category: scanResult.category,
        tags: scanResult.tags,
      },
      config,
      history,
    );
  },

  async analyzeScanResults(serverId: string, scanId: string) {
    const [server, config, healthScore, results] = await Promise.all([
      ServerConnection.findById(serverId).lean(),
      configService.get(serverId),
      healthService.calculateScore(serverId),
      ScanResult.find({
        server: new Types.ObjectId(serverId),
        scanId,
      })
        .sort({ sizeMb: -1 })
        .lean(),
    ]);

    if (!results.length) {
      return {
        scanId,
        analyzedCount: 0,
        predictionsCreated: 0,
      };
    }

    const bulkUpdates = [];
    const analyzedResults = [];

    // Process in chunks to avoid blocking the event loop
    const chunkSize = 1000;
    for (let i = 0; i < results.length; i += chunkSize) {
      const chunk = results.slice(i, i + chunkSize);

      for (const result of chunk) {
        const severity = inferScanSeverity(result as any);
        const analysisStatus: AnalysisStatus = 'completed';
        const impactedServices = inferImpactedServices(result as any);
        const impactedDirectories = uniqueStrings([scanResultDirectory(result as any)]);
        const rootCauseAnalysis = buildRootCauseAnalysis(result as any);
        const remediationSteps = buildRemediationSteps(result as any);
        const devOpsRecommendations = buildDevOpsRecommendations(result as any);

        const updatedResult = {
          ...result,
          severity,
          analysisStatus,
          rootCauseAnalysis,
          impactedServices,
          impactedDirectories,
          remediationSteps,
          devOpsRecommendations,
          updated: new Date(),
        };
        analyzedResults.push(updatedResult);

        bulkUpdates.push({
          updateOne: {
            filter: { _id: result._id },
            update: {
              $set: {
                severity,
                analysisStatus,
                rootCauseAnalysis,
                impactedServices,
                impactedDirectories,
                remediationSteps,
                devOpsRecommendations,
                updated: new Date(),
              },
            },
          },
        });
      }

      // Perform partial bulk write for this chunk
      const updatesToApply = bulkUpdates.slice(i, i + chunkSize);
      if (updatesToApply.length > 0) {
        await ScanResult.bulkWrite(updatesToApply);
      }

      // Yield to event loop
      await new Promise((resolve) => setImmediate(resolve));
    }

    const predictionIssues = buildScanPredictionIssues(analyzedResults as any, healthScore);
    let predictionRecord;

    if (predictionIssues.length) {
      predictionRecord = await Prediction.create({
        server: new Types.ObjectId(serverId),
        serverName: server?.host || server?.name || 'Unknown',
        healthScore,
        predictions: predictionIssues,
        metricsSummary: {
          scanId,
          fileCount: analyzedResults.length,
          totalSizeMb: analyzedResults.reduce((sum, result) => sum + result.sizeMb, 0),
        },
        trendAnalysis: {
          scanCategories: analyzedResults.reduce<Record<string, number>>((acc, result) => {
            acc[result.category] = (acc[result.category] || 0) + 1;
            return acc;
          }, {}),
          topDirectories: uniqueStrings(
            analyzedResults.map((result) => scanResultDirectory(result)),
          ).slice(0, 10),
        },
        aiGeneratedResponse: false,
        timeWindow: {
          start: analyzedResults[analyzedResults.length - 1]?.discoveredAt || new Date(),
          end: analyzedResults[0]?.discoveredAt || new Date(),
          minutes: 0,
        },
        created: new Date(),
        updated: new Date(),
      });
    }

    await MaintenanceLog.create({
      server: new Types.ObjectId(serverId),
      action: 'decision',
      status: 'success',
      reason:
        'AI scan analysis generated severity, root cause, impact, and remediation recommendations.',
      aiDecisionTrace: [
        `Scan ${scanId} analyzed after persistence.`,
        `Files analyzed: ${analyzedResults.length}.`,
        `Predictive issues created: ${predictionIssues.length}.`,
      ],
      metadata: {
        scanId,
        predictionId: predictionRecord?._id,
        categories: analyzedResults.reduce<Record<string, number>>((acc, result) => {
          acc[result.category] = (acc[result.category] || 0) + 1;
          return acc;
        }, {}),
        config: {
          scanDirectories: config.scanDirectories,
          ignoreFolders: config.ignoreFolders,
        },
      },
      created: new Date(),
    });

    await alertService.create({
      serverId,
      type: 'scan_analysis_completed',
      severity: predictionIssues.some((issue) => issue.severity === 'critical')
        ? 'critical'
        : 'info',
      title: 'AI scan analysis completed',
      message: `${analyzedResults.length} scanned files were enriched with root cause and remediation guidance.`,
      metadata: {
        scanId,
        predictionId: predictionRecord?._id,
        predictionCount: predictionIssues.length,
      },
      email: false,
    });

    return {
      scanId,
      analyzedCount: analyzedResults.length,
      predictionsCreated: predictionIssues.length,
      predictionId: predictionRecord?._id,
    };
  },

  async run(serverId: string, scanId?: string, execute = false, forceAgentDecisions = false) {
    const config = await configService.get(serverId);
    const query: Record<string, unknown> = {
      server: new Types.ObjectId(serverId),
      actionStatus: 'none',
    };
    if (scanId) {
      query.scanId = scanId;
    }

    const reviewStatuses = forceAgentDecisions ? ['reviewed', 'pending_review'] : ['reviewed'];
    const pendingReviewCount = forceAgentDecisions
      ? 0
      : await ScanResult.countDocuments({
          ...query,
          reviewStatus: 'pending_review',
        });

    const reviewableResults = await ScanResult.find({
      ...query,
      reviewStatus: { $in: reviewStatuses },
    }).sort({ discoveredAt: -1 });

    const facts = reviewableResults.map((result) => ({
      fileName: result.fileName,
      path: result.path,
      sizeMb: result.sizeMb,
      lastAccessed: result.lastAccessed,
      category: result.category,
      tags: result.tags,
    }));
    const crewAdvice = await callCrewAiAdvisor(serverId, facts, config);

    const decisions = [];
    const bulkUpdates = [];

    for (const result of reviewableResults) {
      const localDecision = await this.recommendForScanResult(result, config);
      const advisorDecision = crewAdvice.get(result.path);
      const trace = [...localDecision.decisionTrace];
      if (advisorDecision?.reason) {
        trace.push(`CrewAI advisor: ${advisorDecision.reason}`);
      }

      const action = normalizeActionForConfig(
        (advisorDecision?.action as FileAction | undefined) || localDecision.action,
        {
          fileName: result.fileName,
          path: result.path,
          sizeMb: result.sizeMb,
          lastAccessed: result.lastAccessed,
          category: result.category,
          tags: result.tags,
        },
        config,
        trace,
      );

      const recommendation: IAiRecommendation = {
        action,
        confidence: advisorDecision?.confidence ?? localDecision.confidence,
        reason: advisorDecision?.reason || localDecision.reason,
        decisionTrace: trace,
      };

      let reviewStatus = result.reviewStatus;
      let reviewedAt = result.reviewedAt;
      if (forceAgentDecisions && result.reviewStatus === 'pending_review') {
        reviewStatus = 'reviewed';
        reviewedAt = new Date();
      }

      bulkUpdates.push({
        updateOne: {
          filter: { _id: result._id },
          update: {
            $set: {
              reviewStatus,
              reviewedAt,
              aiRecommendation: recommendation,
              updated: new Date(),
            },
          },
        },
      });

      decisions.push({
        fileId: result._id,
        path: result.path,
        recommendation,
      });
    }

    if (bulkUpdates.length > 0) {
      const updateChunks = [];
      for (let i = 0; i < bulkUpdates.length; i += 1000) {
        updateChunks.push(bulkUpdates.slice(i, i + 1000));
      }
      for (const chunk of updateChunks) {
        await ScanResult.bulkWrite(chunk);
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    const execution = {
      requested: execute,
      allowed: execute && config.automationEnabled && pendingReviewCount === 0,
      skippedReason: undefined as string | undefined,
      results: [] as unknown[],
    };

    if (execute && !config.automationEnabled) {
      execution.skippedReason = 'Automation is disabled in configuration.';
    } else if (execute && pendingReviewCount > 0) {
      execution.skippedReason =
        'Automation blocked because scan results are still pending UI review.';
    } else if (execute) {
      const executableDecisions = decisions.filter((d) => d.recommendation.action !== 'review');
      const concurrencyLimit = 50;

      for (let i = 0; i < executableDecisions.length; i += concurrencyLimit) {
        const batch = executableDecisions.slice(i, i + concurrencyLimit);

        await Promise.all(
          batch.map(async (decision) => {
            const result = reviewableResults.find(
              (item) => String(item._id) === String(decision.fileId),
            );
            if (!result) return;

            const executionResult = await executionService.executeScanResult(
              result,
              decision.recommendation.action,
              decision.recommendation.reason,
              decision.recommendation.decisionTrace,
              { triggeredBy: 'agent' },
            );
            execution.results.push(executionResult);
          }),
        );

        // Yield to event loop to handle other incoming API requests
        await new Promise((resolve) => setImmediate(resolve));
      }
    }

    await MaintenanceLog.create({
      server: new Types.ObjectId(serverId),
      action: 'decision',
      status: execute && execution.allowed ? 'success' : 'preview',
      reason: execution.skippedReason || 'AI decision agent generated explainable file decisions.',
      aiDecisionTrace: [
        `Reviewed files considered: ${reviewableResults.length}.`,
        `Pending review files blocked: ${pendingReviewCount}.`,
        `Automation enabled: ${config.automationEnabled}.`,
      ],
      metadata: {
        scanId,
        execute,
        decisionCount: decisions.length,
      },
      created: new Date(),
    });

    await alertService.create({
      serverId,
      type: 'agent_decision',
      severity: 'info',
      title: execute ? 'AI maintenance execution completed' : 'AI maintenance preview ready',
      message: `${decisions.length} reviewed files were evaluated by the decision agent.`,
      metadata: {
        scanId,
        execute,
        pendingReviewCount,
      },
      email: false,
    });

    return {
      decisions: decisions.slice(0, 500),
      totalDecisions: decisions.length,
      pendingReviewCount,
      execution: {
        ...execution,
        results: execution.results.slice(0, 500),
        totalResults: execution.results.length,
      },
      guardrails: {
        automationRequiresReviewedResults: true,
        automationEnabled: config.automationEnabled,
      },
    };
  },

  async runAutomaticDeletion(serverId: string, scanId?: string) {
    const config = await configService.get(serverId);
    const execution = {
      enabled: config.automationEnabled,
      skippedReason: undefined as string | undefined,
      candidateCount: 0,
      deletedCount: 0,
      failedCount: 0,
      skippedCount: 0,
      results: [] as unknown[],
    };

    if (!config.automationEnabled) {
      execution.skippedReason = 'Automation is disabled in configuration.';
      return execution;
    }

    const query: Record<string, unknown> = {
      server: new Types.ObjectId(serverId),
      actionStatus: 'none',
      $or: [
        { category: { $in: automaticDeleteCategories } },
        { tags: { $in: automaticDeleteCategories } },
      ],
    };

    if (scanId) {
      query.scanId = scanId;
    }

    const candidates = await ScanResult.find(query).sort({ discoveredAt: -1 });
    execution.candidateCount = candidates.length;

    const concurrencyLimit = 50;
    for (let i = 0; i < candidates.length; i += concurrencyLimit) {
      const batch = candidates.slice(i, i + concurrencyLimit);

      await Promise.all(
        batch.map(async (result) => {
          const recommendation = await this.recommendForScanResult(result, config);
          const automaticDeleteCategory = getAutomaticDeleteCategory({
            category: result.category,
            tags: result.tags,
          });
          const decisionTrace = [
            ...recommendation.decisionTrace,
            `Automation cleanup evaluated ${
              automaticDeleteCategory || result.category
            } without UI review because automation is enabled.`,
          ];

          result.aiRecommendation = {
            ...recommendation,
            decisionTrace,
          };
          result.updated = new Date();

          if (recommendation.action !== 'delete') {
            await result.save();
            execution.skippedCount += 1;
            execution.results.push({
              fileId: result._id,
              path: result.path,
              action: recommendation.action,
              status: 'skipped',
              reason: recommendation.reason,
            });
            return;
          }

          const executionResult = await executionService.executeScanResult(
            result,
            'delete',
            recommendation.reason,
            decisionTrace,
            {
              allowPendingReviewAutomation: true,
              triggeredBy: 'automation',
            },
          );

          if ((executionResult as { status?: string }).status === 'success') {
            execution.deletedCount += 1;
          } else if ((executionResult as { status?: string }).status === 'failed') {
            execution.failedCount += 1;
          }

          execution.results.push(executionResult);
        }),
      );

      // Yield to event loop
      await new Promise((resolve) => setImmediate(resolve));
    }

    if (candidates.length) {
      await MaintenanceLog.create({
        server: new Types.ObjectId(serverId),
        action: 'decision',
        status: execution.failedCount ? 'failed' : execution.deletedCount ? 'success' : 'preview',
        reason: execution.deletedCount
          ? 'Automatic cleanup deleted eligible log and unused files.'
          : 'Automatic cleanup found no log or unused files eligible for deletion.',
        aiDecisionTrace: [
          `Automatic delete categories: ${automaticDeleteCategories.join(', ')}.`,
          `Automation enabled: ${config.automationEnabled}.`,
          `Candidates evaluated: ${execution.candidateCount}.`,
        ],
        metadata: {
          scanId,
          deletedCount: execution.deletedCount,
          failedCount: execution.failedCount,
          skippedCount: execution.skippedCount,
        },
        created: new Date(),
      });

      await alertService.create({
        serverId,
        type: 'agent_decision',
        severity: execution.failedCount ? 'warning' : execution.deletedCount ? 'warning' : 'info',
        title: 'Automatic cleanup completed',
        message: `${execution.deletedCount} log/unused files deleted; ${execution.skippedCount} left for review.`,
        metadata: {
          scanId,
          deletedCount: execution.deletedCount,
          failedCount: execution.failedCount,
          skippedCount: execution.skippedCount,
        },
        email: false,
      });
    }

    return execution;
  },

  async predictMaintenance(serverId: string) {
    const apiBaseUrl = getAgenticApiBaseUrl();
    const { Metric } = await import('../models/metric.model');
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const recentMetrics = await Metric.find({
      server: new Types.ObjectId(serverId),
      created: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
      .sort({ collectedAt: -1 })
      .limit(30)
      .lean();

    const hasEnoughMetrics = recentMetrics.length >= 2;
    const trends = hasEnoughMetrics ? computeTrends(recentMetrics as any) : {};
    const healthScore = await healthService.calculateScore(serverId);
    const server = await ServerConnection.findById(serverId);
    const latestScan = await ScanResult.findOne({ server: new Types.ObjectId(serverId) })
      .select('scanId')
      .sort({ discoveredAt: -1 })
      .lean();
    const [recentScanResults, recentLogs] = await Promise.all([
      latestScan?.scanId
        ? ScanResult.find({
            server: new Types.ObjectId(serverId),
            scanId: latestScan.scanId,
          })
            .sort({ severity: -1, sizeMb: -1 })
            .limit(250)
            .lean()
        : [],
      MaintenanceLog.find({ server: new Types.ObjectId(serverId) })
        .sort({ created: -1 })
        .limit(30)
        .lean(),
    ]);

    const formattedMetrics = recentMetrics.map((m) => ({
      cpuUsagePercent: m.cpuUsagePercent,
      memoryUsagePercent: m.memoryUsagePercent,
      diskUsagePercent: m.diskUsagePercent,
      swapUsagePercent: m.swapUsagePercent,
      loadAverage: m.loadAverage,
      networkDownloadSpeed: m.networkDownloadSpeed,
      networkUploadSpeed: m.networkUploadSpeed,
      diskReadIo: m.diskReadIo,
      diskWriteIo: m.diskWriteIo,
      diskReadBytesPerSecond: (m as any).diskReadBytesPerSecond,
      diskWriteBytesPerSecond: (m as any).diskWriteBytesPerSecond,
      filesystemGrowthBytesPerMinute: (m as any).filesystemGrowthBytesPerMinute,
      collectedAt: m.collectedAt,
      serviceSummary: (m as any).serviceSummary,
      processSummary: (m as any).processSummary,
      topProcesses: m.topProcesses,
    }));
    const predictionScanResults = recentScanResults.slice(0, 50).map((result) => ({
      path: result.path,
      fileName: result.fileName,
      category: result.category,
      severity: result.severity,
      sizeMb: result.sizeMb,
      tags: result.tags,
      reviewStatus: result.reviewStatus,
      actionStatus: result.actionStatus,
    }));
    const predictionMaintenanceLogs = recentLogs.slice(0, 10).map((log) => ({
      action: log.action,
      status: log.status,
      reason: log.reason,
      created: log.created,
    }));

    try {
      let rawPredictions: any[] = [];
      let rawAnomalies: any[] = [];
      let aiGeneratedResponse = false;

      if (apiBaseUrl) {
        try {
          const response = await fetch(`${apiBaseUrl}/maintenance/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              serverId,
              metrics: formattedMetrics,
              trends,
              healthScore,
              scanResults: predictionScanResults,
              maintenanceLogs: predictionMaintenanceLogs,
              openAiKey: process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY,
              llmProvider:
                process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY
                  ? 'openai'
                  : undefined,
            }),
            signal: getAgenticFetchSignal(),
          });

          if (!response.ok) {
            throw new Error(`CrewAI predictor returned ${response.status}`);
          }

          const payload = await response.json();
          rawPredictions = payload.predictions || [];
          rawAnomalies = Array.isArray(payload.anomalies) ? payload.anomalies : [];
          aiGeneratedResponse = payload.aiGeneratedResponse ?? true;
        } catch (error) {
          logger.warn(
            `CrewAI predictive advisor unavailable; using local scan predictions: ${getErrorMessage(error)}`,
          );
        }
      }

      if (rawPredictions.length === 0) {
        // Query the metrics history for the last 20 snapshots sorted by collectedAt descending
        const history = await MetricsHistory.find({ server: new Types.ObjectId(serverId) })
          .sort({ collectedAt: -1 })
          .limit(20)
          .lean();

        // 1. Memory Leak Warning
        if (history.length >= 5) {
          const memoryTrend = history.map(h => h.memoryUsagePercent).reverse();
          let consecutiveIncreases = 0;
          for (let i = 1; i < memoryTrend.length; i++) {
            if (memoryTrend[i] > memoryTrend[i - 1]) {
              consecutiveIncreases++;
            } else if (memoryTrend[i] < memoryTrend[i - 1] - 1) {
              consecutiveIncreases = 0;
            }
          }
          const memoryGrowth = memoryTrend[memoryTrend.length - 1] - memoryTrend[0];
          
          if (consecutiveIncreases >= 4 || (memoryGrowth > 12 && memoryTrend[memoryTrend.length - 1] > 70)) {
            const currentMem = memoryTrend[memoryTrend.length - 1];
            rawPredictions.push({
              issue: 'Proactive Memory Leak Warning',
              predictedFailure: 'System out-of-memory kernel panic (OOM) and database/process crashes.',
              recommendation: 'Identify processes with rising RSS memory footprints (e.g. Node background tasks) and force garbage collection or schedule a restart.',
              rootCauseAnalysis: `Memory usage has risen steadily from ${memoryTrend[0]}% to ${currentMem}% over the last ${history.length} snapshots.`,
              severity: currentMem > 85 ? 'critical' : 'high',
              confidence: 0.82,
              horizonMinutes: 180,
              evidence: [
                {
                  source: 'metric',
                  title: 'RSS Memory Footprint Rise',
                  detail: `Consecutive upward memory pressure cycles observed over the last ${history.length} collections.`,
                  severity: currentMem > 85 ? 'critical' : 'high',
                  metadata: { memoryTrend, currentMem }
                }
              ],
              recommendedActions: [
                'Free system page caches manually.',
                'Identify runaway services using the process monitor.',
                'Setup microservices memory threshold constraints.'
              ],
              affectedComponents: ['Memory', 'Node.js runtime'],
              impactedServices: ['background-workers', 'node-app'],
              impactedDirectories: []
            });

            rawAnomalies.push({
              type: 'memory_leak',
              title: 'Memory Leak Risk Pattern',
              component: 'RAM',
              severity: currentMem > 85 ? 'critical' : 'high',
              value: currentMem,
              baseline: memoryTrend[0],
              threshold: 75,
              confidence: 0.85,
              detector: 'trend',
              evidence: [`Memory usage grew from ${memoryTrend[0]}% to ${currentMem}% without clearing.`],
              metadata: { currentMem, trend: memoryTrend }
            });
          }
        }

        // 2. Disk Saturation Estimator
        if (history.length >= 3) {
          const diskTrend = history.map(h => h.diskUsagePercent).reverse();
          const latestDisk = diskTrend[diskTrend.length - 1];
          const oldestDisk = diskTrend[0];
          const diskGrowth = latestDisk - oldestDisk;
          
          if (diskGrowth > 0.5 || latestDisk > 85) {
            const timeDiffMin = history.length * 5; // approximately 5 minutes per poll
            const growthRatePerMin = diskGrowth / (timeDiffMin || 1);
            const remainingDisk = 100 - latestDisk;
            const horizonMinutes = growthRatePerMin > 0 ? Math.round(remainingDisk / growthRatePerMin) : 1440;

            if (horizonMinutes < 1440 || latestDisk > 85) {
              rawPredictions.push({
                issue: 'Storage Saturation Horizon Projection',
                predictedFailure: 'Filesystem write freeze, file descriptor exhaustion, and database lockups due to 100% disk usage.',
                recommendation: 'Run automatic scan cleanups on temporary and duplicate log files immediately. Adjust folder bounds.',
                rootCauseAnalysis: `Disk usage is at ${latestDisk}% and has grown by ${diskGrowth}% in the last hour. Projected saturation is in ${Math.round(horizonMinutes / 60)} hours.`,
                severity: latestDisk > 92 ? 'critical' : 'high',
                confidence: 0.88,
                horizonMinutes: Math.max(30, horizonMinutes),
                evidence: [
                  {
                    source: 'trend',
                    title: 'Storage Capacity Burnout Rate',
                    detail: `Storage usage grows at ${(growthRatePerMin * 60).toFixed(3)}% per hour. Remaining space: ${remainingDisk.toFixed(1)}%.`,
                    severity: latestDisk > 92 ? 'critical' : 'high',
                    metadata: { latestDisk, growthRatePerMin }
                  }
                ],
                recommendedActions: [
                  'Run temporary files cleanup scan.',
                  'Archive massive database or server audit logs.',
                  'Resize the logical volume partition.'
                ],
                affectedComponents: ['Filesystem', 'Disk Storage'],
                impactedServices: ['mongodb', 'mysql', 'docker-daemon'],
                impactedDirectories: ['/var/log', '/tmp']
              });

              rawAnomalies.push({
                type: 'disk_saturation',
                title: 'High Disk Burnout Rate Anomaly',
                component: 'Disk',
                severity: latestDisk > 92 ? 'critical' : 'high',
                value: latestDisk,
                baseline: oldestDisk,
                threshold: 85,
                confidence: 0.90,
                detector: 'trend',
                evidence: [`Disk capacity reached ${latestDisk}% growing at ${(growthRatePerMin * 60).toFixed(3)}% per hour.`],
                metadata: { latestDisk, horizonMinutes }
              });
            }
          }
        }

        // 3. Repeated Daemon Crash Warning
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const crashes = await CrashHistory.find({
          server: new Types.ObjectId(serverId),
          timestamp: { $gte: dayAgo }
        }).lean();

        if (crashes.length > 0) {
          const crashCounts: Record<string, number> = {};
          crashes.forEach(c => {
            crashCounts[c.serviceName] = (crashCounts[c.serviceName] || 0) + 1;
          });

          for (const [service, count] of Object.entries(crashCounts)) {
            if (count >= 2) {
              rawPredictions.push({
                issue: `Repeated Daemon Crash Pattern: ${service}`,
                predictedFailure: 'Systemd loop-prevention suspend, causing prolonged, unrecovered service downtime.',
                recommendation: 'Inspect application error stdout logs and configure self-healing parameters to add custom retry limits.',
                rootCauseAnalysis: `Service "${service}" has crashed ${count} times in the last 24 hours. The self-healing restart loops may trigger safety suspension.`,
                severity: 'critical',
                confidence: 0.96,
                horizonMinutes: 60,
                evidence: [
                  {
                    source: 'event',
                    title: `Frequent service crashes: ${service}`,
                    detail: `${count} failures registered in the crash history database logs.`,
                    severity: 'critical',
                    metadata: { service, crashCount: count }
                  }
                ],
                recommendedActions: [
                  'Inspect application daemon systemd/PM2 logs.',
                  'Increase cooldown interval configurations.',
                  'Manually inspect port bindings and memory caps.'
                ],
                affectedComponents: ['Service Daemons', service],
                impactedServices: [service],
                impactedDirectories: []
              });

              rawAnomalies.push({
                type: 'service_crash_loop',
                title: 'Service Crash Loop Threat',
                component: service,
                severity: 'critical',
                value: count,
                baseline: 0,
                threshold: 2,
                confidence: 0.95,
                detector: 'isolation_forest',
                evidence: [`Service "${service}" failed ${count} times in 24 hours.`],
                metadata: { service, count }
              });
            }
          }
        }

        // 4. CPU Saturation Pattern
        if (history.length >= 5) {
          const cpuTrend = history.map(h => h.cpuUsagePercent);
          const highCpuCount = cpuTrend.filter(c => c > 85).length;
          if (highCpuCount >= 3) {
            const avgCpu = cpuTrend.reduce((sum, c) => sum + c, 0) / cpuTrend.length;
            rawPredictions.push({
              issue: 'Sustained CPU Saturation lockup',
              predictedFailure: 'High latency spikes, HTTP request timeouts, and unresponsive SSH logins.',
              recommendation: 'Check top CPU processes for runaways and evaluate logical thread core resizing.',
              rootCauseAnalysis: `CPU usage has exceeded 85% in ${highCpuCount} out of the last 5 telemetry snapshots. Average CPU: ${avgCpu.toFixed(1)}%.`,
              severity: 'high',
              confidence: 0.85,
              horizonMinutes: 120,
              evidence: [
                {
                  source: 'metric',
                  title: 'High CPU Telemetry Average',
                  detail: `Sustained high load average observed. CPU average is ${avgCpu.toFixed(1)}%.`,
                  severity: 'high',
                  metadata: { cpuTrend, avgCpu }
                }
              ],
              recommendedActions: [
                'Kill high-load runaway PIDs via Process Matrix.',
                'Add load balancer capacity routing constraints.',
                'Upgrade virtual instance hardware core allocation.'
              ],
              affectedComponents: ['Processor', 'CPU Cores'],
              impactedServices: ['web-server', 'nginx'],
              impactedDirectories: []
            });

            rawAnomalies.push({
              type: 'cpu_saturation',
              title: 'Sustained CPU Stress Anomaly',
              component: 'CPU',
              severity: 'high',
              value: avgCpu,
              baseline: 30,
              threshold: 80,
              confidence: 0.85,
              detector: 'threshold_statistical',
              evidence: [`CPU remained at an average load of ${avgCpu.toFixed(1)}% over consecutive samples.`],
              metadata: { avgCpu, cpuTrend }
            });
          }
        }
      }

      const scanPredictions = buildScanPredictionIssues(
        recentScanResults as unknown as IScanResult[],
        healthScore,
      );
      const predictions = [...rawPredictions, ...scanPredictions].map(normalizePredictionIssue);

      // Persist the prediction
      const predictionRecord = await Prediction.create({
        server: new Types.ObjectId(serverId),
        serverName: server?.host || 'Unknown',
        healthScore,
        predictions,
        metricsSummary: formattedMetrics[0],
        trendAnalysis: {
          ...trends,
          latestScanId: latestScan?.scanId,
          scanFindingCount: recentScanResults.length,
        },
        aiGeneratedResponse,
        timeWindow: {
          start: recentMetrics[recentMetrics.length - 1]?.collectedAt || new Date(),
          end: recentMetrics[0]?.collectedAt || new Date(),
          minutes: hasEnoughMetrics
            ? Math.round(
                (recentMetrics[0].collectedAt.getTime() -
                  recentMetrics[recentMetrics.length - 1].collectedAt.getTime()) /
                  60000,
              )
            : 0,
        },
        created: new Date(),
        updated: new Date(),
      });

      const anomalyRecords = rawAnomalies.length
        ? await Anomaly.insertMany(
            rawAnomalies.map((anomaly) =>
              normalizeAnomaly(serverId, anomaly, predictionRecord._id as Types.ObjectId),
            ),
          )
        : [];

      socketService.emitToServer(serverId, AI_PREDICTION, predictionRecord);
      if (predictions.some((prediction) => prediction.severity === 'high' || prediction.severity === 'critical')) {
        socketService.emitToServer(serverId, FAILURE_FORECAST, predictionRecord);
      }
      for (const anomaly of anomalyRecords) {
        socketService.emitToServer(serverId, ANOMALY_DETECTED, anomaly);
      }

      return predictionRecord;
    } catch (error) {
      logger.error('Failed to generate maintenance prediction', error);

      const failurePredictions = [
        {
          issue: 'Predictive analysis failed',
          predictedFailure: 'Unknown',
          recommendation: 'Check predictive maintenance server logs',
          severity: 'low' as const,
          confidence: 0,
          horizonMinutes: 0,
          evidence: [
            {
              source: 'event' as const,
              title: 'Execution Error',
              detail: getErrorMessage(error),
              severity: 'low' as const,
              metadata: {},
            },
          ],
          recommendedActions: ['Check logs'],
          affectedComponents: ['AI Service'],
        },
      ];

      // Persist the failure event so it shows up in history
      try {
        const server = await ServerConnection.findById(serverId);
        await Prediction.create({
          server: new Types.ObjectId(serverId),
          serverName: server?.host || 'Unknown',
          healthScore: 0,
          predictions: failurePredictions,
          metricsSummary: {},
          trendAnalysis: {},
          aiGeneratedResponse: false,
          timeWindow: {
            start: new Date(),
            end: new Date(),
            minutes: 0,
          },
          created: new Date(),
          updated: new Date(),
        });
      } catch (persistError) {
        logger.error('Failed to persist failure prediction', persistError);
      }

      return {
        predictions: failurePredictions,
        aiGeneratedResponse: false,
      };
    }
  },

  async getPredictions(serverId?: string, limit = 20) {
    const query = serverId ? { server: new Types.ObjectId(serverId) } : {};
    return Prediction.find(query).sort({ created: -1 }).limit(limit);
  },

  async getLatestPrediction(serverId: string) {
    return Prediction.findOne({ server: new Types.ObjectId(serverId) }).sort({ created: -1 });
  },

  async addFeedback(predictionId: string, rating: number, comment?: string) {
    const prediction = await Prediction.findById(predictionId);
    if (!prediction) throw new Error('Prediction not found');

    prediction.feedback.push({
      rating,
      comment,
      created: new Date(),
    });
    prediction.updated = new Date();
    await prediction.save();
    return prediction;
  },
};
