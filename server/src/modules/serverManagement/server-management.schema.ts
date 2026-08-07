import { z } from 'zod';
import { fileCategories } from './models/scanResult.model';

const objectId = z.string().min(1);
const actionEnum = z.enum(['delete', 'archive', 'ignore']);
const categoryEnum = z.enum(fileCategories);

const normalizeCategoryQueryValue = (value: unknown) => {
  if (Array.isArray(value)) {
    return normalizeCategoryQueryValue(value[0]);
  }

  if (value && typeof value === 'object') {
    const candidate = value as Record<string, unknown>;
    return normalizeCategoryQueryValue(candidate.value ?? candidate.label);
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  if (!normalized || /^all(\s|-|_)?categories$/i.test(normalized) || /^all$/i.test(normalized)) {
    return undefined;
  }

  return normalized.toLowerCase();
};

const optionalCategoryQuerySchema = z.preprocess(
  normalizeCategoryQueryValue,
  categoryEnum.optional(),
);

const automationRuleSchema = z.object({
  enabled: z.boolean().default(true),
  action: actionEnum,
  category: categoryEnum.optional(),
  olderThanDays: z.number().min(0).optional(),
  largerThanMb: z.number().min(0).optional(),
  targetFolder: z.string().optional(),
});

export const connectServerSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).optional(),
      host: z.string().min(1),
      port: z.number().int().min(1).max(65535).default(22),
      username: z.string().min(1),
      authType: z.enum(['password', 'sshKey']),
      password: z.string().optional(),
      privateKey: z.string().optional(),
      pemFileName: z.string().optional(),
      passphrase: z.string().optional(),
      email: z.string().email(),
      verifyConnection: z.boolean().optional(),
      scanDirectories: z.array(z.string().min(1)).optional(),
    })
    .refine(
      (value) => (value.authType === 'password' ? Boolean(value.password) : Boolean(value.privateKey)),
      {
        message: 'Password or private key is required for the selected authentication type.',
        path: ['authType'],
      }
    ),
});

export const serverIdQuerySchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
  }),
});

export const startScanSchema = z.object({
  body: z.object({
    serverId: objectId,
    directories: z.array(z.string().min(1)).optional(),
  }),
});

export const cleanupRecommendationsSchema = z.object({
  body: z.object({
    serverId: objectId,
    directories: z.array(z.string().min(1)).optional(),
  }),
});

export const cleanupSummaryParamsSchema = z.object({
  params: z.object({
    scanId: z.string().min(1),
  }),
});

export const cleanupExecuteParamsSchema = cleanupSummaryParamsSchema;
export const cleanupExecuteSchema = z.object({
  params: z.object({
    scanId: z.string().min(1),
  }),
  body: z.object({
    serverId: objectId,
  }),
});

export const scanResultsQuerySchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
    scanId: z.string().optional(),
    category: optionalCategoryQuerySchema,
    search: z.string().optional(),
    status: z.enum(['pending_review', 'reviewed']).optional(),
    minSizeMb: z.string().optional(),
    maxSizeMb: z.string().optional(),
    olderThanDays: z.string().optional(),
    markReviewed: z.enum(['true', 'false']).optional(),
    latest: z.enum(['true', 'false']).optional(),
    limit: z.string().optional(),
  }),
});

export const saveConfigSchema = z.object({
  body: z.object({
    serverId: objectId,
    diskThresholdPercent: z.number().min(1).max(100).optional(),
    cpuThresholdPercent: z.number().min(1).max(100).optional(),
    memoryThresholdPercent: z.number().min(1).max(100).optional(),
    scanFrequencyMinutes: z.number().int().min(1).max(1440).optional(),
    predictionIntervalMinutes: z.number().int().min(1).max(1440).optional(),
    unusedFileDays: z.number().int().min(1).optional(),
    largeFileMb: z.number().min(1).optional(),
    archiveOlderThanDays: z.number().int().min(1).optional(),
    deleteOlderThanDays: z.number().int().min(1).optional(),
    cleanupAutomationEnabled: z.boolean().optional(),
    cleanupFrequencyMinutes: z.number().int().min(1).max(10080).optional(),
    archiveLargeFileMb: z.number().min(1).optional(),
    archiveDirectory: z.string().min(1).optional(),
    scanDirectories: z.array(z.string().min(1)).optional(),
    ignoreFolders: z.array(z.string().min(1)).optional(),
    tempPatterns: z.array(z.string().min(1)).optional(),
    logPatterns: z.array(z.string().min(1)).optional(),
    automationEnabled: z.boolean().optional(),
    maxRestartAttempts: z.number().int().min(1).max(10).optional(),
    restartCooldownMinutes: z.number().int().min(1).max(120).optional(),
    rules: z.array(automationRuleSchema).optional(),
  }),
});

export const getConfigSchema = z.object({
  query: z.object({
    serverId: objectId,
  }),
});

export const runAgentSchema = z.object({
  body: z.object({
    serverId: objectId,
    scanId: z.string().optional(),
    execute: z.boolean().optional(),
  }),
});

export const predictMaintenanceSchema = z.object({
  body: z.object({
    serverId: objectId,
  }),
});

export const predictionHistoryQuerySchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
    limit: z.string().optional(),
  }),
});

export const latestPredictionQuerySchema = z.object({
  query: z.object({
    serverId: objectId,
  }),
});

