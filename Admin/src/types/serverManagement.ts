export interface CpuMemLivePayload {
  serverId?: string
  cpuUsagePercent: number
  memoryUsagePercent: number
  swapUsagePercent: number
  loadAverage: number
  memoryCachedBytes?: number
  networkRxBytesPerSecond?: number
  networkTxBytesPerSecond?: number
  processesTotal?: number
  timestamp: number
}

export type ServerStatus = 'pending' | 'connected' | 'unreachable' | 'disabled'
export type FileCategory =
  | 'unused'
  | 'large'
  | 'logs'
  | 'temp'
  | 'duplicate'
  | 'system'
  | 'config'
  | 'application'
  | 'crash'
  | 'service'
  | 'other'
export type FileAction = 'delete' | 'archive' | 'ignore' | 'review'
export type CleanupRecommendationAction = 'archive' | 'delete' | 'keep' | 'protected'
export type ReviewStatus = 'pending_review' | 'reviewed'
export type ActionStatus = 'none' | 'queued' | 'completed' | 'failed' | 'ignored'
export type ScanSeverity = 'low' | 'medium' | 'high' | 'critical'
export type AnalysisStatus = 'pending' | 'completed' | 'failed'

export interface ServerConnection {
  _id: string
  name: string
  host: string
  port: number
  username: string
  authType: 'password' | 'sshKey'
  email: string
  status: ServerStatus
  lastConnectedAt?: string
  lastMetricsAt?: string
  lastScanAt?: string
  connectionError?: string
  active: boolean
  scanDirectories?: string[]
  created: string
}

export interface ServerProject {
  _id: string
  server: string
  projectName: string
  portNumber: string
  projectPath: string
  dbUser: string
  databaseName: string
  dbType: string
  dbHost: string
  dbPort: string
  configFile: string
  discoveryStatus: string
  nginxFile: string
  active: boolean
  created: string
  updated: string
}

export interface ConnectServerPayload {
  name?: string
  host: string
  port: number
  username: string
  authType: 'password' | 'sshKey'
  password?: string
  privateKey?: string
  pemFile?: File | null
  passphrase?: string
  email: string
  verifyConnection?: boolean
  scanDirectories?: string[]
}

export interface MaintenanceConfig {
  _id: string
  server: string
  diskThresholdPercent: number
  cpuThresholdPercent: number
  memoryThresholdPercent: number
  scanFrequencyMinutes: number
  predictionIntervalMinutes: number
  unusedFileDays: number
  largeFileMb: number
  archiveOlderThanDays: number
  deleteOlderThanDays: number
  cleanupAutomationEnabled: boolean
  cleanupFrequencyMinutes: number
  archiveLargeFileMb: number
  archiveDirectory: string
  scanDirectories: string[]
  ignoreFolders: string[]
  tempPatterns: string[]
  logPatterns: string[]
  automationEnabled: boolean
  maxRestartAttempts?: number
  restartCooldownMinutes?: number
  slackWebhookUrl?: string
  telegramBotToken?: string
  telegramChatId?: string
  lastPredictionRunAt?: string
  cleanupRunStartedAt?: string
  cleanupRunCompletedAt?: string
  lastCleanupRunAt?: string
  rules: Array<{
    enabled: boolean
    action: 'delete' | 'archive' | 'ignore'
    category?: FileCategory
    olderThanDays?: number
    largerThanMb?: number
    targetFolder?: string
  }>
}

export interface Metric {
  _id: string
  server: string
  cpuUsagePercent: number
  memoryUsagePercent: number
  diskUsagePercent: number
  networkRxBytes: number
  networkTxBytes: number
  loadAverage: number
  cpuCores: number
  cpuModel: string
  gpuInfo: string
  runningServicesCount: number
  runningServices: string[]
  totalMemoryBytes: number
  usedMemoryBytes: number
  totalDiskBytes: number
  usedDiskBytes: number
  networkDownloadSpeed: number
  networkUploadSpeed: number
  networkTotalReceived: number
  networkTotalSent: number
  topProcesses: Array<{
    pid: string
    cpu: number
    mem: number
    name: string
    user: string
  }>
  collectedAt: string
}

