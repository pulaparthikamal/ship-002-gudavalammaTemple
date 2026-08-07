import { AlertTriangle, CheckCircle2, Circle, Clock3, Route, XCircle } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { buildWorkflowRuntimeStages } from '@/utils/rcmWorkflow'
import { cn } from '@/utils/classNames'
import type { WorkflowContext, WorkflowStageKey, WorkflowStageRuntime } from '@/types/rcmWorkflow'

export interface RcmClaimLifecycleStatusMap {
  claim?: string
  claimReadiness?: string | boolean
  claimSubmission?: string
  claimTracking?: string
  waitingForERA?: string
  eraEobProcessing?: string
  paymentPosting?: string
  denial?: string
  appeal?: string
  correctedClaim?: string
  arWorkItem?: string
  patientBilling?: string
  collection?: string
  closed?: string
}

interface RcmClaimLifecycleTimelineProps {
  title?: string
  claimLabel?: string
  patientLabel?: string
  context: WorkflowContext
  currentStage?: WorkflowStageKey
  statuses?: RcmClaimLifecycleStatusMap
  nextAction?: string
  compact?: boolean
}

function stageIcon(stage: WorkflowStageRuntime) {
  if (stage.state === 'completed') return <CheckCircle2 className="h-4 w-4" />
  if (stage.state === 'blocked') return <XCircle className="h-4 w-4" />
  return <Circle className="h-4 w-4" />
}

function stateClass(stage: WorkflowStageRuntime, isCurrent: boolean) {
  if (isCurrent) {
    return 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
  }

  if (stage.state === 'completed') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  }

  if (stage.state === 'blocked') {
    return 'border-red-200 bg-red-50 text-red-700'
  }

  return 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
}

function firstActionableStage(stages: WorkflowStageRuntime[]) {
  return stages.find((stage) => stage.state === 'blocked') ?? stages.find((stage) => stage.state === 'pending')
}

const optionalBranchStages = new Set<WorkflowStageKey>([
  'denial',
  'appeal',
  'correctedClaim',
  'arWorkItem',
  'patientBilling',
  'collection',
])

const stageContextMap: Record<WorkflowStageKey, keyof WorkflowContext> = {
  appointment: 'appointmentId',
  encounter: 'encounterId',
  charge: 'chargeId',
  codingReview: 'codingReviewId',
  claim: 'claimId',
  claimReadiness: 'claimId',
  claimSubmission: 'claimSubmissionId',
  claimTracking: 'claimTrackingId',
  waitingForERA: 'eraEobProcessingId',
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

function hasBranchSignal(stage: WorkflowStageRuntime, context: WorkflowContext) {
  const idKey = stageContextMap[stage.key]
  return Boolean(stage.status || context[idKey])
}

function isStageVisible(stage: WorkflowStageRuntime, currentStage: WorkflowStageKey | undefined, context: WorkflowContext) {
  if (stage.key === currentStage || !optionalBranchStages.has(stage.key)) {
    return true
  }

  return hasBranchSignal(stage, context)
}

function completePreviousPendingStages(stages: WorkflowStageRuntime[], currentStage: WorkflowStageKey | undefined, context: WorkflowContext) {
  const currentIndex = currentStage ? stages.findIndex((stage) => stage.key === currentStage) : -1

  if (currentIndex <= 0) {
    return stages
  }

  return stages.map((stage, index) => {
    if (
      index < currentIndex &&
      stage.state === 'pending' &&
      (!optionalBranchStages.has(stage.key) || hasBranchSignal(stage, context))
    ) {
      return {
        ...stage,
        state: 'completed' as const,
        reason: undefined,
      }
    }

    return stage
  })
}

function normalizeStatus(value?: string) {
  return value?.trim().toUpperCase() ?? ''
}

function hasStageRecord(stage: WorkflowStageRuntime, context: WorkflowContext) {
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

  return Boolean(context[stageContextMap[stage.key]])
}

export function RcmClaimLifecycleTimeline({
  title = 'Claim lifecycle',
  claimLabel,
  patientLabel,
  context,
  currentStage,
  statuses = {},
  nextAction,
  compact = false,
}: RcmClaimLifecycleTimelineProps) {
  const navigate = useNavigate()
  const stages = completePreviousPendingStages(
    buildWorkflowRuntimeStages(context, statuses),
    currentStage,
    context,
  ).filter((stage) => isStageVisible(stage, currentStage, context))
  const currentStageIndex = currentStage ? stages.findIndex((stage) => stage.key === currentStage) : -1
  const actionableStage = firstActionableStage(currentStageIndex >= 0 ? stages.slice(currentStageIndex) : stages)
  const currentStageKey = currentStage ?? actionableStage?.key
  const actionText = nextAction ?? actionableStage?.reason ?? actionableStage?.allowedNextActions[0] ?? 'Monitor claim lifecycle'

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-[var(--color-text-strong)]">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {[patientLabel, claimLabel].filter(Boolean).join(' | ') || 'Guided post-submission RCM workflow'}
          </p>
        </div>
        <div className="flex max-w-xl items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">Next recommended action</p>
            <p>{actionText}</p>
          </div>
        </div>
      </div>

      <div className={cn('mt-4 grid gap-2', compact ? 'md:grid-cols-4 xl:grid-cols-6' : 'md:grid-cols-3 xl:grid-cols-5')}>
        {stages.map((stage) => {
          const isCurrent = stage.key === currentStageKey
          const canNavigate = hasStageRecord(stage, context)

          return (
            <button
              key={stage.key}
              type="button"
              disabled={!canNavigate}
              title={canNavigate ? `Open ${stage.label}` : `${stage.label} is not available until this workflow record is created.`}
              className={cn(
                'min-h-24 rounded-lg border p-3 text-left transition hover:shadow-sm',
                stateClass(stage, isCurrent),
                !canNavigate && 'cursor-not-allowed opacity-60 hover:shadow-none',
              )}
              onClick={() => {
                if (canNavigate) {
                  navigate(stage.routeWithContext)
                }
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {stageIcon(stage)}
                  <p className="truncate text-sm font-semibold">{stage.label}</p>
                </div>
                <span className="rounded-full bg-white/70 px-2 py-0.5 text-[10px] font-semibold uppercase">
                  {stage.state}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs opacity-90">{stage.description}</p>
              <p className="mt-2 truncate text-xs font-semibold">{stage.status ?? stage.allowedNextActions[0] ?? '-'}</p>
            </button>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Completed</span>
        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5 text-amber-600" /> Pending</span>
        <span className="inline-flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-red-600" /> Blocked</span>
      </div>
    </section>
  )
}
