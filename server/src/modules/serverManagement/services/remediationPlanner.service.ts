import { Types } from 'mongoose';
import { logger } from '../../../utils/logger.util';
import { Alert } from '../models/alert.model';
import { Metric } from '../models/metric.model';
import { RemediationRiskLevel, RemediationToolName } from '../models/remediationJob.model';
import { ScanResult } from '../models/scanResult.model';
import { ServerConnection } from '../models/serverConnection.model';
import { configService } from './config.service';
import { healthService } from './health.service';
import { RemediationToolCall, remediationToolsService } from './remediationTools.service';

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

export interface AgentRemediationPlanParams {
  serverId: string;
  intent: string;
  context?: Record<string, unknown>;
  incidentId?: string;
  predictionId?: string;
  plannedBy?: string;
  approvalMode?: 'manual' | 'auto';
}

export interface AgentRemediationPlan {
  goal: string;
  summary: string;
  target: string;
  description: string;
  planner: string;
  decisionTrace: string[];
  riskLevel: RemediationRiskLevel;
  requiresApproval: boolean;
  steps: RemediationToolCall[];
  rollbackSteps: RemediationToolCall[];
  contextSnapshot: Record<string, unknown>;
}

const toolSummary = remediationToolsService.listTools().map((tool) => ({
  name: tool.name,
  description: tool.description,
  riskLevel: tool.riskLevel,
  requiresApproval: tool.requiresApproval,
  supportsRollback: tool.supportsRollback,
  inputSchema: tool.inputSchema,
}));
const pythonPlannerAllowedTools: RemediationToolName[] = [
  'collect_metrics',
  'run_health_check',
  'start_scan',
  'analyze_scan_results',
  'safe_system_optimization',
  'restart_service',
];

const lower = (value: unknown) => String(value || '').toLowerCase();

const asString = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : undefined;