export interface ScanResult {
  _id: string
  server: string
  scanId: string
  fileName: string
  path: string
  directory: string
  scanRoot: string
  size: number
  sizeMb: number
  contentHash?: string
  lastAccessed: string
  modifiedAt?: string
  category: FileCategory
  tags: FileCategory[]
  severity: ScanSeverity
  analysisStatus: AnalysisStatus
  rootCauseAnalysis?: string
  impactedServices: string[]
  impactedDirectories: string[]
  remediationSteps: string[]
  devOpsRecommendations: string[]
  aiRecommendation: {
    action: FileAction
    confidence: number
    reason: string
    decisionTrace: string[]
  }
  reviewStatus: ReviewStatus
  actionStatus: ActionStatus
  actionTaken?: FileAction
  actionReason?: string
  actionError?: string
  discoveredAt: string
}

export interface CleanupRecommendation {
  fileId: string
  scanId: string
  path: string
  fileName: string
  directory: string
  size: number
  sizeMb: number
  lastAccessed: string
  modifiedAt?: string
  category: FileCategory
  tags: FileCategory[]
  action: CleanupRecommendationAction
  reason: string
  confidence: number
  decisionTrace: string[]
  severity: LogSeverity
}

export interface CleanupRecommendationResponse {
  scanId: string
  recommendations: CleanupRecommendation[]
  summary: {
    scanId: string
    scannedFiles: number
    archive: number
    delete: number
    keep: number
    protected: number
    severityCounts: Record<LogSeverity, number>
    totalScannedSizeBytes: number
    expectedReclaimableSizeBytes: number
    scanDurationMs: number
    auditLogId?: string
  }
  audit: {
    prepared: boolean
    logId: string
    message: string
  }
}

export interface CleanupTimelineRecord {
  _id: string
  server: string
  scanId: string
  status: 'preview_ready' | 'executing' | 'completed' | 'failed'
  triggeredBy: 'manual' | 'scheduled'
  previewSummary: {
    scannedFiles: number
    severityCounts: Record<LogSeverity, number>
    actionCounts: Record<CleanupRecommendationAction, number>
    totalScannedSizeBytes: number
    expectedReclaimableSizeBytes: number
    scanDurationMs: number
  }
  executionSummary?: {
    deletedFiles: number
    archivedFiles: number
    backedUpFiles: number
    skippedFiles: number
    failedFiles: number
    reclaimedBytes: number
    executionDurationMs: number
    startedAt?: string
    completedAt?: string
  }
  startedAt: string
  completedAt?: string
}

export type DiskCleanupTriggerType = 'DAILY_CRON' | 'STORAGE_SPIKE' | 'MANUAL'
export type DiskCleanupJobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'PARTIAL_FAILED' | 'FAILED'

export interface DiskCleanupPolicy {
  _id?: string
  serverId: string
  enabled: boolean
  allowlistedPaths: string[]
  logRetentionDays: number
  tempRetentionDays: number
  warningThresholdPercent: number
  criticalThresholdPercent: number
  emergencyThresholdPercent: number
  archiveBeforeDelete: boolean
  dryRun: boolean
  maxDeleteSizePerRun: number
  cronEnabled: boolean
  cronExpression: string
  lastCronRunAt?: string
  createdAt?: string
  updatedAt?: string
}

export interface DiskCleanupCandidate {
  filePath: string
  fileSizeBytes: number
  modifiedAt: string
  fileCategory: 'LOG' | 'TEMP' | 'UNUSED'
  isAllowed: boolean
  skipReason?: string
  deleteStatus?: 'PENDING' | 'DELETED' | 'ARCHIVED' | 'SKIPPED' | 'FAILED' | 'DRY_RUN'
  archivePath?: string
}

