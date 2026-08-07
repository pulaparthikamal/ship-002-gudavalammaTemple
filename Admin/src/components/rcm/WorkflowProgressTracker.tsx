import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { cn } from '@/utils/classNames'
import { buildWorkflowCriteria, buildWorkflowRuntimeStages, buildWorkflowSearch, mergeWorkflowContext } from '@/utils/rcmWorkflow'
import { useGetAppealsQuery } from '@/services/api/endpoints/appealsApi'
import { useGetArWorkItemsQuery } from '@/services/api/endpoints/arWorkItemsApi'
import { useGetChargesQuery } from '@/services/api/endpoints/chargesApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useGetClaimSubmissionsQuery } from '@/services/api/endpoints/claimSubmissionsApi'
import { useGetClaimTrackingsQuery } from '@/services/api/endpoints/claimTrackingsApi'
import { useGetCodingReviewsQuery } from '@/services/api/endpoints/codingReviewsApi'
import { useGetCollectionsQuery } from '@/services/api/endpoints/collectionsApi'
import { useGetCorrectedClaimsQuery } from '@/services/api/endpoints/correctedClaimsApi'
import { useGetDenialsQuery } from '@/services/api/endpoints/denialsApi'
import { useGetEncountersQuery } from '@/services/api/endpoints/encountersApi'
import { useGetEraEobProcessingsQuery } from '@/services/api/endpoints/eraEobProcessingsApi'
import { useGetPatientBillingsQuery } from '@/services/api/endpoints/patientBillingsApi'
import { useGetPaymentPostingsQuery } from '@/services/api/endpoints/paymentPostingsApi'
import type { CrudListCriteria, CrudListQuery } from '@/types/crud'
import type { WorkflowContext, WorkflowStageKey, WorkflowStageRuntime } from '@/types/rcmWorkflow'

interface WorkflowProgressTrackerProps {
  currentStage: WorkflowStageKey
  context?: WorkflowContext
  inferActiveStageFromStatus?: boolean
}

const stageContextMap: Record<WorkflowStageKey, keyof WorkflowContext> = {
  appointment: 'appointmentId',
  encounter: 'encounterId',
  charge: 'chargeId',
  codingReview: 'codingReviewId',
  claim: 'claimId',
  claimReadiness: 'claimId',
  claimSubmission: 'claimSubmissionId',
  claimTracking: 'claimTrackingId',
  waitingForERA: 'claimId',
  eraEobProcessing: 'eraEobProcessingId',
  paymentPosting: 'paymentPostingId',
  denial: 'denialId',
  appeal: 'appealId',
  correctedClaim: 'correctedClaimId',
  arWorkItem: 'arWorkItemId',
  patientBilling: 'patientBillingId',
  collection: 'collectionId',
  closed: 'claimId',
}

const optionalBranchStages = new Set<WorkflowStageKey>([
  'denial',
  'appeal',
  'correctedClaim',
  'arWorkItem',
  'patientBilling',
  'collection',
])

function normalizeStatus(value?: string) {
  return value?.trim().toUpperCase() ?? ''
}

function hasStageSignal(stage: WorkflowStageRuntime, context: WorkflowContext) {
  const idKey = stageContextMap[stage.key]
  return Boolean(context[idKey] || stage.status)
}

function isStageVisible(stage: WorkflowStageRuntime, activeStage: WorkflowStageKey, context: WorkflowContext) {
  if (stage.key === activeStage || !optionalBranchStages.has(stage.key)) {
    return true
  }

  return hasStageSignal(stage, context)
}

