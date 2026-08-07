import { z } from 'zod';

const objectId = z.string().min(1);

// ─── Credential ──────────────────────────────────────────────────────────────

export const createCredentialSchema = z.object({
  body: z.object({
    name: z.string().min(1).trim(),
    type: z.enum(['sshKey', 'httpsToken', 'password']),
    value: z.string().min(1),
    passphrase: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const updateCredentialSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(1).trim().optional(),
    value: z.string().min(1).optional(),
    passphrase: z.string().optional(),
    description: z.string().optional(),
  }),
});

export const credentialIdParamsSchema = z.object({
  params: z.object({ id: objectId }),
});

// ─── Deployment Target ────────────────────────────────────────────────────────

export const createDeploymentTargetSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).trim(),
      host: z.string().min(1).trim(),
      port: z.coerce.number().int().min(1).max(65535).default(22),
      username: z.string().min(1).trim(),
      authMethod: z.enum(['sshKey', 'password']),
      credentialId: objectId,
      os: z.string().optional(),
      privilegeEscalation: z.enum(['sudo', 'none']).optional(),
      baseWebRoot: z.string().optional(),
      nodeInstallStrategy: z.enum(['nvm', 'apt', 'preinstalled']).optional(),
      reverseProxy: z.enum(['nginx-managed', 'none']).optional(),
      verifyConnection: z.boolean().optional(),
    }),
});

export const updateDeploymentTargetSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    name: z.string().min(1).trim().optional(),
    host: z.string().min(1).trim().optional(),
    port: z.coerce.number().int().min(1).max(65535).optional(),
    username: z.string().min(1).trim().optional(),
    authMethod: z.enum(['sshKey', 'password']).optional(),
    credentialId: objectId.optional(),
    os: z.string().optional(),
    privilegeEscalation: z.enum(['sudo', 'none']).optional(),
    baseWebRoot: z.string().optional(),
    nodeInstallStrategy: z.enum(['nvm', 'apt', 'preinstalled']).optional(),
    reverseProxy: z.enum(['nginx-managed', 'none']).optional(),
  }),
});

export const deploymentTargetIdParamsSchema = z.object({
  params: z.object({ id: objectId }),
});

export const testDeploymentTargetSchema = z.object({
  params: z.object({ id: objectId }),
});

// ─── Application ─────────────────────────────────────────────────────────────

const componentEnvVarSchema = z.object({
  key: z.string().min(1).trim(),
  value: z.string(),
});

const componentSchema = z.object({
  key: z.string().min(1).trim(),
  type: z.enum(['node-api', 'react-ui', 'static']),
  sourcePath: z.string().trim().optional(),
  repoUrl: z.string().trim().optional(),
  nodeVersion: z.string().trim().optional(),
  installCommand: z.string().trim().optional(),
  buildCommand: z.string().trim().optional(),
  buildOutputDir: z.string().trim().optional(),
  startCommand: z.string().trim().optional(),
  port: z.coerce.number().int().min(1).max(65535).optional(),
  deployPath: z.string().trim().optional(),
  healthCheckPath: z.string().trim().optional(),
  healthCheckUrl: z.string().trim().optional(),
  envVars: z.array(componentEnvVarSchema).optional(),
});

const repositorySchema = z.object({
  url: z.string().min(1).trim(),
  provider: z.enum(['github', 'gitlab', 'bitbucket', 'custom']).optional(),
  authMethod: z.enum(['public', 'sshDeployKey', 'httpsToken']),
  credentialId: objectId.optional(),
  branch: z.string().trim().optional(),
});

const autoDeploySchema = z.object({
  enabled: z.boolean(),
  targetId: objectId.optional(),
  branch: z.string().trim().optional(),
});

const notificationSettingsSchema = z.object({
  notifyOnStart: z.boolean().default(true),
  notifyOnSuccess: z.boolean().default(true),
  notifyOnFailure: z.boolean().default(true),
  notifyOnRollback: z.boolean().default(true),
  additionalRecipients: z.array(z.string().email()).default([]),
});

export const createApplicationSchema = z.object({
  body: z
    .object({
      name: z.string().min(1).trim().regex(/^[a-z0-9-_]+$/, 'Name must be slug-safe (lowercase, numbers, hyphens, underscores).'),
      displayName: z.string().min(1).trim().optional(),
      description: z.string().trim().optional(),
      repository: repositorySchema,
      layout: z.enum(['monorepo', 'multi-repo']),
      applicationPath: z.string().trim().optional(),
      components: z.array(componentSchema).min(1),
      defaultTargetId: objectId.optional(),
      releasesKept: z.coerce.number().int().min(1).max(20).optional(),
      autoDeploy: autoDeploySchema.optional(),
      notificationSettings: notificationSettingsSchema.optional(),
      alertEmail: z.string().trim().email('Invalid email address.').or(z.literal('')).optional(),
    })
    .refine(
      (data) =>
        data.repository.authMethod === 'public' || Boolean(data.repository.credentialId),
      {
        message: 'credentialId is required for non-public repositories.',
        path: ['repository', 'credentialId'],
      }
    ),
});

