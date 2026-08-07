import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type {
  RcmCommandCenterInsight,
  RcmCommandCenterClaimReadinessRow,
  RcmCommandCenterMetric,
  RcmCommandCenterQueueItem,
  RcmCommandCenterSnapshot,
  RcmCommandCenterStage,
  RcmUnifiedWorkQueueItem,
  RcmRecentClaimActivity,
  RcmInsightSeverity,
  RcmMetricTone,
  RcmQueuePriority,
  RcmWorkflowStageKey,
} from '@/types/rcmCommandCenter'

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

function normalizeMetricTone(value: unknown): RcmMetricTone {
  return value === 'critical' || value === 'warning' || value === 'neutral' || value === 'positive'
    ? value
    : 'neutral'
}

function normalizeInsightSeverity(value: unknown): RcmInsightSeverity {
  return value === 'critical' || value === 'warning' || value === 'info' ? value : 'info'
}

function normalizeQueuePriority(value: unknown): RcmQueuePriority {
  return value === 'critical' || value === 'high' || value === 'medium' || value === 'low'
    ? value
    : 'medium'
}

function normalizeLifecycleStatus(value: unknown): RcmCommandCenterClaimReadinessRow['lifecycleStatus'] {
  return value === 'SUBMITTED' ||
    value === 'PENDING' ||
    value === 'ACCEPTED' ||
    value === 'REJECTED' ||
    value === 'FAILED'
    ? value
    : 'PENDING'
}

function normalizeActivityStatus(value: unknown): RcmRecentClaimActivity['status'] {
  return value === 'DRAFT' ||
    value === 'READY' ||
    value === 'SUBMITTED' ||
    value === 'PENDING' ||
    value === 'ACCEPTED' ||
    value === 'REJECTED' ||
    value === 'FAILED'
    ? value
    : 'PENDING'
}

function normalizeWorkflowStageKey(value: unknown): RcmWorkflowStageKey {
  return value === 'patientAccess' ||
    value === 'authorization' ||
    value === 'coding' ||
    value === 'claims' ||
    value === 'claimSubmission' ||
    value === 'claimTracking' ||
    value === 'denials' ||
    value === 'ar' ||
    value === 'patientBalance'
    ? value
    : 'patientAccess'
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : []
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function normalizeQueueItem(value: unknown): RcmCommandCenterQueueItem | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeString(value.id)
  const entityId = normalizeString(value.entityId)
  const title = normalizeString(value.title)
  const status = normalizeString(value.status)
  const summary = normalizeString(value.summary)
  const nextBestAction = normalizeString(value.nextBestAction)
  const route = normalizeString(value.route)

  if (!id || !entityId || !title || !status || !summary || !nextBestAction || !route) {
    return null
  }

  return {
    id,
    entityType: normalizeString(value.entityType),
    entityId,
    title,
    subtitle: normalizeString(value.subtitle) || undefined,
    status,
    priority: normalizeQueuePriority(value.priority),
    summary,
    nextBestAction,
    aiBriefing: normalizeString(value.aiBriefing) || undefined,
    route,
    dueAt: normalizeString(value.dueAt) || undefined,
    badges: normalizeStringArray(value.badges),
  }
}

function normalizeStage(value: unknown): RcmCommandCenterStage | null {
  if (!isRecord(value)) {
    return null
  }

  const label = normalizeString(value.label)
  const description = normalizeString(value.description)
  const route = normalizeString(value.route)

  if (!label || !description || !route) {
    return null
  }

  return {
    key: normalizeWorkflowStageKey(value.key),
    label,
    description,
    count: normalizeNumber(value.count),
    criticalCount: normalizeNumber(value.criticalCount),
    route,
    items: Array.isArray(value.items)
      ? value.items
          .map((item) => normalizeQueueItem(item))
          .filter((item): item is RcmCommandCenterQueueItem => item !== null)
      : [],
  }
}

function normalizeUnifiedWorkQueueItem(value: unknown): RcmUnifiedWorkQueueItem | null {
  if (!isRecord(value)) {
    return null
  }

  const entityId = normalizeString(value.entityId)
  const nextAction = normalizeString(value.nextAction)
  const route = normalizeString(value.route)
  const title = normalizeString(value.title)
  const status = normalizeString(value.status)

  if (!entityId || !nextAction || !route || !title || !status) {
    return null
  }

  return {
    type: normalizeString(value.type),
    owner: normalizeString(value.owner) || undefined,
    priority: normalizeQueuePriority(value.priority),
    dueDate: normalizeString(value.dueDate) || undefined,
    aging: normalizeString(value.aging) || undefined,
    amountAtRisk: typeof value.amountAtRisk === 'number' ? value.amountAtRisk : undefined,
    nextAction,
    route,
    sourceStage: normalizeWorkflowStageKey(value.sourceStage),
    entityId,
    title,
    status,
    details: isRecord((value as Record<string, unknown>).details) ? (value as Record<string, unknown>).details : undefined,
  }
}

function normalizeMetric(value: unknown): RcmCommandCenterMetric | null {
  if (!isRecord(value)) {
    return null
  }

  const key = normalizeString(value.key)
  const label = normalizeString(value.label)
  const helperText = normalizeString(value.helperText)

  if (!key || !label || !helperText) {
    return null
  }

  return {
    key,
    label,
    value: normalizeNumber(value.value),
    format: value.format === 'currency' ? 'currency' : 'count',
    tone: normalizeMetricTone(value.tone),
    helperText,
    route: normalizeString(value.route) || undefined,
  }
}