function inferActiveStage(currentStage: WorkflowStageKey, context: WorkflowContext): WorkflowStageKey {
  const closureStatus = normalizeStatus(context.closureStatus)
  const paymentStatus = normalizeStatus(context.paymentStatus)
  const submissionStatus = normalizeStatus(context.submissionStatus)
  const trackingStatus = normalizeStatus(context.trackingStatus)
  const eraStatus = normalizeStatus(context.eraStatus)
  const postingStatus = normalizeStatus(context.postingStatus)
  const denialStatus = normalizeStatus(context.denialStatus)
  const appealStatus = normalizeStatus(context.appealStatus)
  const arStatus = normalizeStatus(context.arStatus)
  const patientBillingStatus = normalizeStatus(context.patientBillingStatus)
  const collectionStatus = normalizeStatus(context.collectionStatus)

  if (closureStatus === 'CLOSED') return 'closed'
  if (context.collectionId || collectionStatus) return 'collection'
  if (context.patientBillingId || patientBillingStatus) return 'patientBilling'
  if (context.arWorkItemId || arStatus) return 'arWorkItem'
  if (context.appealId || appealStatus) return 'appeal'
  if (context.correctedClaimId) return 'correctedClaim'
  if (context.denialId || denialStatus || closureStatus === 'DENIED' || paymentStatus === 'DENIED') return 'denial'
  if (context.paymentPostingId || postingStatus || paymentStatus) return 'paymentPosting'
  if (context.eraEobProcessingId || eraStatus) return 'eraEobProcessing'

  if (
    closureStatus === 'AWAITING_ERA' ||
    closureStatus === 'ERA_DELAYED' ||
    closureStatus === 'FOLLOW_UP_REQUIRED' ||
    trackingStatus === 'ACCEPTED' ||
    submissionStatus === 'ACCEPTED' ||
    submissionStatus === 'ACKNOWLEDGED'
  ) {
    return 'waitingForERA'
  }

  if (context.claimTrackingId || trackingStatus) return 'claimTracking'
  if (context.claimSubmissionId || submissionStatus) return 'claimSubmission'
  if (context.claimReadinessId || context.readinessStatus) return 'claimReadiness'
  if (context.claimId || context.claimStatus) return currentStage === 'claimReadiness' ? 'claimReadiness' : 'claim'

  return currentStage
}

function buildStatusMap(context: WorkflowContext) {
  return {
    claim: context.claimStatus ?? context.status,
    claimReadiness: context.readinessStatus,
    claimSubmission: context.submissionStatus,
    claimTracking: context.trackingStatus,
    waitingForERA: context.closureStatus,
    eraEobProcessing: context.eraStatus,
    paymentPosting: context.postingStatus ?? context.paymentStatus,
    denial: context.denialStatus,
    appeal: context.appealStatus,
    correctedClaim: context.status,
    arWorkItem: context.arStatus,
    patientBilling: context.patientBillingStatus,
    collection: context.collectionStatus,
    closed: context.closureStatus,
  }
}

function completePreviousCoreStages(stages: WorkflowStageRuntime[], activeStage: WorkflowStageKey) {
  const activeIndex = stages.findIndex((stage) => stage.key === activeStage)

  if (activeIndex <= 0) {
    return stages
  }

  return stages.map((stage, index) => {
    if (index < activeIndex && stage.state === 'pending' && !optionalBranchStages.has(stage.key)) {
      return {
        ...stage,
        state: 'completed' as const,
        reason: undefined,
      }
    }

    return stage
  })
}

function truncateId(value?: string) {
  if (!value) {
    return null
  }

  return value.length > 10 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value
}

function workflowLookupQuery(criteria: CrudListCriteria[]): CrudListQuery {
  return {
    page: 1,
    limit: 1,
    sortfield: 'updated',
    direction: 'desc',
    criteria,
  }
}

function firstItem<TItem>(items?: TItem[]) {
  return items?.[0]
}

function hasStageRecord(stage: WorkflowStageRuntime, context: WorkflowContext) {
  const idKey = stageContextMap[stage.key]

  if (stage.key === 'appointment') {
    return true
  }

  if (stage.key === 'claimReadiness') {
    return Boolean(context.claimId)
  }

  if (stage.key === 'waitingForERA') {
    return Boolean(context.eraEobProcessingId)
  }

  if (stage.key === 'closed') {
    return Boolean(context.claimId && normalizeStatus(context.closureStatus) === 'CLOSED')
  }

  return Boolean(context[idKey])
}

function canNavigateStage(options: {
  stage: WorkflowStageRuntime
  context: WorkflowContext
  isCurrent: boolean
}) {
  const { stage, context } = options

  return hasStageRecord(stage, context)
}

function pickReturnContext(context: WorkflowContext): WorkflowContext {
  return {
    returnTo: context.returnTo,
    returnLabel: context.returnLabel,
  }
}

