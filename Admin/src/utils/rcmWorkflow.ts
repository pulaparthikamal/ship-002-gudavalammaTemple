import type { CrudListCriteria } from '@/types/crud'
import type {
  DashboardRecordStageKey,
  WorkflowContext,
  WorkflowStageDefinition,
  WorkflowStageKey,
  WorkflowStageRuntime,
  WorkflowStageState,
} from '@/types/rcmWorkflow'

const workflowContextKeys: Array<keyof WorkflowContext> = [
  'appointmentId',
  'encounterId',
  'chargeId',
  'codingReviewId',
  'claimId',
  'claimReadinessId',
  'claimSubmissionId',
  'claimTrackingId',
  'eraEobProcessingId',
  'paymentPostingId',
  'denialId',
  'appealId',
  'correctedClaimId',
  'arWorkItemId',
  'patientBillingId',
  'collectionId',
  'patientId',
  'payerId',
  'providerId',
  'facilityId',
  'status',
  'claimStatus',
  'readinessStatus',
  'submissionStatus',
  'trackingStatus',
  'eraStatus',
  'postingStatus',
  'paymentStatus',
  'denialStatus',
  'appealStatus',
  'arStatus',
  'patientBillingStatus',
  'collectionStatus',
  'closureStatus',
  'riskType',
  'exceptionType',
  'insurancePolicyId',
  'dashboardQueue',
  'dashboardEntityId',
  'returnTo',
  'returnLabel',
]