const normalizeServiceName = (value?: string) => {
  const service = value?.trim().replace(/^["']|["']$/g, '');
  if (!service) {
    return undefined;
  }

  return service.replace(/\.serivce$/i, '.service');
};

const extractServiceNameFromIntent = (intent: string) => {
  const patterns = [
    /\brestart\s+(?:the\s+)?(?:systemd\s+)?service\s+["']?([a-z0-9_.@:-]+)["']?/i,
    /\brestart\s+(?:the\s+)?(?:systemd\s+)?unit\s+["']?([a-z0-9_.@:-]+)["']?/i,
    /\brestart\s+(?:the\s+)?(?:pm2\s+)?(?:app|process)\s+["']?([a-z0-9_.@:-]+)["']?/i,
    /\brestart\s+(?:the\s+)?(?:docker\s+)?container\s+["']?([a-z0-9_.@:-]+)["']?/i,
    /\brestart\s+["']?([a-z0-9_.@:-]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const candidate = normalizeServiceName(intent.match(pattern)?.[1]);
    if (candidate && !['systemd', 'service', 'unit', 'pm2', 'docker', 'container'].includes(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return undefined;
};

const localFallbackPlan = (
  params: AgentRemediationPlanParams,
  contextSnapshot: Record<string, unknown>,
): AgentRemediationPlan => {
  const intent = lower(params.intent);
  const ctx = params.context || {};
  const serviceName =
    normalizeServiceName(asString(ctx.serviceName)) ||
    normalizeServiceName(asString(ctx.service)) ||
    extractServiceNameFromIntent(params.intent);
  const pid =
    asString(ctx.pid) ||
    asString(ctx.processId) ||
    (intent.match(/\bpid\s*[:=]?\s*(\d+)/i)?.[1] ?? undefined);
  const filePath = asString(ctx.path) || asString(ctx.filePath) || asString(ctx.targetPath);
  const directories = Array.isArray(ctx.directories)
    ? ctx.directories.filter((item): item is string => typeof item === 'string' && !!item.trim())
    : undefined;

  const decisionTrace = [
    'Local fallback planner was used because the external remediation planner was unavailable.',
    `Intent received: ${params.intent}`,
  ];

  let steps: RemediationToolCall[] = [{ toolName: 'collect_metrics', args: {} }];
  let rollbackSteps: RemediationToolCall[] = [];
  let target = 'server';
  let summary = 'Collected live diagnostics before making a safe remediation recommendation.';
  let description = params.intent;
  let riskLevel: RemediationRiskLevel = 'medium';
  let requiresApproval = true;

  if (intent.includes('restart') && serviceName) {
    target = serviceName;
    summary = `Restart ${serviceName} after collecting metrics and validating server health.`;
    description = `AI-planned restart for service ${serviceName}.`;
    steps = [
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'run_health_check', args: {} },
      { toolName: 'restart_service', args: { serviceName } },
      { toolName: 'run_health_check', args: {} },
    ];
    rollbackSteps = [{ toolName: 'restart_service', args: { serviceName } }];
  } else if ((intent.includes('kill') || intent.includes('terminate')) && pid) {
    target = pid;
    summary = `Terminate PID ${pid} after gathering diagnostics.`;
    description = `AI-planned process termination for PID ${pid}.`;
    riskLevel = 'high';
    steps = [
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'kill_process', args: { pid } },
      { toolName: 'collect_metrics', args: {} },
    ];
  } else if ((intent.includes('cache') || intent.includes('memory')) && intent.includes('clear')) {
    target = 'memory-cache';
    summary = 'Clear filesystem cache with pre- and post-health verification.';
    description = 'AI-planned cache clearing for memory pressure.';
    steps = [
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'run_health_check', args: {} },
      { toolName: 'clear_cache', args: {} },
      { toolName: 'run_health_check', args: {} },
    ];
  } else if (
    (intent.includes('disk') || intent.includes('space') || intent.includes('storage')) &&
    filePath
  ) {
    target = filePath;
    summary = `Archive ${filePath} to free disk space while preserving recoverability.`;
    description = `AI-planned file archival for ${filePath}.`;
    steps = [
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'archive_file', args: { path: filePath } },
      { toolName: 'run_health_check', args: {} },
    ];
  } else if ((intent.includes('delete') || intent.includes('remove')) && filePath) {
    target = filePath;
    summary = `Prepare a cleanup recommendation for ${filePath}.`;
    description = `AI-planned recommendation workflow for ${filePath}.`;
    riskLevel = 'medium';
    steps = [
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'start_scan', args: { directories: [filePath.split('/').slice(0, -1).join('/') || '/'], includeFullServer: false } },
      { toolName: 'analyze_scan_results', args: {} },
      { toolName: 'run_health_check', args: {} },
    ];
  } else if (intent.includes('scan') || intent.includes('cleanup') || intent.includes('disk')) {
    target = directories?.join(', ') || 'server-storage-surface';
    summary =
      'Scan the actual server storage surface, analyze safe cleanup candidates, apply safe actions, then verify metrics and predictions.';
    description = 'AI-planned storage remediation workflow with post-remediation verification.';
    riskLevel = 'medium';
    steps = [
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'run_health_check', args: {} },
      { toolName: 'start_scan', args: directories?.length ? { directories, includeFullServer: true } : { includeFullServer: true } },
      { toolName: 'analyze_scan_results', args: {} },
      { toolName: 'safe_system_optimization', args: { reason: 'Run conservative optimization if scan cleanup cannot reclaim enough space.' } },
      { toolName: 'collect_metrics', args: {} },
      { toolName: 'run_health_check', args: {} },
    ];
  }

  if (params.approvalMode === 'auto') {
    requiresApproval = false;
    decisionTrace.push('Approval mode requested automatic execution eligibility.');
  }

  return {
    goal: params.intent,
    summary,
    target,
    description,
    planner: 'local_fallback',
    decisionTrace,
    riskLevel,
    requiresApproval,
    steps,
    rollbackSteps,
    contextSnapshot,
  };
};

const buildContextSnapshot = async (serverId: string, userContext?: Record<string, unknown>) => {
  const [server, config, healthScore, latestMetrics, recentAlerts, recentScanResults] =
    await Promise.all([
      ServerConnection.findById(serverId).lean(),
      configService.get(serverId),
      healthService.calculateScore(serverId),
      Metric.find({ server: new Types.ObjectId(serverId) })
        .sort({ collectedAt: -1 })
        .limit(5)
        .lean(),
      Alert.find({ server: new Types.ObjectId(serverId) })
        .sort({ created: -1 })
        .limit(5)
        .lean(),
      ScanResult.find({ server: new Types.ObjectId(serverId) })
        .sort({ discoveredAt: -1 })
        .limit(10)
        .lean(),
    ]);

  return {
    server: server
      ? {
          id: String(server._id),
          host: server.host,
          name: server.name,
          status: server.status,
          lastConnectedAt: server.lastConnectedAt,
        }
      : undefined,
    healthScore,
    config: {
      diskThresholdPercent: config.diskThresholdPercent,
      cpuThresholdPercent: config.cpuThresholdPercent,
      memoryThresholdPercent: config.memoryThresholdPercent,
      archiveDirectory: config.archiveDirectory,
      automationEnabled: config.automationEnabled,
      scanDirectories: config.scanDirectories,
      ignoreFolders: config.ignoreFolders,
    },
    latestMetrics: latestMetrics.map((metric) => ({
      collectedAt: metric.collectedAt,
      cpuUsagePercent: metric.cpuUsagePercent,
      memoryUsagePercent: metric.memoryUsagePercent,
      diskUsagePercent: metric.diskUsagePercent,
      loadAverage: metric.loadAverage,
      topProcesses: metric.topProcesses?.slice(0, 5) || [],
      runningServices: metric.runningServices?.slice(0, 10) || [],
    })),
    recentAlerts: recentAlerts.map((alert) => ({
      type: alert.type,
      severity: alert.severity,
      title: alert.title,
      message: alert.message,
      created: alert.created,
    })),
    recentScanResults: recentScanResults.map((result) => ({
      id: String(result._id),
      path: result.path,
      category: result.category,
      sizeMb: result.sizeMb,
      reviewStatus: result.reviewStatus,
      actionStatus: result.actionStatus,
      recommendation: result.aiRecommendation,
    })),
    userContext: userContext || {},
  };
};

const normalizePlanForIntent = (plan: AgentRemediationPlan, params: AgentRemediationPlanParams) => {
  const sanitizedPlan: AgentRemediationPlan = {
    ...plan,
    requiresApproval: true,
    steps: plan.steps.filter((step) => pythonPlannerAllowedTools.includes(step.toolName)),
    rollbackSteps: plan.rollbackSteps.filter((step) => pythonPlannerAllowedTools.includes(step.toolName)),
    decisionTrace: [...plan.decisionTrace, 'Planner output sanitized to recommendation-safe tool allowlist.'],
  };

  const intent = lower(params.intent);
  const serviceName = extractServiceNameFromIntent(params.intent);
  if (intent.includes('restart') && serviceName) {
    return {
      ...sanitizedPlan,
      target: serviceName,
      summary: `Restart ${serviceName} after validating server health.`,
      description: `Restart service ${serviceName}.`,
      riskLevel: 'medium' as RemediationRiskLevel,
      requiresApproval: true,
      steps: [
        { toolName: 'run_health_check' as RemediationToolName, args: {} },
        { toolName: 'restart_service' as RemediationToolName, args: { serviceName } },
        { toolName: 'run_health_check' as RemediationToolName, args: {} },
      ],
      rollbackSteps: [{ toolName: 'restart_service' as RemediationToolName, args: { serviceName } }],
      decisionTrace: [
        ...sanitizedPlan.decisionTrace,
        `Restart intent normalized to direct service restart target "${serviceName}".`,
      ],
    };
  }

  const isStorageIntent = intent.includes('scan') || intent.includes('cleanup') || intent.includes('disk') || intent.includes('space') || intent.includes('storage');
  if (!isStorageIntent) {
    return sanitizedPlan;
  }

  const steps = sanitizedPlan.steps.map((step) =>
    step.toolName === 'start_scan'
      ? { ...step, args: { ...step.args, includeFullServer: true } }
      : step,
  );
  if (!steps.some((step) => step.toolName === 'safe_system_optimization')) {
    steps.push({
      toolName: 'safe_system_optimization',
      args: { reason: 'Run conservative optimization if scan cleanup cannot reclaim enough space.' },
      reasoning: 'Run safe cache, package, journal, and stale temp optimization before final verification.',
    });
  }

  return {
    ...sanitizedPlan,
    target: sanitizedPlan.target === 'configured-directories' ? 'server-storage-surface' : sanitizedPlan.target,
    steps,
    decisionTrace: [
      ...sanitizedPlan.decisionTrace,
      'Storage remediation normalized to inspect the actual server storage surface with safety filters.',
    ],
  };
};

export const remediationPlannerService = {
  async buildPlan(params: AgentRemediationPlanParams): Promise<AgentRemediationPlan> {
    const contextSnapshot = await buildContextSnapshot(params.serverId, params.context);
    const apiBaseUrl = getAgenticApiBaseUrl();

    if (apiBaseUrl) {
      try {
        const response = await fetch(`${apiBaseUrl}/maintenance/remediation-plan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            serverId: params.serverId,
            intent: params.intent,
            context: contextSnapshot,
            tools: toolSummary,
            openAiKey: process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY,
            llmProvider:
              process.env.OPENAI_API_KEY || process.env.CREWAI_CONTENT_OPENAI_API_KEY
                ? 'openai'
                : undefined,
          }),
          signal: getAgenticFetchSignal(),
        });

        if (!response.ok) {
          throw new Error(`Planner service returned ${response.status}`);
        }

        const payload = (await response.json()) as {
          plan?: AgentRemediationPlan;
        };

        if (payload.plan?.steps?.length) {
          return normalizePlanForIntent({
            ...payload.plan,
            contextSnapshot,
          }, params);
        }
      } catch (error) {
        logger.warn(
          `External remediation planner unavailable; using local fallback: ${getErrorMessage(error)}`,
        );
      }
    }

    return normalizePlanForIntent(localFallbackPlan(params, contextSnapshot), params);
  },
};