export interface ProjectLogScope {
  domainName: string
  nginxConfigPath: string
  projectRoot: string
  logRoots: string[]
  nginxLogFiles: string[]
  allowlistedPaths: string[]
  serverNames: string[]
  rootCandidates: string[]
}

export interface ProjectLogIssue {
  filePath: string
  issueType: 'ERROR' | 'CRASH' | 'HIGH_MEMORY' | 'SUSPICIOUS'
  message: string
}

export interface ProjectLogFile {
  filePath: string
  fileSizeBytes: number
  modifiedAt: string
  source: 'PROJECT' | 'NGINX'
}

export interface DiskCleanupScanResult {
  serverId: string
  triggerType: DiskCleanupTriggerType
  dryRun: boolean
  currentDiskUsage: {
    filesystem: string
    mount: string
    totalBytes: number
    usedBytes: number
    availableBytes: number
    usagePercent: number
  }
  reclaimableStorageBytes: number
  reclaimableStorageMB: number
  reclaimableStorageGB: number
  candidates: DiskCleanupCandidate[]
  filesScanned: number
  projectScope?: ProjectLogScope
  issues?: ProjectLogIssue[]
  projectLogFiles?: ProjectLogFile[]
}

export interface DiskCleanupJob {
  _id?: string
  serverId: string
  jobId: string
  triggerType: DiskCleanupTriggerType
  status: DiskCleanupJobStatus
  storageBeforeCleanupBytes: number
  storageAfterCleanupBytes: number
  storageReducedBytes: number
  storageReducedMB: number
  storageReducedGB: number
  diskUsagePercentBefore: number
  diskUsagePercentAfter: number
  diskUsagePercentReduced: number
  filesScanned: number
  filesDeleted: number
  filesSkipped: number
  failedFiles: number
  archivedFiles: number
  bytesFreed: number
  cleanupStartedAt?: string
  cleanupCompletedAt?: string
  errorMessage?: string
  createdAt?: string
  updatedAt?: string
}

export interface DiskCleanupHistory {
  _id?: string
  serverId: string
  jobId: string
  filePath: string
  action: 'PENDING' | 'DELETED' | 'ARCHIVED' | 'SKIPPED' | 'FAILED' | 'DRY_RUN'
  fileSizeBytes: number
  archivePath?: string
  message?: string
  createdAt: string
}

export interface Alert {
  _id: string
  server: string
  type: string
  severity: 'info' | 'warning' | 'critical' | 'success'
  title: string
  message: string
  read: boolean
  created: string
}

export interface MaintenanceLog {
  _id: string
  server: string
  action: string
  status: 'success' | 'failed' | 'skipped' | 'preview'
  reason: string
  aiDecisionTrace: string[]
  metadata: Record<string, unknown>
  created: string
  name: string
  host: string
  port: number
  username: string
}

export type LogSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'SECURITY'
export type SupportedLogSource =
  | 'syslog'
  | 'auth'
  | 'nginx'
  | 'apache'
  | 'application'
  | 'docker'
  | 'kernel'
  | 'journald'

export interface ProcessedLog {
  _id: string
  server: string
  serverId?: string
  source: SupportedLogSource
  logType?: string
  severity: LogSeverity
  rawMessage: string
  rawLine?: string
  normalizedPattern: string
  displayMessage: string
  message?: string
  normalizedMessage?: string
  timestamp: string
  service?: string
  serviceName?: string
  host?: string
  pid?: string
  processId?: string
  actor?: string
  ipAddress?: string
  filePath?: string
  category: string
  tags: string[]
  parsedFields?: Record<string, unknown>
  confidence: number
  rootCauseSuggestion?: string
  probableRootCause?: string
  relatedMetricsLink?: string
  fingerprint: string
  processedAt: string
  createdAt?: string
}

export interface IncidentPattern {
  _id: string
  server: string
  fingerprint: string
  severity: LogSeverity
  source: SupportedLogSource
  title: string
  summary: string
  firstSeenAt: string
  lastSeenAt: string
  occurrenceCount: number
  affectedServices: string[]
  sampleMessages: string[]
  rootCauseSuggestions: string[]
  status: 'open' | 'monitoring' | 'resolved'
  updatedAt: string
  createdAt: string
}

