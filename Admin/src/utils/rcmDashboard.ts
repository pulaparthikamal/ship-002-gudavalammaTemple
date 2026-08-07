import type { CrudListQuery } from '@/types/crud'
import type {
  RcmCommandCenterInsight,
  RcmCommandCenterMetric,
  RcmCommandCenterQueueItem,
  RcmCommandCenterStage,
  RcmWorkflowStageKey,
} from '@/types/rcmCommandCenter'

export type RcmDashboardFilterKey =
  | 'patientAccess'
  | 'authorization'
  | 'coding'
  | 'claims'
  | 'claimSubmission'
  | 'claimTracking'
  | 'denials'
  | 'ar'
  | 'patientBalance'

export interface RcmDashboardQueryContext {
  dashboardFilter?: RcmDashboardFilterKey
  dashboardEntityId?: string
}

const routeByFilterKey: Record<RcmDashboardFilterKey, string> = {
  patientAccess: '/rcm/insurance-policies',
  authorization: '/rcm/prior-authorizations',
  coding: '/rcm/charges',
  claims: '/rcm/claims',
  claimSubmission: '/rcm/claim-submissions',
  claimTracking: '/rcm/claim-trackings',
  denials: '/rcm/denials',
  ar: '/rcm/ar-work-items',
  patientBalance: '/rcm/patient-billings',
}

const routeToFilterKeyMap: Record<string, RcmDashboardFilterKey> = {
  '/rcm/insurance-policies': 'patientAccess',
  '/rcm/prior-authorizations': 'authorization',
  '/rcm/charges': 'coding',
  '/rcm/claims': 'claims',
  '/rcm/claim-submissions': 'claimSubmission',
  '/rcm/claim-trackings': 'claimTracking',
  '/rcm/denials': 'denials',
  '/rcm/ar-work-items': 'ar',
  '/rcm/patient-billings': 'patientBalance',
  '/rcm/collections': 'patientBalance',
}

const entityTypeToFilterKeyMap: Record<string, RcmDashboardFilterKey> = {
  'insurance-policy': 'patientAccess',
  'prior-authorization': 'authorization',
  charge: 'coding',
  claim: 'claims',
  'claim-submission': 'claimSubmission',
  'claim-tracking': 'claimTracking',
  denial: 'denials',
  appeal: 'denials',
  'ar-work-item': 'ar',
  'patient-billing': 'patientBalance',
  collection: 'patientBalance',
}

const preSubmissionMetricKeyMap: Record<string, RcmDashboardFilterKey> = {
  'patient-access': 'patientAccess',
  authorization: 'authorization',
  coding: 'coding',
  claims: 'claims',
  'claim-submission': 'claimSubmission',
}

function normalizeFilterKey(value: string | null): RcmDashboardFilterKey | undefined {
  switch (value) {
    case 'patientAccess':
    case 'authorization':
    case 'coding':
    case 'claims':
    case 'claimSubmission':
    case 'claimTracking':
    case 'denials':
    case 'ar':
    case 'patientBalance':
      return value
    default:
      return undefined
  }
}

function normalizeId(value: string | null) {
  const nextValue = value?.trim()
  return nextValue ? nextValue : undefined
}

export function readDashboardQueryContext(searchParams: URLSearchParams): RcmDashboardQueryContext {
  return {
    dashboardFilter: normalizeFilterKey(searchParams.get('dashboardFilter')),
    dashboardEntityId: normalizeId(searchParams.get('dashboardEntityId')),
  }
}

export function applyDashboardQueryContext<TQuery extends CrudListQuery>(
  query: TQuery,
  context: RcmDashboardQueryContext,
): TQuery {
  return {
    ...query,
    ...(context.dashboardFilter ? { dashboardFilter: context.dashboardFilter } : {}),
    ...(context.dashboardEntityId ? { dashboardEntityId: context.dashboardEntityId } : {}),
  }
}

export function buildDashboardSearch(context: RcmDashboardQueryContext) {
  const searchParams = new URLSearchParams()

  if (context.dashboardFilter) {
    searchParams.set('dashboardFilter', context.dashboardFilter)
  }

  if (context.dashboardEntityId) {
    searchParams.set('dashboardEntityId', context.dashboardEntityId)
  }

  const serializedSearch = searchParams.toString()
  return serializedSearch ? `?${serializedSearch}` : ''
}

export function getDashboardBaseRoute(filterKey: RcmDashboardFilterKey) {
  return routeByFilterKey[filterKey]
}

export function getDashboardFilterKeyForStage(
  stageKey: RcmWorkflowStageKey,
): RcmDashboardFilterKey | undefined {
  switch (stageKey) {
    case 'patientAccess':
      return 'patientAccess'
    case 'authorization':
      return 'authorization'
    case 'coding':
      return 'coding'
    case 'claims':
      return 'claims'
    case 'claimSubmission':
      return 'claimSubmission'
    case 'claimTracking':
      return 'claimTracking'
    case 'denials':
      return 'denials'
    case 'ar':
      return 'ar'
    case 'patientBalance':
      return 'patientBalance'
    default:
      return undefined
  }
}

export function buildDashboardMetricRoute(metric: Pick<RcmCommandCenterMetric, 'key'>) {
  const filterKey = preSubmissionMetricKeyMap[metric.key]

  if (!filterKey) {
    return undefined
  }

  return `${getDashboardBaseRoute(filterKey)}${buildDashboardSearch({ dashboardFilter: filterKey })}`
}

export function buildDashboardStageRoute(stage: Pick<RcmCommandCenterStage, 'key' | 'route'>) {
  const filterKey = getDashboardFilterKeyForStage(stage.key)

  if (!filterKey) {
    return stage.route
  }

  return `${getDashboardBaseRoute(filterKey)}${buildDashboardSearch({ dashboardFilter: filterKey })}`
}

export function buildDashboardQueueItemRoute(
  item: Pick<RcmCommandCenterQueueItem, 'entityType' | 'entityId' | 'route'>,
) {
  const filterKey = entityTypeToFilterKeyMap[item.entityType]

  if (!filterKey) {
    return item.route
  }

  return `${getDashboardBaseRoute(filterKey)}${buildDashboardSearch({
    dashboardFilter: filterKey,
    dashboardEntityId: item.entityId,
  })}`
}

export function buildDashboardInsightRoute(
  insight: Pick<RcmCommandCenterInsight, 'route'>,
) {
  const filterKey = routeToFilterKeyMap[insight.route]

  if (!filterKey) {
    return insight.route
  }

  return `${getDashboardBaseRoute(filterKey)}${buildDashboardSearch({ dashboardFilter: filterKey })}`
}