function buildStageRoute(stage: WorkflowStageRuntime, context: WorkflowContext) {
  const navigationContext = stage.key === 'appointment' ? pickReturnContext(context) : context

  if (stage.key === 'claimReadiness' && navigationContext.claimId) {
    return `/rcm/claims/${navigationContext.claimId}/readiness${buildWorkflowSearch(navigationContext)}`
  }

  if (stage.key === 'claimReadiness') {
    return `/rcm/claims${buildWorkflowSearch(navigationContext)}`
  }

  const route = stage.route.includes(':claimId') && navigationContext.claimId
    ? stage.route.replace(':claimId', navigationContext.claimId)
    : stage.route

  return `${route}${buildWorkflowSearch(navigationContext)}`
}

function buildNavigationContextForStage(
  stageKey: WorkflowStageKey,
  originalContext: WorkflowContext,
  resolvedContext: WorkflowContext,
): WorkflowContext {
  if (stageKey === 'appointment') {
    return pickReturnContext(originalContext)
  }

  const nextContext = mergeWorkflowContext(originalContext, {
    appointmentId: originalContext.appointmentId ?? resolvedContext.appointmentId,
    patientId: originalContext.patientId ?? resolvedContext.patientId,
    payerId: originalContext.payerId ?? resolvedContext.payerId,
    providerId: originalContext.providerId ?? resolvedContext.providerId,
    facilityId: originalContext.facilityId ?? resolvedContext.facilityId,
  })

  if (
    [
      'charge',
      'codingReview',
      'claim',
    ].includes(stageKey)
  ) {
    nextContext.encounterId = originalContext.encounterId ?? resolvedContext.encounterId
  }

  if (['codingReview', 'claim'].includes(stageKey)) {
    nextContext.chargeId = originalContext.chargeId ?? resolvedContext.chargeId
  }

  if (
    [
      'claimReadiness',
      'claimSubmission',
      'claimTracking',
      'waitingForERA',
      'eraEobProcessing',
      'paymentPosting',
      'denial',
      'appeal',
      'correctedClaim',
      'arWorkItem',
      'patientBilling',
      'closed',
    ].includes(stageKey)
  ) {
    nextContext.claimId = originalContext.claimId ?? resolvedContext.claimId
  }

  if (stageKey === 'collection') {
    nextContext.patientBillingId = originalContext.patientBillingId ?? resolvedContext.patientBillingId
    nextContext.patientId = originalContext.patientId ?? resolvedContext.patientId
  }

  const ownIdKey = stageContextMap[stageKey]
  const keepOwnId = Boolean(originalContext[ownIdKey]) || stageKey === 'claimReadiness' || stageKey === 'waitingForERA' || stageKey === 'closed'

  if (!keepOwnId) {
    nextContext[ownIdKey] = undefined
  }

  return nextContext
}

