export type RiskLevel = 'low' | 'medium' | 'high'

export interface IVersionRecord {
  version: string
  buildNumber?: string
  commitHash?: string
  environment?: string
  deploymentDate: string
  status: string
  releaseDir?: string
  deploymentId?: string
  trigger?: DeploymentTrigger
}

export interface IRollbackRecord {
  sourceVersion?: string
  targetVersion?: string
  rollbackReason?: string
  confidenceScore?: number
  riskLevel?: RiskLevel
  status: 'success' | 'failed'
  triggeredBy?: string
  startedAt: string
  completedAt?: string
  recoveryResult?: string
}

export interface RollbackAnalysis {
  confidenceScore: number
  riskLevel: RiskLevel
  recommendation: string
  estimatedRecoveryTime: string
  failureAnalysis: {
    rootCause?: string
    impactAssessment?: string
    recoveryRecommendation?: string
  }
}

export interface RollbackStats {
  total: number
  successful: number
  failed: number
  successRate: number
  avgRecoveryTimeMs?: number | null
}

// ─── Predictive Intelligence ────────────────────────────────────────────────

export type PredictionRecommendation = 'proceed' | 'proceed_with_caution' | 'block'
export type PredictionSource = 'ai' | 'heuristic' | 'no_changes' | 'unavailable'
export type PredictionRiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface ICommitEntry {
  sha: string
  message?: string
  author?: string
  date?: string
}

export interface IChangedFile {
  path: string
  changeType: string
  additions?: number
  deletions?: number
  diff?: string
}

export interface IPredictionRisk {
  severity: PredictionRiskSeverity
  area: string
  issue: string
  mitigation?: string
}

export interface IImpactedComponent {
  key: string
  type?: string
  reason?: string
  downstream?: boolean
}

export interface IDependencyGraph {
  nodes: { key: string; type: string; port?: number }[]
  edges: { from: string; to: string; relation: string }[]
}

export interface DeploymentPrediction {
  _id: string
  applicationId: string | DeploymentAppRef
  targetId: string | DeploymentTargetRef
  deploymentId?: string | { _id: string; status: DeploymentStatus; startedAt?: string; completedAt?: string; durationMs?: number; commit?: ICommitInfo; trigger?: DeploymentTrigger }
  branch?: string
  commit?: ICommitInfo
  commits: ICommitEntry[]
  changedFiles: IChangedFile[]
  riskScore: number
  failureProbability: number
  confidenceScore: number
  recommendation: PredictionRecommendation
  summary?: string
  risks: IPredictionRisk[]
  impactedComponents: IImpactedComponent[]
  recommendations: string[]
  dependencyGraph?: IDependencyGraph
  source: PredictionSource
  noChangesDetected?: boolean
  predictionUnavailable?: boolean
  predictionError?: string
  proceeded?: boolean
  triggeredBy?: string
  created: string
  updated: string
}

export interface PredictDeploymentPayload {
  applicationId: string
  targetId: string
  branch?: string
  commitSha?: string
  commit?: ICommitInfo
  changedFiles?: IChangedFile[]
}

export interface PredictionsQuery {
  applicationId?: string
  targetId?: string
  recommendation?: PredictionRecommendation
  source?: PredictionSource
  page?: string
  limit?: string
}

export type CredentialType = 'sshKey' | 'httpsToken' | 'password'
export type TargetStatus = 'unknown' | 'reachable' | 'unreachable'
export type AppLayout = 'monorepo' | 'multi-repo'
export type ComponentType = 'node-api' | 'react-ui' | 'static'
export type RepoProvider = 'github' | 'gitlab' | 'bitbucket' | 'custom'
export type RepoAuthMethod = 'public' | 'httpsToken' | 'sshKey'
export type DeploymentStatus = 'pending' | 'running' | 'success' | 'failed' | 'rolling_back' | 'rolled_back' | 'cancelled'
export type DeploymentTrigger = 'manual' | 'webhook' | 'rollback'
export type StepStatus = 'pending' | 'running' | 'success' | 'skipped' | 'failed'
export type LogLevel = 'info' | 'warn' | 'error' | 'debug'

// ─── Credential ───────────────────────────────────────────────────────────────

export interface Credential {
  _id: string
  name: string
  type: CredentialType
  description?: string
  owner: string
  active: boolean
  created: string
  updated: string
}