export interface LogCleanupRecommendationHistory {
  _id: string
  server: string
  action: 'archive_recommended' | 'delete_recommended' | 'policy_evaluated'
  status: 'recommended' | 'skipped' | 'failed'
  source?: SupportedLogSource
  target?: string
  reason: string
  retentionDays: number
  recommendedAt: string
  auditTrail: string[]
  metadata: Record<string, unknown>
}

export interface LogRootCauseSuggestion {
  patternId: string
  title: string
  severity: LogSeverity
  suggestions: string[]
}

export interface LogsIntelligence {
  severityCounts: Record<LogSeverity, number>
  sourceCounts: Array<{ source: SupportedLogSource; count: number }>
  recentLogs: ProcessedLog[]
  incidents: IncidentPattern[]
  cleanupRecommendations: LogCleanupRecommendationHistory[]
  rootCauseSuggestions: LogRootCauseSuggestion[]
}

export type LogTimeRange = '30m' | '1h' | '4h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom'

export interface LogsQueryParams {
  serverId?: string
  timeRange?: LogTimeRange
  startTime?: string
  endTime?: string
  severity?: LogSeverity[]
  source?: SupportedLogSource[]
  logType?: string
  serviceName?: string
  keyword?: string
  errorSecurityOnly?: boolean
  limit?: number
  page?: number
  sort?: 'asc' | 'desc'
}

export interface LogsQueryResponse {
  logs: ProcessedLog[]
  total: number
  page: number
  limit: number
  startTime: string
  endTime: string
  summary: {
    infoCount: number
    warnCount: number
    errorCount: number
    criticalCount: number
    securityCount: number
    topServices: Array<{ serviceName: string; count: number }>
    topErrors: Array<{ pattern: string; message: string; count: number }>
    countOverTime: Array<{ timestamp: string; count: number }>
    securityEvents: number
    recentCriticalLogs: ProcessedLog[]
    incidentTimeline: IncidentPattern[]
  }
}

export type FileRiskLevel = 'safe' | 'low' | 'medium' | 'high' | 'critical'
export type FileScanStatus = 'pending' | 'scanning' | 'completed' | 'failed' | 'skipped' | 'marked_safe'
export type ThreatFileCategory =
  | 'source_code'
  | 'shell_script'
  | 'node_script'
  | 'python_script'
  | 'php_script'
  | 'config_file'
  | 'env_file'
  | 'credential_file'
  | 'private_key_file'
  | 'log_file'
  | 'html_file'
  | 'json_file'
  | 'yaml_file'
  | 'docker_file'
  | 'nginx_config'
  | 'apache_config'
  | 'systemd_service'
  | 'cron_file'
  | 'database_dump'
  | 'archive_file'
  | 'binary_file'
  | 'unknown'

export interface FileScanResult {
  _id: string
  server: string
  filePath: string
  fileName: string
  extension?: string
  detectedFileType?: string
  fileCategory: ThreatFileCategory
  typeConfidence: number
  typeSignals: string[]
  mimeType?: string
  fileSize: number
  fileHash?: string
  modifiedAt?: string
  permissions?: string
  owner?: string
  eventType: 'created' | 'modified'
  scanStatus: FileScanStatus
  riskLevel: FileRiskLevel
  riskScore: number
  riskReasons: string[]
  detectedPatterns: string[]
  harmfulBehaviors: string[]
  recommendedAction: 'allow' | 'review' | 'quarantine' | 'delete'
  aiExplanation: string
  backupStatus: string
  backupPath?: string
  compressedBackupPath?: string
  backupHash?: string
  quarantineStatus: string
  quarantinePath?: string
  actionStatus: string
  actionError?: string
  createdAt: string
  updatedAt: string
}