export const workflowStages: WorkflowStageDefinition[] = [
  {
    key: 'appointment',
    label: 'Appointment',
    route: '/rcm/appointments',
    description: 'Patient arrives and financial clearance begins.',
    statusFields: ['appointmentStatus', 'checkInStatus'],
    completedStatuses: ['CHECKED_IN', 'Completed', 'COMPLETED'],
    pendingStatuses: ['Scheduled', 'SCHEDULED', 'Pending'],
    blockedStatuses: ['Cancelled', 'No Show', 'NO_SHOW'],
    allowedNextActions: ['Check in', 'Run eligibility', 'Open encounter'],
    entityRelationships: ['patientId', 'insurancePolicyId', 'encounterId'],
  },
  {
    key: 'encounter',
    label: 'Encounter',
    route: '/rcm/encounters',
    description: 'Clinical documentation is completed and charge capture can begin.',
    statusFields: ['encounterStatus', 'status'],
    completedStatuses: ['Completed', 'COMPLETED', 'Closed'],
    pendingStatuses: ['Open', 'In Progress', 'IN_PROGRESS'],
    blockedStatuses: ['Cancelled', 'Incomplete'],
    allowedNextActions: ['Complete encounter', 'Create charge'],
    entityRelationships: ['appointmentId', 'patientId', 'chargeId'],
  },
  {
    key: 'charge',
    label: 'Charge Capture',
    route: '/rcm/charges',
    description: 'Billable services are captured and prepared for coding review.',
    statusFields: ['chargeStatus', 'status'],
    completedStatuses: ['Submitted', 'SUBMITTED', 'Reviewed', 'APPROVED'],
    pendingStatuses: ['Draft', 'DRAFT', 'Pending'],
    blockedStatuses: ['Rejected', 'REJECTED'],
    allowedNextActions: ['Submit to coding review'],
    entityRelationships: ['encounterId', 'claimId', 'codingReviewId'],
  },
  {
    key: 'codingReview',
    label: 'Coding Review',
    route: '/rcm/coding-reviews',
    description: 'Codes and claim-line readiness are reviewed before claim creation.',
    statusFields: ['reviewStatus', 'codingStatus', 'scrubStatus'],
    completedStatuses: ['Approved', 'APPROVED', 'Passed'],
    pendingStatuses: ['Pending', 'PENDING', 'In Review'],
    blockedStatuses: ['Rejected', 'REJECTED', 'Blocked'],
    allowedNextActions: ['Approve coding', 'Create claim'],
    entityRelationships: ['chargeId', 'claimId'],
  },
  {
    key: 'claim',
    label: 'Claim Creation',
    route: '/rcm/claims',
    description: 'The professional claim exists and can be scrubbed, priced, and prepared.',
    statusFields: ['claimStatus', 'scrubStatus'],
    completedStatuses: ['Ready for Submission', 'READY', 'Submitted', 'Accepted', 'Paid'],
    pendingStatuses: ['Draft', 'DRAFT', 'On Hold'],
    blockedStatuses: ['Rejected', 'FAILED', 'Blocked'],
    allowedNextActions: ['Open readiness', 'Refresh pricing', 'Run eligibility'],
    entityRelationships: ['chargeId', 'patientId', 'payerId', 'claimSubmissionId'],
  },
  {
    key: 'claimReadiness',
    label: 'Claim Readiness',
    route: '/rcm/claims/:claimId/readiness',
    description: 'Eligibility, pricing, authorization, referral, coverage, and EDI defects are resolved.',
    statusFields: ['readinessStatus', 'canSubmit'],
    completedStatuses: ['READY', 'Can submit', 'true'],
    pendingStatuses: ['Pending', 'Review'],
    blockedStatuses: ['BLOCKED', 'Blocked', 'false'],
    allowedNextActions: ['Run readiness', 'Run AI review', 'Submit claim'],
    entityRelationships: ['claimId', 'claimSubmissionId', 'claimTrackingId'],
  },
  {
    key: 'claimSubmission',
    label: 'Claim Submission',
    route: '/rcm/claim-submissions',
    description: '837P transmission is created and sent to the clearinghouse.',
    statusFields: ['transmissionStatus', 'normalizedStatus', 'acknowledgementStatus'],
    completedStatuses: ['Submitted', 'Transmitted', 'Acknowledged', 'Accepted', 'SUBMITTED', 'ACCEPTED'],
    pendingStatuses: ['Queued', 'Pending', 'PENDING'],
    blockedStatuses: ['Rejected', 'Failed', 'REJECTED', 'FAILED'],
    allowedNextActions: ['Open tracking', 'Refresh status', 'Parse test acknowledgement'],
    entityRelationships: ['claimId', 'claimTrackingId'],
  },
  {
    key: 'claimTracking',
    label: 'Claim Tracking',
    route: '/rcm/claim-trackings',
    description: '999, 277CA, and payer status responses drive follow-up or adjudication.',
    statusFields: ['normalizedStatus', 'statusCode', 'statusDescription'],
    completedStatuses: ['ACCEPTED', 'Accepted', 'Paid'],
    pendingStatuses: ['SUBMITTED', 'PENDING', 'Pending'],
    blockedStatuses: ['REJECTED', 'FAILED', 'Rejected', 'Failed'],
    allowedNextActions: ['Open ERA/EOB', 'Fix rejection', 'Open AR work item'],
    entityRelationships: ['claimId', 'claimSubmissionId', 'eraEobProcessingId', 'arWorkItemId'],
  },
  {
    key: 'waitingForERA',
    label: 'Waiting for ERA',
    route: '/rcm/era-eob-processings',
    description: 'Accepted claim is monitored until the 835 ERA/EOB arrives or follow-up is needed.',
    statusFields: ['eraStatus', 'normalizedStatus', 'reconciliationStatus'],
    completedStatuses: ['ERA_RECEIVED', 'RECEIVED', 'PARSED', 'POSTED', 'RECONCILED'],
    pendingStatuses: ['WAITING_FOR_ERA', 'ACCEPTED', 'PENDING_ERA', 'AWAITING_ERA'],
    blockedStatuses: ['ERA_OVERDUE', 'ERA_DELAYED', 'FOLLOW_UP_REQUIRED', 'EXCEPTION', 'REJECTED', 'FAILED'],
    allowedNextActions: ['Monitor ERA', 'Import test 835', 'Create AR follow-up'],
    entityRelationships: ['claimId', 'claimSubmissionId', 'claimTrackingId', 'eraEobProcessingId', 'arWorkItemId'],
  },
  {
    key: 'eraEobProcessing',
    label: 'ERA / EOB',
    route: '/rcm/era-eob-processings',
    description: '835 remittance is received, parsed, matched, and reconciled.',
    statusFields: ['reconciliationStatus', 'importStatus', 'parsedStatus'],
    completedStatuses: ['POSTED', 'RECONCILED'],
    pendingStatuses: ['RECEIVED', 'PARSED'],
    blockedStatuses: ['EXCEPTION', 'PARTIALLY_POSTED'],
    allowedNextActions: ['Import 835', 'View payment posting', 'Lock accounting'],
    entityRelationships: ['claimId', 'paymentPostingId', 'denialId', 'arWorkItemId'],
  },
  {
    key: 'paymentPosting',
    label: 'Payment Posting',
    route: '/rcm/payment-postings',
    description: 'Payer payments, adjustments, denials, and patient responsibility are posted.',
    statusFields: ['postingStatus', 'paymentStatus'],
    completedStatuses: ['POSTED', 'PAID', 'CLOSED'],
    pendingStatuses: ['PENDING', 'PARTIALLY_POSTED'],
    blockedStatuses: ['FAILED', 'DENIED', 'UNDERPAID'],
    allowedNextActions: ['Review denial', 'Create patient billing', 'Review refund'],
    entityRelationships: ['claimId', 'eraEobProcessingId', 'denialId', 'patientBillingId'],
  },
  {
    key: 'denial',
    label: 'Denial',
    route: '/rcm/denials',
    description: 'Denied or underpaid claims are classified and routed to appeal or corrected claim.',
    statusFields: ['denialStatus', 'status'],
    completedStatuses: ['RESOLVED', 'WRITTEN_OFF', 'OVERTURNED'],
    pendingStatuses: ['OPEN', 'APPEAL_READY', 'CORRECTED_CLAIM_READY'],
    blockedStatuses: ['NEEDS_REVIEW', 'BLOCKED'],
    allowedNextActions: ['Create appeal', 'Create corrected claim', 'Write off'],
    entityRelationships: ['claimId', 'paymentPostingId', 'appealId', 'correctedClaimId', 'arWorkItemId'],
  },
  {
    key: 'appeal',
    label: 'Appeal',
    route: '/rcm/appeals',
    description: 'Appeal packet and payer follow-up are managed until payer decision.',
    statusFields: ['appealStatus'],
    completedStatuses: ['OVERTURNED', 'UPHELD', 'CLOSED'],
    pendingStatuses: ['DRAFT', 'READY', 'SUBMITTED', 'PENDING'],
    blockedStatuses: ['REJECTED', 'FAILED'],
    allowedNextActions: ['Submit appeal', 'Follow up', 'Close appeal'],
    entityRelationships: ['claimId', 'denialId', 'arWorkItemId'],
  },
  {
    key: 'correctedClaim',
    label: 'Corrected Claim',
    route: '/rcm/corrected-claims',
    description: 'Corrected claim lineage is created, validated, and resubmitted.',
    statusFields: ['correctedClaimStatus'],
    completedStatuses: ['SUBMITTED', 'ACCEPTED', 'CLOSED'],
    pendingStatuses: ['DRAFT', 'READY'],
    blockedStatuses: ['REJECTED', 'FAILED'],
    allowedNextActions: ['Run readiness', 'Submit corrected claim'],
    entityRelationships: ['claimId', 'denialId', 'clonedClaimId'],
  },
  {
    key: 'arWorkItem',
    label: 'AR Work Item',
    route: '/rcm/ar-work-items',
    description: 'Operational follow-up queue tracks payer response, rejection, denial, and underpayment work.',
    statusFields: ['status'],
    completedStatuses: ['CLOSED', 'RESOLVED'],
    pendingStatuses: ['OPEN', 'IN_PROGRESS', 'PENDING'],
    blockedStatuses: ['BLOCKED', 'ESCALATED'],
    allowedNextActions: ['Update follow-up', 'Open denial', 'Open corrected claim'],
    entityRelationships: ['claimId', 'denialId', 'appealId', 'correctedClaimId'],
  },
  {
    key: 'patientBilling',
    label: 'Patient Billing',
    route: '/rcm/patient-billings',
    description: 'Final patient responsibility is billed after payer adjudication.',
    statusFields: ['status', 'statementStatus'],
    completedStatuses: ['PAID', 'CLOSED'],
    pendingStatuses: ['OPEN', 'SENT', 'PENDING'],
    blockedStatuses: ['PAST_DUE', 'COLLECTIONS'],
    allowedNextActions: ['Collect payment', 'Move to collections'],
    entityRelationships: ['claimId', 'patientId', 'collectionId'],
  },
  {
    key: 'collection',
    label: 'Collections',
    route: '/rcm/collections',
    description: 'Aged patient balances are worked through collections or settlement/write-off.',
    statusFields: ['collectionStatus', 'status'],
    completedStatuses: ['CLOSED', 'SETTLED', 'WRITTEN_OFF'],
    pendingStatuses: ['OPEN', 'CONTACTED', 'PAYMENT_PLAN'],
    blockedStatuses: ['EXTERNAL_COLLECTIONS_READY', 'ESCALATED'],
    allowedNextActions: ['Record contact', 'Settle', 'Write off'],
    entityRelationships: ['patientBillingId', 'patientId'],
  },
  {
    key: 'closed',
    label: 'Closed',
    route: '/rcm/claims',
    description: 'Claim financial lifecycle is complete and no operational action is pending.',
    statusFields: ['closureStatus', 'claimStatus', 'paymentStatus'],
    completedStatuses: ['CLOSED'],
    pendingStatuses: [],
    blockedStatuses: ['REOPENED', 'OPEN', 'IN_PROGRESS', 'AWAITING_ERA', 'ERA_DELAYED', 'FOLLOW_UP_REQUIRED', 'PARTIALLY_PAID', 'DENIED'],
    allowedNextActions: ['View audit trail'],
    entityRelationships: ['claimId'],
  },
]