export const manualActionSchema = z.object({
  body: z.object({
    serverId: objectId,
    fileIds: z.array(objectId).min(1),
    action: actionEnum,
    reason: z.string().optional(),
  }),
});

export const metricsQuerySchema = z.object({
  params: z.object({
    serverId: objectId.optional(),
  }).optional(),
  query: z
    .object({
      serverId: objectId.optional(),
      limit: z.string().optional(),
      range: z.enum(['30m', '1h', '4h', '6h', '12h', '24h', '48h', '7d', '30d', 'custom']).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    })
    .refine(
      (value) => value.range !== 'custom' || (Boolean(value.startTime) && Boolean(value.endTime)),
      {
        message: 'startTime and endTime are required when range is custom.',
        path: ['startTime'],
      },
    ),
});

export const cpuMetricsQuerySchema = z.object({
  params: z.object({
    serverId: objectId,
  }),
  query: z
    .object({
      range: z.enum(['30m', '1h', '4h', '6h', '12h', '24h', '48h', '7d', '30d', 'custom']).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
    })
    .refine(
      (value) => value.range !== 'custom' || (Boolean(value.startTime) && Boolean(value.endTime)),
      {
        message: 'startTime and endTime are required when range is custom.',
        path: ['startTime'],
      },
    ),
});

export const metricSeriesQuerySchema = z.object({
  query: z
    .object({
      serverId: objectId,
      namespace: z.enum(['System', 'CPU', 'Memory', 'Disk', 'Network', 'Process', 'Application', 'Security', 'Docker']).optional(),
      metricName: z.string().min(1),
      aggregation: z.enum(['avg', 'min', 'max', 'sum', 'count']).optional(),
      timeRange: z.enum(['30m', '1h', '4h', '12h', '24h', '48h', '7d', '30d', 'custom']).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      granularity: z.enum(['auto', '1m', '5m', '15m', '1h', '1d']).optional(),
      dimensions: z.string().optional(),
    })
    .refine(
      (value) => value.timeRange !== 'custom' || (Boolean(value.startTime) && Boolean(value.endTime)),
      {
        message: 'startTime and endTime are required when timeRange is custom.',
        path: ['startTime'],
      },
    ),
});

export const logsQuerySchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortfield: z.string().optional(),
    direction: z.enum(['asc', 'desc']).optional(),
    criteria: z.string().optional(),
    filter: z.string().optional(),
  }),
});

export const logsAnalyticsQuerySchema = z.object({
  query: z
    .object({
      serverId: objectId.optional(),
      timeRange: z.enum(['30m', '1h', '4h', '12h', '24h', '48h', '7d', '30d', 'custom']).optional(),
      startTime: z.string().optional(),
      endTime: z.string().optional(),
      severity: z.string().optional(),
      source: z.string().optional(),
      logType: z.string().optional(),
      serviceName: z.string().optional(),
      keyword: z.string().optional(),
      errorSecurityOnly: z.enum(['true', 'false']).optional(),
      limit: z.string().optional(),
      page: z.string().optional(),
      sort: z.enum(['asc', 'desc']).optional(),
    })
    .refine(
      (value) => value.timeRange !== 'custom' || (Boolean(value.startTime) && Boolean(value.endTime)),
      {
        message: 'startTime and endTime are required when timeRange is custom.',
        path: ['startTime'],
      },
    ),
});

export const fileScannerQuerySchema = z.object({
  params: z.object({
    serverId: objectId.optional(),
  }).optional(),
  query: z.object({
    serverId: objectId.optional(),
    riskLevel: z.enum(['safe', 'low', 'medium', 'high', 'critical']).optional(),
    scanStatus: z.enum(['pending', 'scanning', 'completed', 'failed', 'skipped', 'marked_safe']).optional(),
    timeRange: z.enum(['30m', '1h', '4h', '12h', '24h', '48h', '7d', '30d', 'custom']).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const fileScannerIdSchema = z.object({
  params: z.object({
    serverId: objectId.optional(),
    id: objectId,
  }),
});

export const reportQuerySchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

export const incidentAnalyzeSchema = z.object({
  body: z.object({
    serverId: objectId,
    windowMinutes: z.number().int().min(1).optional(),
  }),
});

export const incidentQuerySchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const incidentIdParamsSchema = z.object({
  params: z.object({
    incidentId: objectId,
  }),
});

const staticRemediationPlanBodySchema = z.object({
  serverId: objectId,
  type: z.enum([
    'restart_service',
    'kill_process',
    'clear_cache',
    'rollback',
    'delete_file',
    'archive_file',
    'custom_command',
  ]),
  target: z.string().min(1),
  description: z.string().min(1),
  incidentId: objectId.optional(),
  predictionId: objectId.optional(),
});

const agentRemediationPlanBodySchema = z.object({
  serverId: objectId,
  intent: z.string().min(1),
  context: z.record(z.any()).optional(),
  description: z.string().min(1).optional(),
  incidentId: objectId.optional(),
  predictionId: objectId.optional(),
  approvalMode: z.enum(['manual', 'auto']).optional(),
});

export const planRemediationSchema = z.object({
  body: z.union([staticRemediationPlanBodySchema, agentRemediationPlanBodySchema]),
});

export const executeRemediationSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});

export const listRemediationSchema = z.object({
  query: z.object({
    serverId: objectId.optional(),
    limit: z.string().optional(),
  }),
});

export const rollbackRemediationSchema = z.object({
  params: z.object({
    id: objectId,
  }),
});
