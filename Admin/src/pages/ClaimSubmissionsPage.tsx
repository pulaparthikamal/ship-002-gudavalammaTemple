import { Activity, FileCode2, FilePenLine, Navigation, ReceiptText, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Dialog } from 'primereact/dialog'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { RcmOpsStatusPanel } from '@/components/rcm/RcmOpsStatusPanel'
import { ClaimComplianceCheckpoint } from '@/components/rcm/ClaimComplianceCheckpoint'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig, CrudTableAction } from '@/types/crud'
import { createClaimSubmissionFormConfig, createClaimSubmissionTableColumns, mapClaimSubmissionFormToPayload, mapClaimSubmissionToFormValues, renderClaimSubmissionDetails, renderClaimSubmissionGridItem } from '@/models/claimSubmissionModel'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetClaimSubmissionsQuery, useIngestX12AcknowledgementMutation, useRetryClaimSubmissionMutation, useGenerateX12AckMutation } from '@/services/api/endpoints/claimSubmissionsApi'
import { useGetClaimQuery, useGetClaimsQuery, useRefreshClaimStatusMutation } from '@/services/api/endpoints/claimsApi'
import { useGetClaimTrackingsQuery } from '@/services/api/endpoints/claimTrackingsApi'
import { useCreateCorrectedClaimFromClaimMutation } from '@/services/api/endpoints/correctedClaimsApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Claim } from '@/types/claim'
import type { ClaimSubmission, ClaimSubmissionCreatePayload, ClaimSubmissionFormValues, ClaimSubmissionUpdatePayload } from '@/types/claimSubmission'
import type { WorkflowContext, WorkflowFeedback } from '@/types/rcmWorkflow'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'

type BulkDeletePayload = {
  ids: EntityId[]
}

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

function canRetrySubmission(item: ClaimSubmission) {
  const statuses = getSubmissionStatuses(item)

  return Boolean(
    item.retryable ||
    statuses.includes('FAILED') ||
    statuses.includes('REJECTED'),
  )
}

function getSubmissionStatuses(item: ClaimSubmission) {
  return [item.acknowledgementStatus, item.normalizedStatus, item.transmissionStatus]
    .filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toUpperCase())
}

function hasSubmissionStatus(item: ClaimSubmission, statuses: string[]) {
  const expectedStatuses = new Set(statuses.map((status) => status.toUpperCase()))
  return getSubmissionStatuses(item).some((status) => expectedStatuses.has(status))
}

function isAcceptedSubmission(item: ClaimSubmission) {
  return hasSubmissionStatus(item, ['ACCEPTED', 'ACKNOWLEDGED', 'RECEIVED', 'TRANSMITTED'])
}

function getSubmissionSeverity(item: ClaimSubmission): RcmSummarySeverity {
  if (isAcceptedSubmission(item) || hasSubmissionStatus(item, ['PRINTED'])) {
    return 'success'
  }

  if (canRetrySubmission(item)) {
    return 'danger'
  }

  return 'warning'
}

function getSubmissionWorkflowStatus(item: ClaimSubmission) {
  return item.acknowledgementStatus ?? item.normalizedStatus ?? item.transmissionStatus
}

function mergeClaimWorkflowStatus(context: WorkflowContext, claim?: Claim): WorkflowContext {
  if (!claim) {
    return context
  }

  return mergeWorkflowContext(context, {
    claimId: claim._id,
    patientId: claim.patientId,
    payerId: claim.payerId,
    providerId: claim.renderingProviderId ?? claim.billingProviderId,
    facilityId: claim.facilityId,
    claimStatus: claim.claimStatus,
    submissionStatus: claim.submissionStatus,
    paymentStatus: claim.paymentStatus,
    closureStatus: claim.closureStatus,
  })
}