export interface FileScanEvent {
  _id: string
  server: string
  filePath: string
  fileName: string
  eventType: 'created' | 'modified'
  fileHash?: string
  modifiedAt?: string
  scanStatus: FileScanStatus
  createdAt: string
}

export interface QuarantinedFile {
  _id: string
  server: string
  scanResult: string
  originalPath: string
  quarantinePath: string
  backupPath: string
  riskLevel: FileRiskLevel
  status: 'quarantined' | 'restored' | 'deleted' | 'failed'
  createdAt: string
}

export interface FileScannerQuery {
  serverId?: string
  riskLevel?: FileRiskLevel
  scanStatus?: FileScanStatus
  timeRange?: LogTimeRange
  page?: number
  limit?: number
}

export interface FileScannerStatus {
  enabled: boolean
  mode: string
  serverId?: string
  watchedRoots: string[]
  excludedPaths: string[]
  maxFileSizeMb: number
  compressedBackup: boolean
  backupPath: string
  quarantinePath: string
  actionOnHarmful: string
  deleteAfterBackup: boolean
  debounceMs: number
  maxConcurrentScans: number
  maxFilesPerSweep: number
  sshCooldownActive: boolean
  note: string
}

export interface FileScannerAlert {
  _id: string
  server: string
  scanResult?: string
  filePath: string
  riskLevel: FileRiskLevel
  riskScore: number
  message: string
  actionTaken: string
  metadata?: Record<string, unknown>
  read: boolean
  createdAt: string
}

export interface ServerLogsPayload {
  server: string
  action: string
  status: 'success' | 'failed' | 'skipped' | 'preview'
  reason: string
  aiDecisionTrace: string[]
  metadata: Record<string, unknown>
}

export interface MaintenanceReport {
  generatedAt: string
  window: {
    start: string
    end: string
  }
  storageUsage: {
    avgDiskPercent: number
    maxDiskPercent: number
  }
  computeUsage: {
    avgCpuPercent: number
    avgMemoryPercent: number
  }
  files: {
    scanned: number
    cleaned: number
    storageCleanedMb: number
    byCategory: Record<string, number>
  }
  actionsTaken: Record<string, number>
  recentActions: MaintenanceLog[]
}
export interface PredictionEvidence {
  source: string
  title: string
  detail: string
  severity?: string
  timestamp?: string
  metadata?: Record<string, any>
}

export interface Anomaly {
  _id?: string
  type: string
  title: string
  component: string
  severity: 'low' | 'warning' | 'medium' | 'high' | 'critical'
  value: number
  baseline: number
  threshold: number
  confidence: number
  detector: string
  evidence: string[]
  metadata?: Record<string, any>
  detectedAt?: string
}

export interface PredictiveIssue {
  issue: string
  predictedFailure: string
  recommendation: string
  rootCauseAnalysis?: string
  severity: 'low' | 'warning' | 'medium' | 'high' | 'critical'
  confidence: number
  horizonMinutes: number
  evidence: Array<string | PredictionEvidence>
  recommendedActions: string[]
  affectedComponents?: string[]
  impactedServices?: string[]
  impactedDirectories?: string[]
}

export interface Prediction {
  _id: string
  server: string
  serverName: string
  healthScore: number
  predictions: PredictiveIssue[]
  metricsSummary: Partial<Metric>
  trendAnalysis: any
  feedback: Array<{
    rating: number
    comment?: string
    created: string
  }>
  aiGeneratedResponse: boolean
  timeWindow: {
    start: string
    end: string
    minutes: number
  }
  created: string
  updated: string
}
export interface RemediationStep {
  name: string
  command?: string
  toolName?: string
  toolArgs?: Record<string, any>
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  output?: string
  error?: string
  startedAt?: string
  completedAt?: string
}