function useResolvedWorkflowContext(context: WorkflowContext) {
  const encounterLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('encounter', context)),
    [context],
  )
  const encounterQuery = useGetEncountersQuery(encounterLookupQuery, {
    skip: Boolean(context.encounterId) || !context.appointmentId,
  })
  const resolvedEncounterId = context.encounterId ?? firstItem(encounterQuery.data?.data)?._id

  const chargeLookupContext = useMemo(
    () => mergeWorkflowContext(context, { encounterId: resolvedEncounterId }),
    [context, resolvedEncounterId],
  )
  const chargeLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('charge', chargeLookupContext)),
    [chargeLookupContext],
  )
  const chargeQuery = useGetChargesQuery(chargeLookupQuery, {
    skip: Boolean(context.chargeId) || !resolvedEncounterId,
  })
  const resolvedChargeId = context.chargeId ?? firstItem(chargeQuery.data?.data)?._id

  const codingReviewLookupContext = useMemo(
    () => mergeWorkflowContext(context, {
      encounterId: resolvedEncounterId,
      chargeId: resolvedChargeId,
    }),
    [context, resolvedChargeId, resolvedEncounterId],
  )
  const codingReviewLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('codingReview', codingReviewLookupContext)),
    [codingReviewLookupContext],
  )
  const codingReviewQuery = useGetCodingReviewsQuery(codingReviewLookupQuery, {
    skip: Boolean(context.codingReviewId) || (!resolvedEncounterId && !resolvedChargeId),
  })
  const resolvedCodingReviewId = context.codingReviewId ?? firstItem(codingReviewQuery.data?.data)?._id

  const claimLookupContext = useMemo(
    () => mergeWorkflowContext(context, {
      encounterId: resolvedEncounterId,
      chargeId: resolvedChargeId,
    }),
    [context, resolvedChargeId, resolvedEncounterId],
  )
  const claimLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('claim', claimLookupContext)),
    [claimLookupContext],
  )
  const claimQuery = useGetClaimsQuery(claimLookupQuery, {
    skip: Boolean(context.claimId) || (!resolvedEncounterId && !resolvedChargeId),
  })
  const resolvedClaim = firstItem(claimQuery.data?.data)
  const resolvedClaimId = context.claimId ?? resolvedClaim?._id

  const claimScopedContext = useMemo(
    () => mergeWorkflowContext(context, {
      encounterId: resolvedEncounterId,
      chargeId: resolvedChargeId,
      codingReviewId: resolvedCodingReviewId,
      claimId: resolvedClaimId,
      claimStatus: context.claimStatus ?? resolvedClaim?.claimStatus,
      submissionStatus: context.submissionStatus ?? resolvedClaim?.submissionStatus,
      paymentStatus: context.paymentStatus ?? resolvedClaim?.paymentStatus,
      closureStatus: context.closureStatus ?? resolvedClaim?.closureStatus,
    }),
    [
      context,
      resolvedChargeId,
      resolvedClaim,
      resolvedClaimId,
      resolvedCodingReviewId,
      resolvedEncounterId,
    ],
  )

  const claimSubmissionLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('claimSubmission', claimScopedContext)),
    [claimScopedContext],
  )
  const claimSubmissionQuery = useGetClaimSubmissionsQuery(claimSubmissionLookupQuery, {
    skip: Boolean(context.claimSubmissionId) || !resolvedClaimId,
  })
  const resolvedClaimSubmission = firstItem(claimSubmissionQuery.data?.data)
  const resolvedClaimSubmissionId = context.claimSubmissionId ?? resolvedClaimSubmission?._id

  const claimTrackingLookupContext = useMemo(
    () => mergeWorkflowContext(claimScopedContext, { claimSubmissionId: resolvedClaimSubmissionId }),
    [claimScopedContext, resolvedClaimSubmissionId],
  )
  const claimTrackingLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('claimTracking', claimTrackingLookupContext)),
    [claimTrackingLookupContext],
  )
  const claimTrackingQuery = useGetClaimTrackingsQuery(claimTrackingLookupQuery, {
    skip: Boolean(context.claimTrackingId) || !resolvedClaimId,
  })
  const resolvedClaimTracking = firstItem(claimTrackingQuery.data?.data)
  const resolvedClaimTrackingId = context.claimTrackingId ?? resolvedClaimTracking?._id

  const eraEobProcessingLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('eraEobProcessing', claimScopedContext)),
    [claimScopedContext],
  )
  const eraEobProcessingQuery = useGetEraEobProcessingsQuery(eraEobProcessingLookupQuery, {
    skip: Boolean(context.eraEobProcessingId) || !resolvedClaimId,
  })
  const resolvedEraEobProcessing = firstItem(eraEobProcessingQuery.data?.data)
  const resolvedEraEobProcessingId = context.eraEobProcessingId ?? resolvedEraEobProcessing?._id

  const paymentPostingLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('paymentPosting', claimScopedContext)),
    [claimScopedContext],
  )
  const paymentPostingQuery = useGetPaymentPostingsQuery(paymentPostingLookupQuery, {
    skip: Boolean(context.paymentPostingId) || !resolvedClaimId,
  })
  const resolvedPaymentPosting = firstItem(paymentPostingQuery.data?.data)
  const resolvedPaymentPostingId = context.paymentPostingId ?? resolvedPaymentPosting?._id

  const denialLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('denial', claimScopedContext)),
    [claimScopedContext],
  )
  const denialQuery = useGetDenialsQuery(denialLookupQuery, {
    skip: Boolean(context.denialId) || !resolvedClaimId,
  })
  const resolvedDenial = firstItem(denialQuery.data?.data)
  const resolvedDenialId = context.denialId ?? resolvedDenial?._id

  const appealLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('appeal', claimScopedContext)),
    [claimScopedContext],
  )
  const appealQuery = useGetAppealsQuery(appealLookupQuery, {
    skip: Boolean(context.appealId) || !resolvedClaimId,
  })
  const resolvedAppeal = firstItem(appealQuery.data?.data)
  const resolvedAppealId = context.appealId ?? resolvedAppeal?._id

  const correctedClaimLookupContext = useMemo(
    () => mergeWorkflowContext(claimScopedContext, { denialId: resolvedDenialId }),
    [claimScopedContext, resolvedDenialId],
  )
  const correctedClaimLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('correctedClaim', correctedClaimLookupContext)),
    [correctedClaimLookupContext],
  )
  const correctedClaimQuery = useGetCorrectedClaimsQuery(correctedClaimLookupQuery, {
    skip: Boolean(context.correctedClaimId) || (!resolvedClaimId && !resolvedDenialId),
  })
  const resolvedCorrectedClaim = firstItem(correctedClaimQuery.data?.data)
  const resolvedCorrectedClaimId = context.correctedClaimId ?? resolvedCorrectedClaim?._id

  const arWorkItemLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('arWorkItem', claimScopedContext)),
    [claimScopedContext],
  )
  const arWorkItemQuery = useGetArWorkItemsQuery(arWorkItemLookupQuery, {
    skip: Boolean(context.arWorkItemId) || !resolvedClaimId,
  })
  const resolvedArWorkItem = firstItem(arWorkItemQuery.data?.data)
  const resolvedArWorkItemId = context.arWorkItemId ?? resolvedArWorkItem?._id

  const patientBillingLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('patientBilling', claimScopedContext)),
    [claimScopedContext],
  )
  const patientBillingQuery = useGetPatientBillingsQuery(patientBillingLookupQuery, {
    skip: Boolean(context.patientBillingId) || !resolvedClaimId,
  })
  const resolvedPatientBilling = firstItem(patientBillingQuery.data?.data)
  const resolvedPatientBillingId = context.patientBillingId ?? resolvedPatientBilling?._id

  const collectionLookupContext = useMemo(
    () => mergeWorkflowContext(claimScopedContext, { patientBillingId: resolvedPatientBillingId }),
    [claimScopedContext, resolvedPatientBillingId],
  )
  const collectionLookupQuery = useMemo(
    () => workflowLookupQuery(buildWorkflowCriteria('collection', collectionLookupContext)),
    [collectionLookupContext],
  )
  const collectionQuery = useGetCollectionsQuery(collectionLookupQuery, {
    skip: Boolean(context.collectionId) || !resolvedPatientBillingId,
  })
  const resolvedCollection = firstItem(collectionQuery.data?.data)

  return useMemo(
    () => mergeWorkflowContext(claimScopedContext, {
      claimSubmissionId: resolvedClaimSubmissionId,
      claimTrackingId: resolvedClaimTrackingId,
      trackingStatus: context.trackingStatus ?? resolvedClaimTracking?.normalizedStatus,
      eraEobProcessingId: resolvedEraEobProcessingId,
      eraStatus: context.eraStatus ?? resolvedEraEobProcessing?.reconciliationStatus,
      paymentPostingId: resolvedPaymentPostingId,
      postingStatus: context.postingStatus ?? resolvedPaymentPosting?.postingStatus,
      denialId: resolvedDenialId,
      denialStatus: context.denialStatus ?? resolvedDenial?.denialStatus,
      appealId: resolvedAppealId,
      appealStatus: context.appealStatus ?? resolvedAppeal?.appealStatus,
      correctedClaimId: resolvedCorrectedClaimId,
      arWorkItemId: resolvedArWorkItemId,
      arStatus: context.arStatus ?? resolvedArWorkItem?.status,
      patientBillingId: resolvedPatientBillingId,
      patientBillingStatus: context.patientBillingStatus ?? resolvedPatientBilling?.status,
      collectionId: context.collectionId ?? resolvedCollection?._id,
      collectionStatus: context.collectionStatus ?? resolvedCollection?.collectionStatus,
    }),
    [
      claimScopedContext,
      context,
      resolvedAppeal,
      resolvedAppealId,
      resolvedArWorkItem,
      resolvedArWorkItemId,
      resolvedClaimSubmissionId,
      resolvedClaimTracking,
      resolvedClaimTrackingId,
      resolvedCollection,
      resolvedCorrectedClaimId,
      resolvedDenial,
      resolvedDenialId,
      resolvedEraEobProcessing,
      resolvedEraEobProcessingId,
      resolvedPatientBilling,
      resolvedPatientBillingId,
      resolvedPaymentPosting,
      resolvedPaymentPostingId,
    ],
  )
}