function normalizeId(value: string | null) {
  const nextValue = value?.trim()
  return nextValue ? nextValue : undefined
}

export function readWorkflowContext(searchParams: URLSearchParams): WorkflowContext {
  return {
    appointmentId: normalizeId(searchParams.get('appointmentId')),
    encounterId: normalizeId(searchParams.get('encounterId')),
    chargeId: normalizeId(searchParams.get('chargeId')),
    codingReviewId: normalizeId(searchParams.get('codingReviewId')),
    claimId: normalizeId(searchParams.get('claimId')),
    claimReadinessId: normalizeId(searchParams.get('claimReadinessId')),
    claimSubmissionId: normalizeId(searchParams.get('claimSubmissionId')),
    claimTrackingId: normalizeId(searchParams.get('claimTrackingId')),
    eraEobProcessingId: normalizeId(searchParams.get('eraEobProcessingId')) ?? normalizeId(searchParams.get('eraId')),
    paymentPostingId: normalizeId(searchParams.get('paymentPostingId')) ?? normalizeId(searchParams.get('paymentId')),
    denialId: normalizeId(searchParams.get('denialId')),
    appealId: normalizeId(searchParams.get('appealId')),
    correctedClaimId: normalizeId(searchParams.get('correctedClaimId')),
    arWorkItemId: normalizeId(searchParams.get('arWorkItemId')),
    patientBillingId: normalizeId(searchParams.get('patientBillingId')),
    collectionId: normalizeId(searchParams.get('collectionId')),
    patientId: normalizeId(searchParams.get('patientId')),
    payerId: normalizeId(searchParams.get('payerId')),
    providerId: normalizeId(searchParams.get('providerId')),
    facilityId: normalizeId(searchParams.get('facilityId')),
    status: normalizeId(searchParams.get('status')),
    claimStatus: normalizeId(searchParams.get('claimStatus')),
    readinessStatus: normalizeId(searchParams.get('readinessStatus')),
    submissionStatus: normalizeId(searchParams.get('submissionStatus')),
    trackingStatus: normalizeId(searchParams.get('trackingStatus')),
    eraStatus: normalizeId(searchParams.get('eraStatus')),
    postingStatus: normalizeId(searchParams.get('postingStatus')),
    paymentStatus: normalizeId(searchParams.get('paymentStatus')),
    denialStatus: normalizeId(searchParams.get('denialStatus')),
    appealStatus: normalizeId(searchParams.get('appealStatus')),
    arStatus: normalizeId(searchParams.get('arStatus')),
    patientBillingStatus: normalizeId(searchParams.get('patientBillingStatus')),
    collectionStatus: normalizeId(searchParams.get('collectionStatus')),
    closureStatus: normalizeId(searchParams.get('closureStatus')),
    riskType: normalizeId(searchParams.get('riskType')),
    exceptionType: normalizeId(searchParams.get('exceptionType')),
    insurancePolicyId: normalizeId(searchParams.get('insurancePolicyId')),
    dashboardQueue: normalizeId(searchParams.get('dashboardQueue')),
    dashboardEntityId: normalizeId(searchParams.get('dashboardEntityId')),
    returnTo: normalizeId(searchParams.get('returnTo')),
    returnLabel: normalizeId(searchParams.get('returnLabel')),
  }
}