function normalizeClaimReadinessRow(value: unknown): RcmCommandCenterClaimReadinessRow | null {
  if (!isRecord(value)) {
    return null
  }

  const claimId = normalizeString(value.claimId)
  const displayClaimId = normalizeString(value.displayClaimId)
  const patient = normalizeString(value.patient)
  const status = normalizeString(value.status)
  const route = normalizeString(value.route)

  if (!claimId || !displayClaimId || !patient || !status || !route) {
    return null
  }

  return {
    claimId,
    displayClaimId,
    patient,
    payerId: normalizeString(value.payerId) || undefined,
    facility: normalizeString(value.facility) || undefined,
    state: normalizeString(value.state) || undefined,
    claimStatus: normalizeString(value.claimStatus),
    submissionStatus: normalizeString(value.submissionStatus),
    lifecycleStatus: normalizeLifecycleStatus(value.lifecycleStatus),
    status,
    canSubmit: value.canSubmit === true,
    blockingReasons: normalizeStringArray(value.blockingReasons),
    blockerTypes: normalizeStringArray(value.blockerTypes),
    route,
    totalBilledAmount: normalizeNumber(value.totalBilledAmount),
    totalExpectedAllowedAmount: normalizeNumber(value.totalExpectedAllowedAmount),
    claimAgeDays: normalizeNumber(value.claimAgeDays),
  }
}

function normalizeInsight(value: unknown): RcmCommandCenterInsight | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeString(value.id)
  const title = normalizeString(value.title)
  const summary = normalizeString(value.summary)
  const route = normalizeString(value.route)
  const actionLabel = normalizeString(value.actionLabel)

  if (!id || !title || !summary || !route || !actionLabel) {
    return null
  }

  return {
    id,
    title,
    summary,
    severity: normalizeInsightSeverity(value.severity),
    route,
    actionLabel,
  }
}

function normalizeRecentClaimActivity(value: unknown): RcmRecentClaimActivity | null {
  if (!isRecord(value)) {
    return null
  }

  const id = normalizeString(value.id)
  const claimId = normalizeString(value.claimId)
  const displayClaimId = normalizeString(value.displayClaimId)
  const claimNumber = normalizeString(value.claimNumber)
  const eventType = normalizeString(value.eventType)
  const summary = normalizeString(value.summary)
  const occurredAt = normalizeString(value.occurredAt)
  const route = normalizeString(value.route)

  if (!id || !claimId || !displayClaimId || !claimNumber || !eventType || !summary || !occurredAt || !route) {
    return null
  }

  return {
    id,
    claimId,
    displayClaimId,
    claimNumber,
    payer: normalizeString(value.payer) || undefined,
    status: normalizeActivityStatus(value.status),
    eventType,
    source: value.source === 'SIMULATED' ? 'SIMULATED' : 'REAL',
    summary,
    occurredAt,
    route,
  }
}

function normalizeSnapshot(value: unknown): RcmCommandCenterSnapshot {
  if (!isRecord(value)) {
    throw new Error('Command center response is invalid.')
  }

  const generatedAt = normalizeString(value.generatedAt)

  if (!generatedAt) {
    throw new Error('Command center response is invalid.')
  }

  return {
    generatedAt,
    refreshIntervalSeconds: normalizeNumber(value.refreshIntervalSeconds) || 15,
    metrics: Array.isArray(value.metrics)
      ? value.metrics
          .map((item) => normalizeMetric(item))
          .filter((item): item is RcmCommandCenterMetric => item !== null)
      : [],
    workflowStages: Array.isArray(value.workflowStages)
      ? value.workflowStages
          .map((item) => normalizeStage(item))
          .filter((item): item is RcmCommandCenterStage => item !== null)
      : [],
    unifiedWorkQueue: Array.isArray(value.unifiedWorkQueue)
      ? value.unifiedWorkQueue
          .map((item) => normalizeUnifiedWorkQueueItem(item))
          .filter((item): item is RcmUnifiedWorkQueueItem => item !== null)
      : [],
    aiInsights: Array.isArray(value.aiInsights)
      ? value.aiInsights
          .map((item) => normalizeInsight(item))
          .filter((item): item is RcmCommandCenterInsight => item !== null)
      : [],
    claimReadiness: Array.isArray(value.claimReadiness)
      ? value.claimReadiness
          .map((item) => normalizeClaimReadinessRow(item))
          .filter((item): item is RcmCommandCenterClaimReadinessRow => item !== null)
      : [],
    recentClaimActivity: Array.isArray(value.recentClaimActivity)
      ? value.recentClaimActivity
          .map((item) => normalizeRecentClaimActivity(item))
          .filter((item): item is RcmRecentClaimActivity => item !== null)
      : [],
  }
}

export const rcmCommandCenterApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRcmCommandCenter: builder.query<RcmCommandCenterSnapshot, void>({
      query: () => ({
        url: '/rcm/command-center',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        normalizeSnapshot(readResponsePath<unknown>(response, 'data')),
    }),
  }),
})

export const { useGetRcmCommandCenterQuery } = rcmCommandCenterApi