export function WorkflowProgressTracker({
  currentStage,
  context = {},
  inferActiveStageFromStatus = false,
}: WorkflowProgressTrackerProps) {
  const resolvedContext = useResolvedWorkflowContext(context)
  const activeStage = inferActiveStageFromStatus ? inferActiveStage(currentStage, resolvedContext) : currentStage
  const stages = completePreviousCoreStages(
    buildWorkflowRuntimeStages(resolvedContext, buildStatusMap(resolvedContext)),
    activeStage,
  ).filter((stage) => isStageVisible(stage, activeStage, resolvedContext))
  const currentStageIndex = stages.findIndex((stage) => stage.key === activeStage)

  return (
    <section className="overflow-x-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-3 shadow-sm">
      <div className="flex min-w-max items-center gap-2">
        {stages.map((stage, index) => {
          const isComplete = stage.state === 'completed' || (index < currentStageIndex && stage.state !== 'blocked')
          const isCurrent = index === currentStageIndex
          const relatedId = truncateId(resolvedContext[stageContextMap[stage.key]])
          const isBlocked = stage.state === 'blocked'
          const stageAccessibleLabel = `${stage.label}${stage.status ? `, ${stage.status}` : ''}`
          const canNavigate = canNavigateStage({
            stage,
            context: resolvedContext,
            isCurrent,
          })
          const stageRoute = buildStageRoute(
            stage,
            buildNavigationContextForStage(stage.key, context, resolvedContext),
          )
          const pillClassName = cn(
            'flex min-w-[9rem] items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition-colors',
            isCurrent
              ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
              : isBlocked
                ? 'border-red-200 bg-red-50 text-red-700'
                : isComplete
                ? 'border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
            canNavigate
              ? cn(
                'no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]',
                isCurrent
                  ? 'hover:bg-[var(--color-primary-hover)]'
                  : isBlocked
                    ? 'hover:border-red-300 hover:bg-red-100'
                    : isComplete
                      ? 'hover:border-[var(--color-primary)]/50 hover:bg-[var(--color-primary-soft)]'
                      : 'hover:border-[var(--color-primary)]/30 hover:bg-[var(--color-surface)] hover:text-[var(--color-text-strong)]',
              )
              : 'cursor-not-allowed opacity-60',
          )
          const markerClassName = cn(
            'flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
            isCurrent
              ? 'bg-white/20 text-white'
              : isBlocked
                ? 'bg-red-100 text-red-700'
              : isComplete
                ? 'bg-[var(--color-surface)] text-[var(--color-primary)]'
                : 'bg-[var(--color-border)] text-[var(--color-text-muted)]',
          )
          const title = canNavigate
            ? stage.reason
              ? `${stage.label}: ${stage.reason}`
              : `Open ${stage.label}`
            : `${stage.label} is not available until the previous workflow step creates this record.`
          const pillContent = (
            <>
              <span className={markerClassName}>
                {index + 1}
              </span>
              <span className="whitespace-nowrap">{stage.label}</span>
            </>
          )

          return (
            <div key={stage.key} className="flex min-w-0 items-center gap-2">
              {canNavigate ? (
                <Link
                  to={stageRoute}
                  aria-current={isCurrent ? 'step' : undefined}
                  aria-label={`Open ${stageAccessibleLabel}`}
                  title={title}
                  className={pillClassName}
                >
                  {pillContent}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  aria-label={`${stageAccessibleLabel} is not available yet`}
                  title={title}
                  className={pillClassName}
                >
                  {pillContent}
                </span>
              )}
              {relatedId ? (
                <span className="text-[11px] font-medium uppercase tracking-normal text-[var(--color-text-muted)]">
                  {relatedId}
                </span>
              ) : null}
              {index < stages.length - 1 ? (
                <div className="h-px w-6 bg-[var(--color-border)]" aria-hidden="true" />
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