export interface RemediationJob {
  _id: string
  server: string
  type: 'restart_service' | 'kill_process' | 'clear_cache' | 'rollback' | 'delete_file' | 'archive_file' | 'custom_command' | 'agent_plan'
  target: string
  description: string
  status: 'planned' | 'pending_approval' | 'queued' | 'running' | 'completed' | 'partially_completed' | 'failed' | 'skipped' | 'rolled_back' | 'cancelled'
  planningMode?: 'static' | 'agent'
  planner?: string
  intent?: string
  planningContext?: Record<string, any>
  reasoningSummary?: string
  decisionTrace?: string[]
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
  requiresApproval?: boolean
  incident?: string
  prediction?: string
  steps: RemediationStep[]
  rollbackSteps: RemediationStep[]
  progressPercent?: number
  currentStep?: string
  lastProgressAt?: string
  preFlightCheck?: {
    status: 'passed' | 'failed'
    results: any
    timestamp: string
  }
  postFlightCheck?: {
    status: 'passed' | 'failed'
    results: any
    timestamp: string
  }
  executionSummary?: {
    scannedFiles?: number
    candidatesFound?: number
    filesDeleted?: number
    filesArchived?: number
    filesIgnored?: number
    failedActions?: number
    skippedActions?: number
    spaceReclaimedMb?: number
    optimizationActions?: number
    optimizationRecoveredMb?: number
    noSafeFixApplied?: boolean
    noSafeFixReason?: string
    beforeMetrics?: Record<string, any>
    afterMetrics?: Record<string, any>
    beforePrediction?: Record<string, any>
    afterPrediction?: Record<string, any>
    verification?: Record<string, any>
    remainingIssues?: number
    scanId?: string
    details?: Array<Record<string, any>>
    errors?: Array<Record<string, any>>
  }
  priority: 'low' | 'medium' | 'high' | 'critical'
  retryCount?: number
  maxRetries?: number
  lastError?: string
  plannedBy?: string
  approvedBy?: string
  approvedAt?: string
  created: string
  updated: string
  startedAt?: string
  completedAt?: string
}

export interface MonitoringFilesystem {
  mount: string
  filesystem: string
  usedBytes: number
  totalBytes: number
  usagePercent: number
}

export interface MonitoringProcess {
  pid: string
  ppid?: string
  state: string
  cpuPercent: number
  memoryPercent: number
  name: string
}

export interface MonitoringMetricHistory {
  _id: string
  server: string
  os: {
    id: string
    name: string
    version?: string
    kernel?: string
    hostname?: string
    systemdAvailable: boolean
    journaldAvailable: boolean
  }
  cpuUsagePercent: number
  cpuDeltaPercent?: number
  trend?: 'up' | 'down' | 'stable'
  isSpike?: boolean
  spikeSeverity?: 'low' | 'medium' | 'high'
  probableReason?: string
  cpuCoreCount?: number
  loadAverage: number
  memoryUsagePercent: number
  memoryUsedBytes?: number
  memoryFreeBytes?: number
  memoryCachedBytes?: number
  swapUsagePercent: number
  diskUsagePercent: number
  diskReadBytesPerSecond: number
  diskWriteBytesPerSecond: number
  filesystemGrowthBytesPerMinute: number
  networkRxBytesPerSecond: number
  networkTxBytesPerSecond: number
  networkErrors?: number
  networkDroppedPackets?: number
  serviceSummary: {
    running: number
    failed: number
    inactive: number
    failedServices: string[]
    runningServices?: string[]
    inactiveServices?: string[]
    serviceIssues?: Array<{
      service: string
      manager: 'systemd' | 'pm2' | 'docker'
      status: 'failed' | 'inactive' | 'stopped' | 'exited' | 'unhealthy' | 'unknown'
      reason: string
    }>
  }
  processSummary: {
    total: number
    zombies: number
    blocked: number
    topCpu: MonitoringProcess[]
  }
  sshSessionActivity: {
    loggedInUsers: number
    establishedSessions: number
    recentAuthWarnings: number
  }
  filesystems: MonitoringFilesystem[]
  collectedAt: string
  pollIntervalMs: number
}