export const updateApplicationSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    displayName: z.string().min(1).trim().optional(),
    description: z.string().trim().optional(),
    repository: repositorySchema.partial().optional(),
    layout: z.enum(['monorepo', 'multi-repo']).optional(),
    applicationPath: z.string().trim().optional(),
    components: z.array(componentSchema).min(1).optional(),
    defaultTargetId: objectId.optional(),
    releasesKept: z.coerce.number().int().min(1).max(20).optional(),
    autoDeploy: autoDeploySchema.optional(),
    notificationSettings: notificationSettingsSchema.optional(),
    alertEmail: z.string().trim().email('Invalid email address.').or(z.literal('')).optional(),
  }),
});

export const applicationIdParamsSchema = z.object({
  params: z.object({ id: objectId }),
});

export const updateAutoDeploySchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    enabled: z.boolean(),
    targetId: objectId.optional(),
    branch: z.string().trim().optional(),
  }),
});

export const listApplicationsQuerySchema = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    search: z.string().optional(),
  }),
});

// ─── Deployment ───────────────────────────────────────────────────────────────

export const triggerDeploymentSchema = z.object({
  body: z.object({
    applicationId: objectId,
    targetId: objectId,
    branch: z.string().trim().optional(),
    commitSha: z.string().trim().optional(),
    predictionId: objectId.optional(),
  }),
});

// ─── Predictive Intelligence ────────────────────────────────────────────────

const changedFileSchema = z.object({
  path: z.string().min(1),
  changeType: z.string().optional(),
  additions: z.number().optional(),
  deletions: z.number().optional(),
  diff: z.string().optional(),
});

export const predictDeploymentSchema = z.object({
  body: z.object({
    applicationId: objectId,
    targetId: objectId,
    branch: z.string().trim().optional(),
    commitSha: z.string().trim().optional(),
    commit: z
      .object({
        sha: z.string().optional(),
        message: z.string().optional(),
        author: z.string().optional(),
        ref: z.string().optional(),
      })
      .optional(),
    changedFiles: z.array(changedFileSchema).optional(),
  }),
});

export const listPredictionsQuerySchema = z.object({
  query: z.object({
    applicationId: objectId.optional(),
    targetId: objectId.optional(),
    recommendation: z.enum(['proceed', 'proceed_with_caution', 'block']).optional(),
    source: z.enum(['ai', 'heuristic']).optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const predictionIdParamsSchema = z.object({
  params: z.object({ id: objectId }),
});

export const deploymentIdParamsSchema = z.object({
  params: z.object({ id: objectId }),
});

export const listDeploymentsQuerySchema = z.object({
  query: z.object({
    applicationId: objectId.optional(),
    targetId: objectId.optional(),
    status: z
      .enum(['pending', 'running', 'success', 'failed', 'rolling_back', 'rolled_back', 'cancelled'])
      .optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const rollbackDeploymentSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    reason: z.string().min(1).optional(),
    targetVersion: z.string().trim().optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  }),
});

export const analyzeRollbackSchema = z.object({
  params: z.object({ id: objectId }),
  body: z.object({
    targetVersion: z.string().trim().optional(),
  }),
});

export const cancelDeploymentSchema = z.object({
  params: z.object({ id: objectId }),
});

// ─── Logs ─────────────────────────────────────────────────────────────────────

export const deploymentLogsQuerySchema = z.object({
  params: z.object({ id: objectId }),
  query: z.object({
    stepName: z.string().optional(),
    level: z.enum(['info', 'warn', 'error', 'debug']).optional(),
    since: z.string().optional(),
    limit: z.string().optional(),
  }),
});

// ─── Reports ──────────────────────────────────────────────────────────────────

export const getReportQuerySchema = z.object({
  query: z.object({
    applicationId: z.string().optional(),
    targetId: z.string().optional(),
    status: z.string().optional(),
    environment: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
  }),
});

export const getPm2QuerySchema = z.object({
  query: z.object({
    targetId: z.string().min(1),
  }),
});

export const exportReportSchema = z.object({
  query: z.object({
    type: z.enum(['deployments', 'versions', 'servers', 'health-checks', 'failures', 'audit-trail']),
    format: z.enum(['csv', 'excel', 'pdf']),
    applicationId: z.string().optional(),
    targetId: z.string().optional(),
    status: z.string().optional(),
    environment: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),
});

// ─── Version History & Version-level Rollback ─────────────────────────────────

export const appVersionsQuerySchema = z.object({
  query: z.object({ applicationId: objectId }),
});

export const rollbackToVersionSchema = z.object({
  params: z.object({ targetDeploymentId: objectId }),
  body: z.object({
    reason: z.string().min(1).optional(),
    confidenceScore: z.number().min(0).max(100).optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
  }),
});