export interface CreateCredentialPayload {
  name: string
  type: CredentialType
  value: string
  passphrase?: string
  description?: string
}

// ─── DeploymentTarget ─────────────────────────────────────────────────────────

export interface DeploymentTarget {
  _id: string
  name: string
  type: 'ssh'
  host: string
  port: number
  username: string
  authMethod: 'password' | 'sshKey'
  credentialId: string
  os: string
  privilegeEscalation: 'sudo' | 'none'
  baseWebRoot: string
  nodeInstallStrategy: 'nvm' | 'apt' | 'preinstalled'
  reverseProxy: 'nginx-managed' | 'none'
  status: TargetStatus
  owner: string
  active: boolean
  created: string
  updated: string
}

export interface CreateDeploymentTargetPayload {
  name: string
  host: string
  port?: number
  username: string
  authMethod: 'password' | 'sshKey'
  credentialId: string
  os?: string
  privilegeEscalation?: 'sudo' | 'none'
  baseWebRoot?: string
  nodeInstallStrategy?: 'nvm' | 'apt' | 'preinstalled'
  reverseProxy?: 'nginx-managed' | 'none'
}

// ─── Application ──────────────────────────────────────────────────────────────

export interface IRepository {
  url: string
  provider: RepoProvider
  authMethod: RepoAuthMethod
  credentialId?: string
  branch: string
}

export interface IComponent {
  key: string
  type: ComponentType
  sourcePath?: string
  repoUrl?: string
  nodeVersion?: string
  installCommand?: string
  buildCommand?: string
  buildOutputDir?: string
  startCommand?: string
  port?: number
  deployPath?: string
  healthCheckPath?: string
  healthCheckUrl?: string
}

export interface IAutoDeploy {
  enabled: boolean
  targetId?: string
  branch?: string
}

export interface INotificationSettings {
  notifyOnStart: boolean
  notifyOnSuccess: boolean
  notifyOnFailure: boolean
  notifyOnRollback: boolean
  additionalRecipients: string[]
}

export interface Application {
  _id: string
  name: string
  displayName?: string
  description?: string
  layout: AppLayout
  applicationPath?: string
  repository: IRepository
  components: IComponent[]
  autoDeploy?: IAutoDeploy
  webhookUrl?: string
  hasWebhookSecret?: boolean
  owner: string
  active: boolean
  notificationSettings?: INotificationSettings
  alertEmail?: string
  created: string
  updated: string
}

export interface CreateApplicationPayload {
  name: string
  layout: AppLayout
  applicationPath?: string
  repository: IRepository
  components: IComponent[]
  autoDeploy?: IAutoDeploy
  notificationSettings?: INotificationSettings
  alertEmail?: string
}

// ─── Deployment ───────────────────────────────────────────────────────────────

export interface ICommitInfo {
  sha?: string
  message?: string
  author?: string
  ref?: string
}

export interface IDeploymentStepResult {
  stepName: string
  status: StepStatus
  startedAt?: string
  completedAt?: string
  durationMs?: number
  error?: string
}

// Populated shapes returned by the list/getById API endpoints
export interface DeploymentAppRef { _id: string; name: string; displayName?: string }
export interface DeploymentTargetRef { _id: string; name: string; host: string }

export interface Deployment {
  _id: string
  applicationId: string | DeploymentAppRef
  targetId: string | DeploymentTargetRef
  status: DeploymentStatus
  steps: IDeploymentStepResult[]
  trigger?: DeploymentTrigger
  commit?: ICommitInfo
  deliveryId?: string
  rolledBack?: boolean
  triggeredBy?: string
  startedAt?: string
  completedAt?: string
  durationMs?: number
  releaseDir?: string
  previousReleaseDir?: string
  error?: string
  rollbackReason?: string
  versionHistory?: IVersionRecord[]
  rollbackHistory?: IRollbackRecord[]
  owner: string
  created: string
}

export interface TriggerDeploymentPayload {
  applicationId: string
  targetId: string
  predictionId?: string
}

export interface RotateWebhookSecretResponse {
  secret: string
}

// ─── DeploymentLog ────────────────────────────────────────────────────────────

export interface DeploymentLog {
  _id: string
  deploymentId: string
  stepName?: string
  level: LogLevel
  message: string
  timestamp: string
}

export interface DeploymentLogsQuery {
  stepName?: string
  level?: LogLevel
  limit?: number
}