export interface SelfHealingStats {
  uptime: string
  restartCount: number
  lastCrashTimestamp: string | null
  recoveryStatus: 'idle' | 'running' | 'completed' | 'failed'
  activeIncidents: number
  healthCheckResults?: {
    status: 'passed' | 'failed'
    timestamp: string
  }
  stabilityIndicator: 'stable' | 'warning' | 'unstable'
  serverName?: string
  serverHost?: string
  recentRecoveryActions: RemediationJob[]
}

export interface CpuMetricPoint {
  timestamp: string
  cpuUsagePercent: number
  cpuDeltaPercent?: number
  trend?: 'up' | 'down' | 'stable'
  isSpike?: boolean
  spikeSeverity?: 'low' | 'medium' | 'high'
  probableReason?: string
  topProcesses?: MonitoringProcess[]
  runningProcessCount?: number
  memoryUsagePercent?: number
  loadAverage?: number
  diskReadBytesPerSecond?: number
  diskWriteBytesPerSecond?: number
  networkRxBytesPerSecond?: number
  networkTxBytesPerSecond?: number
  min?: number
  max?: number
  sampleCount?: number
}

export type MetricNamespace =
  | 'System'
  | 'CPU'
  | 'Memory'
  | 'Disk'
  | 'Network'
  | 'Process'
  | 'Application'
  | 'Security'
  | 'Docker'
export type MetricAggregation = 'avg' | 'min' | 'max' | 'sum' | 'count'
export type MetricTimeRange = '30m' | '1h' | '4h' | '12h' | '24h' | '48h' | '7d' | '30d' | 'custom'
export type MetricGranularity = 'auto' | '1m' | '5m' | '15m' | '1h' | '1d'

export interface MetricDefinition {
  namespace: MetricNamespace
  metricName: string
  label: string
  unit: string
  description: string
}

export interface MetricDefinitionsResponse {
  namespaces: MetricNamespace[]
  metrics: MetricDefinition[]
}

export interface MetricSeriesPoint {
  timestamp: string
  value: number
}

export interface MetricQueryParams {
  serverId: string
  namespace?: MetricNamespace
  metricName: string
  aggregation?: MetricAggregation
  timeRange?: MetricTimeRange
  startTime?: string
  endTime?: string
  granularity?: MetricGranularity
  dimensions?: string
}

export interface MetricQueryResponse {
  metricName: string
  unit: string
  aggregation: MetricAggregation
  granularity: Exclude<MetricGranularity, 'auto'>
  startTime: string
  endTime: string
  points: MetricSeriesPoint[]
  summary: {
    min: number
    max: number
    avg: number
    latest: number | null
    count: number
  }
}

export interface MonitoringStatus {
  lightweightMonitoringEnabled: boolean
  backgroundMonitorRunning: boolean
  coreOnly: boolean
  coreMonitoringEnabled: boolean
  deepScanEnabled: boolean
  collectors: {
    processScanEnabled: boolean
    serviceScanEnabled: boolean
    authScanEnabled: boolean
    networkScanEnabled: boolean
  }
  pollingInterval: number
  lastSampleAt: string | null
  impact: {
    lastCollectorDurationMs: number
    commandsExecutedLastMinute: number
    recentCollectors: Array<{
      collector: string
      commandName: string
      durationMs: number
      enabled: boolean
      skippedReason?: string
      impact: string
      collectedAt: string
    }>
  }
  selfHealing?: SelfHealingStats
}

export interface MonitoringHealthScore {
  _id: string
  server: string
  score: number
  status: 'healthy' | 'watch' | 'degraded' | 'critical'
  reasons: string[]
  components: {
    cpu: number
    memory: number
    disk: number
    services: number
    process: number
    network: number
    ssh: number
  }
  calculatedAt: string
}

export interface MonitoringResourceSpike {
  _id: string
  server: string
  metric: string
  severity: 'info' | 'warning' | 'critical'
  value: number
  baseline: number
  threshold: number
  message: string
  metadata?: Record<string, unknown>
  detectedAt: string
}