export function ClaimSubmissionsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null)
  const [x12Submission, setX12Submission] = useState<ClaimSubmission | null>(null)
  const [x12Payload, setX12Payload] = useState('')
  const [aiAck, setAiAck] = useState<{
    accepted999Ack: string
    accepted277Ack: string
    rejected277Ack: string
    acceptedAck: string
    rejectedAck: string
  } | null>(null)
  const [aiAckError, setAiAckError] = useState<string | null>(null)
  const [retryClaimSubmission, retryClaimSubmissionState] = useRetryClaimSubmissionMutation()
  const [ingestX12Acknowledgement, ingestX12State] = useIngestX12AcknowledgementMutation()
  const [generateX12Ack, generateX12AckState] = useGenerateX12AckMutation()
  const [refreshClaimStatus, refreshStatusState] = useRefreshClaimStatusMutation()
  const [createCorrectedClaimFromClaim, createCorrectedClaimState] = useCreateCorrectedClaimFromClaimMutation()
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const workflowClaimQuery = useGetClaimQuery(workflowContext.claimId ?? '', {
    skip: !workflowContext.claimId,
  })
  const claimTrackingsQuery = useGetClaimTrackingsQuery(lookupQuery)

  const claimsOptions = useMemo(
    () =>
      (claimsQuery.data?.data ?? []).map((item) => ({
        label: [item.claimDate, item.claimStatus, item.batchId].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [claimsQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      claims: claimsOptions,
    }),
    [claimsOptions],
  )
  const claimById = useMemo(() => {
    const nextClaimById = new Map<string, Claim>()

    for (const claim of claimsQuery.data?.data ?? []) {
      nextClaimById.set(claim._id, claim)
    }

    if (workflowClaimQuery.data) {
      nextClaimById.set(workflowClaimQuery.data._id, workflowClaimQuery.data)
    }

    return nextClaimById
  }, [claimsQuery.data, workflowClaimQuery.data])
  const workflowContextWithClaimStatus = useMemo(
    () => mergeClaimWorkflowStatus(
      workflowContext,
      workflowContext.claimId ? claimById.get(workflowContext.claimId) : undefined,
    ),
    [claimById, workflowContext],
  )
  const claimTrackingSummaryByClaimId = useMemo(() => {
    const trackingMap = new Map<string, { count: number; firstTrackingId: string }>()

    for (const tracking of claimTrackingsQuery.data?.data ?? []) {
      if (!tracking.claimId) {
        continue
      }

      const currentEntry = trackingMap.get(tracking.claimId)

      if (currentEntry) {
        trackingMap.set(tracking.claimId, {
          count: currentEntry.count + 1,
          firstTrackingId: currentEntry.firstTrackingId,
        })
        continue
      }

      trackingMap.set(tracking.claimId, {
        count: 1,
        firstTrackingId: tracking._id,
      })
    }

    return trackingMap
  }, [claimTrackingsQuery.data])
  const returnTo = `${location.pathname}${location.search}`

  const crudConfig: CrudPageConfig<
    ClaimSubmission,
    ClaimSubmissionFormValues,
    ClaimSubmissionCreatePayload,
    ClaimSubmissionUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Claim Submissions',
      resourceName: 'Claim Submission',
      help: {
        title: 'Claim Submissions',
        intro: 'Monitor submitted claims, parse payer acknowledgements, and move accepted submissions into ERA/EOB processing.',
        steps: [
          {
            label: 'Review submission status',
            icon: <Activity className="h-4 w-4" aria-hidden="true" />,
            description: 'Check the transmission status, acknowledgement status, errors, and tracking timeline for the submitted claim.',
          },
          {
            label: 'Parse X12 Acknowledgement',
            icon: <FileCode2 className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Test/Admin: Parse X12 Acknowledgement, paste or auto-fill the 999/277CA payload, and submit it to update acceptance or rejection status.',
          },
          {
            label: 'Open ERA/EOB',
            icon: <ReceiptText className="h-4 w-4" aria-hidden="true" />,
            description: 'When the submission is accepted, click Open ERA/EOB to continue to the ERA / EOB Processing screen for 835 payment or denial handling.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Claim Submission',
      createDialogTitle: 'Add claim submission',
      editDialogTitle: 'Edit claim submission',
      viewDialogTitle: 'Claim Submission details',
      deleteDialogTitle: 'Delete claim submission?',
      emptyMessage: 'No claim submissions found.',
      exportFileName: 'claim-submissions',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('claimSubmission', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'claim-submissions',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderClaimSubmissionGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createClaimSubmissionTableColumns(referenceOptions),
      },
      form: createClaimSubmissionFormConfig(referenceOptions),
      api: {
        useListQuery: useGetClaimSubmissionsQuery,
      },
      mapItemToFormValues: mapClaimSubmissionToFormValues,
      mapFormValuesToCreatePayload: mapClaimSubmissionFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapClaimSubmissionFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <RcmOpsStatusPanel />
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker
              currentStage="claimSubmission"
              context={workflowContextWithClaimStatus}
              inferActiveStageFromStatus
            />
            {workflowFeedback ? (
              <Message severity={workflowFeedback.severity} text={workflowFeedback.text} className="w-full justify-start" />
            ) : null}
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const trackingSummary = item.claimId ? claimTrackingSummaryByClaimId.get(item.claimId) : undefined
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const itemWorkflowContext = mergeWorkflowContext(mergeClaimWorkflowStatus(workflowContext, claim), {
            claimId: item.claimId,
            claimSubmissionId: item._id,
            submissionStatus: getSubmissionWorkflowStatus(item),
            claimTrackingId:
              trackingSummary?.count === 1
                ? trackingSummary.firstTrackingId
                : undefined,
            trackingStatus: trackingSummary ? getSubmissionWorkflowStatus(item) : undefined,
            dashboardQueue: undefined,
            dashboardEntityId: undefined,
            returnTo,
            returnLabel: 'Back to Claim Submissions',
          })
          const workflowActions: Array<CrudTableAction<ClaimSubmission>> = []

          if (canRetrySubmission(item)) {
            workflowActions.push({
              label: 'Retry Submission',
              icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
              disabled: retryClaimSubmissionState.isLoading,
              loading: retryClaimSubmissionState.isLoading,
              onClick: async (submission: ClaimSubmission) => {
                setWorkflowFeedback(null)

                try {
                  await retryClaimSubmission(submission._id).unwrap()
                  setWorkflowFeedback({
                    severity: 'success',
                    text: 'Claim submission retry started successfully.',
                  })
                } catch (error) {
                  setWorkflowFeedback({
                    severity: 'error',
                    text: getApiErrorMessage(error),
                  })
                }
              },
            })
          }

          if (item.claimId) {
            workflowActions.push(
              ...[
                {
                  label: 'Refresh Status',
                  icon: <Activity className="h-4 w-4" aria-hidden="true" />,
                  disabled: refreshStatusState.isLoading,
                  loading: refreshStatusState.isLoading,
                  onClick: async (submission: ClaimSubmission) => {
                    try {
                      await refreshClaimStatus(submission.claimId as string).unwrap()
                      setWorkflowFeedback({ severity: 'success', text: 'Claim status refreshed successfully.' })
                    } catch (error) {
                      setWorkflowFeedback({ severity: 'error', text: getApiErrorMessage(error) })
                    }
                  },
                },
                {
                  label: trackingSummary ? 'Go to Claim Tracking' : 'Open Claim Tracking',
                  icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
                  onClick: (submission: ClaimSubmission) => {
                    navigate(
                      `/rcm/claim-trackings${buildWorkflowSearch(
                        mergeWorkflowContext(itemWorkflowContext, {
                          claimId: submission.claimId,
                          claimSubmissionId: submission._id,
                          submissionStatus: getSubmissionWorkflowStatus(submission),
                          returnTo,
                          returnLabel: 'Back to Claim Submissions',
                        }),
                      )}`,
                    )
                  },
                },
                {
                  label: 'Open ERA/EOB',
                  icon: <ReceiptText className="h-4 w-4" aria-hidden="true" />,
                  disabled: !isAcceptedSubmission(item),
                  onClick: (submission: ClaimSubmission) => {
                    navigate(
                      `/rcm/era-eob-processings${buildWorkflowSearch(
                        mergeWorkflowContext(itemWorkflowContext, {
                          claimId: submission.claimId,
                          claimSubmissionId: submission._id,
                          submissionStatus: getSubmissionWorkflowStatus(submission),
                          closureStatus: claim?.closureStatus ?? 'AWAITING_ERA',
                          returnTo,
                          returnLabel: 'Back to Claim Submissions',
                        }),
                      )}`,
                    )
                  },
                },
                {
                  label: 'Create Corrected Claim',
                  icon: <FilePenLine className="h-4 w-4" aria-hidden="true" />,
                  disabled: !canRetrySubmission(item) || createCorrectedClaimState.isLoading,
                  loading: createCorrectedClaimState.isLoading,
                  onClick: async (submission: ClaimSubmission) => {
                    if (!submission.claimId) return
                    try {
                      const correctedClaim = await createCorrectedClaimFromClaim({
                        claimId: submission.claimId,
                        correctionReason: submission.submissionErrorMessage || 'Correct claim after rejected acknowledgement.',
                      }).unwrap()
                      setWorkflowFeedback({ severity: 'success', text: 'Corrected claim draft was created.' })
                      navigate(
                        `/rcm/corrected-claims${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: correctedClaim.clonedClaimId ?? submission.claimId,
                            claimSubmissionId: submission._id,
                            correctedClaimId: correctedClaim._id,
                            returnTo,
                            returnLabel: 'Back to Claim Submissions',
                          }),
                        )}`,
                      )
                    } catch (error) {
                      setWorkflowFeedback({ severity: 'error', text: getApiErrorMessage(error) })
                    }
                  },
                },
              ],
            )
          }

          workflowActions.push({
            label: 'Test/Admin: Parse X12 Acknowledgement',
            icon: <FileCode2 className="h-4 w-4" aria-hidden="true" />,
            disabled: ingestX12State.isLoading,
            loading: ingestX12State.isLoading,
            onClick: (submission: ClaimSubmission) => {
              setWorkflowFeedback(null)
              setX12Submission(submission)
              setX12Payload('')
              setAiAck(null)
              setAiAckError(null)
              if (submission.claimId) {
                void generateX12Ack({
                  claimId: submission.claimId,
                  claimSubmissionId: submission._id,
                }).unwrap()
                  .then(setAiAck)
                  .catch((error) => setAiAckError(getApiErrorMessage(error)))
              }
            },
          })

          return [...workflowActions, ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View '))]
        },
        viewContent: (item) => {
          const trackingSummary = item.claimId ? claimTrackingSummaryByClaimId.get(item.claimId) : undefined
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const itemWorkflowContext = mergeWorkflowContext(mergeClaimWorkflowStatus(workflowContext, claim), {
            claimId: item.claimId,
            claimSubmissionId: item._id,
            claimTrackingId: trackingSummary?.count === 1 ? trackingSummary.firstTrackingId : undefined,
            submissionStatus: getSubmissionWorkflowStatus(item),
            trackingStatus: trackingSummary ? getSubmissionWorkflowStatus(item) : undefined,
            closureStatus: claim?.closureStatus ?? (isAcceptedSubmission(item) ? 'AWAITING_ERA' : claim?.closureStatus),
            returnTo,
            returnLabel: 'Back to Claim Submissions',
          })

          return (
            <div className="space-y-5">
              <RcmClaimLifecycleTimeline
                currentStage="claimSubmission"
                claimLabel={item.claimId}
                context={itemWorkflowContext}
                statuses={{
                  claim: claim?.claimStatus ?? (item.claimId ? 'Submitted' : undefined),
                  claimSubmission: getSubmissionWorkflowStatus(item),
                  claimTracking: trackingSummary ? item.acknowledgementStatus ?? item.normalizedStatus : undefined,
                  waitingForERA: isAcceptedSubmission(item) ? claim?.closureStatus ?? 'WAITING_FOR_ERA' : undefined,
                  paymentPosting: claim?.paymentStatus,
                  closed: claim?.closureStatus,
                  arWorkItem: canRetrySubmission(item) ? 'OPEN' : undefined,
                }}
                nextAction={
                  canRetrySubmission(item)
                    ? 'Review acknowledgement remediation, correct the claim, and resubmit.'
                    : isAcceptedSubmission(item)
                      ? 'Wait for or import 835 ERA, then validate payment posting.'
                      : 'Refresh claim status or wait for clearinghouse webhook acknowledgement.'
                }
              />
              <ClaimComplianceCheckpoint
                claimId={item.claimId}
                title="Claim compliance checkpoint"
                subtitle="Shows the timely filing and documentation checks that should be clear before submission."
              />
              <RcmViewSummary
                title="Claim submission workflow"
                subtitle="Shows what was sent, how the payer/clearinghouse responded, and whether tracking exists."
                status={item.acknowledgementStatus || item.transmissionStatus || '-'}
                severity={getSubmissionSeverity(item)}
                facts={[
                  ['Claim', referenceOptions.claims?.find((option) => option.value === item.claimId)?.label ?? item.claimId ?? '-'],
                  ['Method', [item.submissionMethod, item.submissionFileType].filter(Boolean).join(' / ') || '-'],
                  ['Trace', item.submissionTraceId ?? item.clearinghouseTraceNumber ?? '-'],
                ]}
                journey={[
                  {
                    label: 'Payload',
                    status: item.payloadFormat ?? item.submissionFileType ?? '-',
                    detail: item.payloadSnapshot ? 'Submission payload snapshot is stored.' : 'No payload snapshot is available.',
                    severity: item.payloadSnapshot ? 'success' : 'warning',
                  },
                  {
                    label: 'Transmission',
                    status: item.transmissionStatus ?? '-',
                    detail: item.submissionErrorMessage || item.clearinghouseName || 'Waiting for transport response.',
                    severity: getSubmissionSeverity(item),
                  },
                  {
                    label: 'Acknowledgement',
                    status: item.acknowledgementStatus ?? '-',
                    detail: item.acknowledgementType || 'Parse or ingest acknowledgement to update status.',
                    severity: hasSubmissionStatus(item, ['REJECTED', 'FAILED']) ? 'danger' : item.acknowledgementStatus ? 'success' : 'warning',
                  },
                  {
                    label: 'Tracking',
                    status: trackingSummary ? `${trackingSummary.count} record${trackingSummary.count === 1 ? '' : 's'}` : 'Not opened',
                    detail: trackingSummary ? 'Claim tracking/rejection work is available.' : 'Open claim tracking after acknowledgement.',
                    severity: trackingSummary ? 'success' : 'neutral',
                  },
                ]}
                alerts={[
                  ...(item.submissionErrorMessage ? [{ title: item.submissionErrorCode || 'Submission error', detail: item.submissionErrorMessage, severity: 'danger' as const }] : []),
                  ...(canRetrySubmission(item) ? [{ title: 'Retry available', detail: 'This submission can be retried after the claim is corrected or transport issue is resolved.', severity: 'warning' as const }] : []),
                ]}
                actions={item.claimId ? [
                  {
                    label: trackingSummary ? 'Open Claim Tracking' : 'Start Claim Tracking',
                    helper: 'Go to payer acknowledgement and rejection tracking for this claim.',
                    onClick: () => {
                      navigate(
                        `/rcm/claim-trackings${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: item.claimId,
                            claimSubmissionId: item._id,
                            claimTrackingId:
                              trackingSummary?.count === 1
                                ? trackingSummary.firstTrackingId
                                : undefined,
                            dashboardQueue: undefined,
                            dashboardEntityId: undefined,
                            returnTo,
                            returnLabel: 'Back to Claim Submissions',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []}
              />
              {renderClaimSubmissionDetails(item, referenceOptions)}
            </div>
          )
        },
        gridItem: (item) => renderClaimSubmissionGridItem(item, referenceOptions),
      },
    }),
    [
      claimById,
      claimTrackingSummaryByClaimId,
      createCorrectedClaimFromClaim,
      createCorrectedClaimState.isLoading,
      navigate,
      referenceOptions,
      refreshClaimStatus,
      refreshStatusState.isLoading,
      retryClaimSubmission,
      retryClaimSubmissionState.isLoading,
      returnTo,
      workflowContext,
      workflowContextWithClaimStatus,
      workflowFeedback,
      ingestX12State.isLoading,
      generateX12AckState.isLoading,
      generateX12Ack,
    ],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'claim-submissions'} config={crudConfig} />

      <Dialog
        visible={Boolean(x12Submission)}
        header="Parse native X12 acknowledgement"
        modal
        draggable={false}
        resizable={false}
        className="crud-view-dialog"
        maskClassName="crud-form-dialog-mask"
        style={{ width: 'min(96vw, 54rem)' }}
        onHide={() => { setX12Submission(null); setAiAck(null); setAiAckError(null) }}
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--color-text-muted)]">
            Paste a 999, 277CA, or 835 payload. The parser will match by submission trace or claim control number and update tracking.
          </p>

          {/* AI-generated scenarios */}
          {generateX12AckState.isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-3 text-xs text-[var(--color-text-muted)]">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Generating X12 acknowledgements from claim data…
            </div>
          ) : aiAckError ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-700 dark:bg-red-950 dark:text-red-300">
              Acknowledgement generation failed: {aiAckError}. You can still paste a payload manually below.
            </div>
          ) : aiAck ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-[var(--color-text-strong)]">Generated scenarios — click to fill:</p>
              {([
                { label: 'Accepted 999 functional acknowledgement', value: aiAck.accepted999Ack },
                { label: 'Accepted 277CA claim acknowledgement', value: aiAck.accepted277Ack },
                { label: 'Rejected 277CA claim acknowledgement', value: aiAck.rejected277Ack },
              ] as Array<{ label: string; value?: string }>)
                .filter((scenario): scenario is { label: string; value: string } => typeof scenario.value === 'string' && scenario.value.trim().length > 0)
                .map((scenario) => (
                <button
                  key={scenario.label}
                  type="button"
                  onClick={() => setX12Payload(scenario.value)}
                  className={[
                    'w-full rounded-lg border px-3 py-2 text-left text-[11px] font-mono leading-5 transition-colors',
                    x12Payload === scenario.value
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] hover:border-[var(--color-primary)] hover:text-[var(--color-text-strong)]',
                  ].join(' ')}
                >
                  <span className="block mb-0.5 font-sans font-semibold not-italic text-[var(--color-text-strong)]">{scenario.label}</span>
                  <span className="line-clamp-2">{scenario.value.slice(0, 120)}…</span>
                </button>
              ))}
            </div>
          ) : null}

          <textarea
            value={x12Payload}
            onChange={(event) => setX12Payload(event.target.value)}
            placeholder="ISA*00*...~GS*...~ST*277..."
            className="min-h-56 w-full resize-y rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => { setX12Submission(null); setAiAck(null); setAiAckError(null) }}
              className="min-h-9 rounded-md border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!x12Payload.trim() || ingestX12State.isLoading || !x12Submission}
              onClick={async () => {
                if (!x12Submission) return
                try {
                  await ingestX12Acknowledgement({
                    x12Payload,
                    claimControlNumber: x12Submission.claimControlNumber,
                    submissionTraceId: x12Submission.submissionTraceId,
                  }).unwrap()
                  setWorkflowFeedback({ severity: 'success', text: 'Native X12 acknowledgement processed successfully.' })
                  setX12Submission(null)
                  setAiAck(null)
                  setAiAckError(null)
                } catch (error) {
                  setWorkflowFeedback({ severity: 'error', text: getApiErrorMessage(error) })
                }
              }}
              className="min-h-9 rounded-md bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--color-primary-hover)] disabled:opacity-60"
            >
              Parse acknowledgement
            </button>
          </div>
        </div>
      </Dialog>
    </>
  )
}
