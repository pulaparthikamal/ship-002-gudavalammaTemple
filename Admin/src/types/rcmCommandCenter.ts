export type RcmMetricTone = 'critical' | 'warning' | 'neutral' | 'positive'
export type RcmInsightSeverity = 'critical' | 'warning' | 'info'
export type RcmQueuePriority = 'critical' | 'high' | 'medium' | 'low'
export type RcmWorkflowStageKey =
  | 'patientAccess'
  | 'authorization'
  | 'coding'
  | 'claims'
  | 'claimSubmission'
  | 'claimTracking'
  | 'denials'
  | 'ar'
  | 'patientBalance'

export interface RcmCommandCenterMetric {
  key: string
  label: string
  value: number
  format: 'count' | 'currency'
  tone: RcmMetricTone
  helperText: string
  route?: string
}

export interface RcmCommandCenterQueueItem {
  id: string
  entityType: string
  entityId: string
  title: string
  subtitle?: string
  status: string
  priority: RcmQueuePriority
  summary: string
  nextBestAction: string
  aiBriefing?: string
  route: string
  dueAt?: string
  badges: string[]
}

export interface RcmUnifiedWorkQueueItem {
  type: string
  owner?: string
  priority: RcmQueuePriority
  dueDate?: string
  aging?: string
  amountAtRisk?: number
  nextAction: string
  route: string
  sourceStage: RcmWorkflowStageKey
  entityId: string
  title: string
  status: string
  details?: unknown
}

export interface RcmCommandCenterStage {
  key: RcmWorkflowStageKey
  label: string
  description: string
  count: number
  criticalCount: number
  route: string
  items: RcmCommandCenterQueueItem[]
}

export interface RcmCommandCenterInsight {
  id: string
  title: string
  summary: string
  severity: RcmInsightSeverity
  route: string
  actionLabel: string
}

export interface RcmCommandCenterClaimReadinessRow {
  claimId: string
  displayClaimId: string
  patient: string
  payerId?: string
  facility?: string
  state?: string
  claimStatus: string
  submissionStatus: string
  lifecycleStatus: 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  status: string
  canSubmit: boolean
  blockingReasons: string[]
  blockerTypes: string[]
  route: string
  totalBilledAmount: number
  totalExpectedAllowedAmount: number
  claimAgeDays: number
}

export interface RcmRecentClaimActivity {
  id: string
  claimId: string
  displayClaimId: string
  claimNumber: string
  payer?: string
  status: 'DRAFT' | 'READY' | 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  eventType: string
  source: 'REAL' | 'SIMULATED'
  summary: string
  occurredAt: string
  route: string
}

export interface RcmCommandCenterSnapshot {
  generatedAt: string
  refreshIntervalSeconds: number
  metrics: RcmCommandCenterMetric[]
  workflowStages: RcmCommandCenterStage[]
  unifiedWorkQueue: RcmUnifiedWorkQueueItem[]
  aiInsights: RcmCommandCenterInsight[]
  claimReadiness: RcmCommandCenterClaimReadinessRow[]
  recentClaimActivity: RcmRecentClaimActivity[]
}