export function mergeWorkflowContext(
  currentContext: WorkflowContext,
  updates: Partial<WorkflowContext>,
): WorkflowContext {
  return {
    ...currentContext,
    ...updates,
  }
}

export function buildWorkflowSearch(context: WorkflowContext) {
  const searchParams = new URLSearchParams()

  for (const key of workflowContextKeys) {
    const value = context[key]

    if (value) {
      searchParams.set(key, value)
    }
  }

  const serializedSearch = searchParams.toString()
  return serializedSearch ? `?${serializedSearch}` : ''
}

function pickWorkflowContext(
  context: WorkflowContext,
  keys: Array<keyof WorkflowContext>,
): WorkflowContext {
  return keys.reduce<WorkflowContext>((nextContext, key) => {
    const value = context[key]

    if (value) {
      nextContext[key] = value
    }

    return nextContext
  }, {})
}

function buildStageNavigationContext(stage: WorkflowStageKey, context: WorkflowContext): WorkflowContext {
  if (stage === 'appointment') {
    return pickWorkflowContext(context, ['returnTo', 'returnLabel'])
  }

  return context
}

function stageIdKey(stage: WorkflowStageKey): keyof WorkflowContext | undefined {
  const explicitMap: Partial<Record<WorkflowStageKey, keyof WorkflowContext>> = {
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

  return explicitMap[stage]
}

function resolveStageRoute(stage: WorkflowStageDefinition, context: WorkflowContext) {
  const navigationContext = buildStageNavigationContext(stage.key, context)

  if (stage.key === 'claimReadiness' && navigationContext.claimId) {
    return `/rcm/claims/${navigationContext.claimId}/readiness${buildWorkflowSearch(navigationContext)}`
  }

  if (stage.key === 'claimReadiness') {
    return `/rcm/claims${buildWorkflowSearch(navigationContext)}`
  }

  const idKey = stageIdKey(stage.key)
  const stageId = idKey ? navigationContext[idKey] : undefined
  const route = stage.route.includes(':claimId') && navigationContext.claimId
    ? stage.route.replace(':claimId', navigationContext.claimId)
    : stage.route

  if (stageId && stage.key !== 'claim' && stage.key !== 'closed') {
    return `${route}${buildWorkflowSearch(navigationContext)}`
  }

  return `${route}${buildWorkflowSearch(navigationContext)}`
}

function normalizeStatus(value: unknown) {
  if (typeof value === 'boolean') {
    return String(value)
  }

  return typeof value === 'string' ? value.trim() : ''
}

function includesStatus(statuses: string[], status: string) {
  return statuses.some((item) => item.toLowerCase() === status.toLowerCase())
}

const entityPresenceCompletesStages = new Set<WorkflowStageKey>([
  'appointment',
  'encounter',
  'charge',
  'codingReview',
  'claim',
  'claimSubmission',
  'claimTracking',
  'eraEobProcessing',
  'paymentPosting',
  'denial',
  'appeal',
  'correctedClaim',
  'arWorkItem',
  'patientBilling',
  'collection',
])

export function evaluateWorkflowStageState(
  stage: WorkflowStageDefinition,
  status?: string,
  hasEntity = false,
): WorkflowStageState {
  const normalizedStatus = normalizeStatus(status)

  if (normalizedStatus && includesStatus(stage.blockedStatuses, normalizedStatus)) {
    return 'blocked'
  }

  if (normalizedStatus && includesStatus(stage.completedStatuses, normalizedStatus)) {
    return 'completed'
  }

  if (hasEntity && !normalizedStatus && entityPresenceCompletesStages.has(stage.key)) {
    return 'completed'
  }

  return 'pending'
}

export function buildWorkflowRuntimeStages(
  context: WorkflowContext,
  statusByStage: Partial<Record<WorkflowStageKey, string | boolean | undefined>> = {},
): WorkflowStageRuntime[] {
  return workflowStages.map((stage) => {
    const idKey = stageIdKey(stage.key)
    const status = normalizeStatus(statusByStage[stage.key])
    const hasEntity = Boolean(idKey && context[idKey])
    const state = evaluateWorkflowStageState(stage, status, hasEntity)

    return {
      ...stage,
      status: status || undefined,
      state,
      routeWithContext: resolveStageRoute(stage, context),
      reason:
        state === 'blocked'
          ? `Blocked by ${status || stage.label}`
          : state === 'pending'
            ? stage.allowedNextActions[0]
            : undefined,
    }
  })
}

export function buildWorkflowCriteria(
  currentStage: WorkflowStageKey | DashboardRecordStageKey,
  context: WorkflowContext,
): CrudListCriteria[] {
  const scopedCriteria: CrudListCriteria[] = []
  if (context.payerId) scopedCriteria.push({ key: 'payerId', value: context.payerId, type: 'equals' })
  if (context.facilityId) scopedCriteria.push({ key: 'facilityId', value: context.facilityId, type: 'equals' })
  if (context.providerId) scopedCriteria.push({ key: 'providerId', value: context.providerId, type: 'equals' })

  if (currentStage === 'appointment') {
    return []
  }

  if (currentStage === 'encounter') {
    if (context.encounterId) {
      return [{ key: '_id', value: context.encounterId, type: 'equals' }]
    }

    if (context.appointmentId) {
      return [{ key: 'appointmentId', value: context.appointmentId, type: 'equals' }]
    }
  }

  if (currentStage === 'charge') {
    if (context.chargeId) {
      return [{ key: '_id', value: context.chargeId, type: 'equals' }]
    }

    if (context.encounterId) {
      return [{ key: 'encounterId', value: context.encounterId, type: 'equals' }]
    }
  }

  if (currentStage === 'codingReview') {
    if (context.codingReviewId) {
      return [{ key: '_id', value: context.codingReviewId, type: 'equals' }]
    }

    if (context.chargeId) {
      return [{ key: 'chargeId', value: context.chargeId, type: 'equals' }]
    }

    if (context.encounterId) {
      return [{ key: 'encounterId', value: context.encounterId, type: 'equals' }]
    }
  }

  if (currentStage === 'claim') {
    if (context.claimId) {
      return [{ key: '_id', value: context.claimId, type: 'equals' }]
    }

    if (context.chargeId) {
      return [{ key: 'chargeId', value: context.chargeId, type: 'equals' }]
    }

    if (context.encounterId) {
      return [{ key: 'encounterId', value: context.encounterId, type: 'equals' }]
    }

    if (context.closureStatus) {
      return [{ key: 'closureStatus', value: context.closureStatus, type: 'equals' }, ...scopedCriteria]
    }

    if (context.status) {
      return [{ key: 'claimStatus', value: context.status, type: 'equals' }, ...scopedCriteria]
    }

    if (context.patientId) {
      return [{ key: 'patientId', value: context.patientId, type: 'equals' }]
    }
  }

  if (currentStage === 'claimReadiness' && context.claimId) {
    return [{ key: '_id', value: context.claimId, type: 'equals' }]
  }

  if (currentStage === 'claimSubmission') {
    if (context.claimSubmissionId) {
      return [{ key: '_id', value: context.claimSubmissionId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }
  }

  if (currentStage === 'claimTracking') {
    if (context.claimTrackingId) {
      return [{ key: '_id', value: context.claimTrackingId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }
  }

  if (currentStage === 'eraEobProcessing') {
    if (context.eraEobProcessingId) {
      return [{ key: '_id', value: context.eraEobProcessingId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'matchedClaims.claimId', value: context.claimId, type: 'equals' }]
    }
  }

  if (currentStage === 'waitingForERA' && context.claimId) {
    return [{ key: 'matchedClaims.claimId', value: context.claimId, type: 'equals' }]
  }

  if (currentStage === 'paymentPosting') {
    if (context.paymentPostingId) {
      return [{ key: '_id', value: context.paymentPostingId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }
  }

  if (currentStage === 'denial') {
    if (context.denialId) {
      return [{ key: '_id', value: context.denialId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }

    if (context.denialStatus || context.status) {
      return [{ key: 'denialStatus', value: context.denialStatus ?? context.status ?? '', type: 'equals' }, ...scopedCriteria]
    }
  }

  if (currentStage === 'appeal') {
    if (context.appealId) {
      return [{ key: '_id', value: context.appealId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }

    if (context.appealStatus || context.status) {
      return [{ key: 'appealStatus', value: context.appealStatus ?? context.status ?? '', type: 'equals' }, ...scopedCriteria]
    }
  }

  if (currentStage === 'correctedClaim') {
    if (context.correctedClaimId) {
      return [{ key: '_id', value: context.correctedClaimId, type: 'equals' }]
    }

    if (context.denialId) {
      return [{ key: 'sourceDenialId', value: context.denialId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'originalClaimId', value: context.claimId, type: 'equals' }]
    }
  }

  if (currentStage === 'arWorkItem') {
    if (context.arWorkItemId) {
      return [{ key: '_id', value: context.arWorkItemId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }

    if (context.arStatus || context.status) {
      return [{ key: 'status', value: context.arStatus ?? context.status ?? '', type: 'equals' }, ...scopedCriteria]
    }
  }

  if (currentStage === 'patientBilling') {
    if (context.patientBillingId) {
      return [{ key: '_id', value: context.patientBillingId, type: 'equals' }]
    }

    if (context.claimId) {
      return [{ key: 'claimId', value: context.claimId, type: 'equals' }]
    }

    if (context.patientId) {
      return [{ key: 'patientId', value: context.patientId, type: 'equals' }]
    }
  }

  if (currentStage === 'collection') {
    if (context.collectionId) {
      return [{ key: '_id', value: context.collectionId, type: 'equals' }]
    }

    if (context.patientBillingId) {
      return [{ key: 'patientBillingId', value: context.patientBillingId, type: 'equals' }]
    }

    if (context.patientId) {
      return [{ key: 'patientId', value: context.patientId, type: 'equals' }]
    }
  }

  if (context.dashboardEntityId) {
    return [{ key: '_id', value: context.dashboardEntityId, type: 'equals' }]
  }

  if (context.dashboardQueue) {
    return []
  }

  return []
}
