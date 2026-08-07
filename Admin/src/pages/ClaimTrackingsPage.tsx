import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Activity, FileCheck2, FileCode2, FilePenLine, FileText, Navigation, ReceiptText, RotateCcw, Sparkles } from 'lucide-react'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { RcmOpsStatusPanel } from '@/components/rcm/RcmOpsStatusPanel'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig, CrudTableAction } from '@/types/crud'
import { createClaimTrackingFormConfig, createClaimTrackingTableColumns, mapClaimTrackingFormToPayload, mapClaimTrackingToFormValues, renderClaimTrackingDetails, renderClaimTrackingGridItem } from '@/models/claimTrackingModel'
import { useAnalyzeClaimTrackingRejectionMutation, useGetClaimTrackingsQuery } from '@/services/api/endpoints/claimTrackingsApi'
import { useGetClaimQuery, useGetClaimsQuery, useRefreshClaimStatusMutation } from '@/services/api/endpoints/claimsApi'
import { useCreateCorrectedClaimFromClaimMutation } from '@/services/api/endpoints/correctedClaimsApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Claim } from '@/types/claim'
import type { ClaimTracking, ClaimTrackingCreatePayload, ClaimTrackingFormValues, ClaimTrackingUpdatePayload } from '@/types/claimTracking'
import type { WorkflowContext } from '@/types/rcmWorkflow'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

type BulkDeletePayload = {
  ids: EntityId[]
}

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'created',
  direction: 'desc' as const,
  criteria: [],
}

function getTrackingSeverity(item: ClaimTracking): RcmSummarySeverity {
  if (isRejectedTracking(item)) {
    return 'danger'
  }

  if (isAcceptedTracking(item) || item.statusDescription || item.statusCode || item.payerClaimNumber) {
    return 'success'
  }

  return 'warning'
}

function normalizeTrackingStatus(value?: string | null) {
  return value?.trim().toUpperCase() ?? ''
}

function isRejectedTracking(item: ClaimTracking) {
  const normalizedStatus = normalizeTrackingStatus(item.normalizedStatus)
  return normalizedStatus === 'REJECTED' ||
    normalizedStatus === 'FAILED' ||
    Boolean(item.rejectionLevel) ||
    Boolean((item.rejectionReasonCodes ?? []).length) ||
    Boolean(item.statusDescription?.toLowerCase().includes('reject'))
}

function isAcceptedTracking(item: ClaimTracking) {
  if (isRejectedTracking(item)) {
    return false
  }

  const normalizedStatus = normalizeTrackingStatus(item.normalizedStatus)
  return normalizedStatus === 'ACCEPTED' ||
    Boolean(item.payerClaimNumber) ||
    Boolean(item.statusDescription?.toLowerCase().includes('accepted'))
}

function getTrackingWorkflowStatus(item: ClaimTracking) {
  return item.normalizedStatus ?? item.statusCode ?? item.statusDescription
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

export function ClaimTrackingsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const workflowClaimQuery = useGetClaimQuery(workflowContext.claimId ?? '', {
    skip: !workflowContext.claimId,
  })
  const [refreshClaimStatus, refreshClaimStatusState] = useRefreshClaimStatusMutation()
  const [createCorrectedClaimFromClaim, createCorrectedClaimState] = useCreateCorrectedClaimFromClaimMutation()
  const [analyzeRejection, analyzeRejectionState] = useAnalyzeClaimTrackingRejectionMutation()
  const returnTo = `${location.pathname}${location.search}`

  const claimsOptions = useMemo(
    () =>
      (claimsQuery.data?.data ?? []).map((item) => ({
        label: [item.claimDate, item.claimStatus, item.submissionStatus, item.batchId]
          .filter(Boolean)
          .join(' / ') || item._id,
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
  const formConfig = useMemo(() => {
    const baseConfig = createClaimTrackingFormConfig(referenceOptions)

    if (!workflowContext.claimId) {
      return baseConfig
    }

    return {
      ...baseConfig,
      defaultValues: {
        ...baseConfig.defaultValues,
        claimId: workflowContext.claimId,
      },
      fields: baseConfig.fields.map((field) =>
        field.name === 'claimId'
          ? {
              ...field,
              disabled: true,
              helperText: 'Claim is preselected from the workflow context.',
            }
          : field,
      ),
    }
  }, [referenceOptions, workflowContext.claimId])

  const crudConfig: CrudPageConfig<
    ClaimTracking,
    ClaimTrackingFormValues,
    ClaimTrackingCreatePayload,
    ClaimTrackingUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Claim Tracking / Rejections',
      resourceName: 'Claim Tracking',
      showCreateButton: false,
      createButtonLabel: 'Add Claim Tracking',
      createDialogTitle: 'Add claim tracking',
      editDialogTitle: 'Edit claim tracking',
      viewDialogTitle: 'Claim Tracking details',
      deleteDialogTitle: 'Delete claim tracking?',
      emptyMessage: 'No claim trackings found.',
      exportFileName: 'claim-trackings',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('claimTracking', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'claim-trackings',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) =>
        [item.claimControlNumber, item.payerClaimNumber, item.statusCode, item.rejectionLevel]
          .filter(Boolean)
          .join(' / ') || String(item._id),
      table: {
        columns: createClaimTrackingTableColumns(referenceOptions),
      },
      form: formConfig,
      api: {
        useListQuery: useGetClaimTrackingsQuery,
      },
      mapItemToFormValues: mapClaimTrackingToFormValues,
      mapFormValuesToCreatePayload: mapClaimTrackingFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapClaimTrackingFormToPayload(values),
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        rowActions: (item, defaultActions) => {
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const rowContext = mergeWorkflowContext(mergeClaimWorkflowStatus(workflowContext, claim), {
            claimId: item.claimId,
            claimSubmissionId: item.claimSubmissionId,
            claimTrackingId: item._id,
            trackingStatus: getTrackingWorkflowStatus(item),
            closureStatus: claim?.closureStatus ?? (isAcceptedTracking(item) ? 'AWAITING_ERA' : claim?.closureStatus),
            returnTo,
            returnLabel: 'Back to Claim Tracking',
          })

          const actions: Array<CrudTableAction<ClaimTracking>> = []

          if (item.claimId) {
            actions.push({
              label: 'Open Claim',
              icon: <Navigation className="h-4 w-4" />,
              onClick: () => navigate(`/rcm/claims${buildWorkflowSearch(rowContext)}`),
            })
          }

          if (isRejectedTracking(item) && item.claimId) {
            actions.push(
              {
                label: 'Fix Rejection',
                icon: <FilePenLine className="h-4 w-4" />,
                onClick: () => navigate(`/rcm/claims/${item.claimId}/readiness${buildWorkflowSearch(rowContext)}`),
              },
              {
                label: 'AI Rejection',
                icon: <Sparkles className="h-4 w-4" />,
                disabled: analyzeRejectionState.isLoading,
                loading: analyzeRejectionState.isLoading,
                onClick: async () => {
                  try {
                    await analyzeRejection(item._id).unwrap()
                    showToast({ severity: 'success', summary: 'AI rejection analysis completed' })
                  } catch (error) {
                    showToast({ severity: 'error', summary: 'AI analysis failed', detail: getApiErrorMessage(error) })
                  }
                },
              },
              {
                label: 'Create/View AR',
                icon: <ReceiptText className="h-4 w-4" />,
                onClick: () => navigate(`/rcm/ar-work-items${buildWorkflowSearch(rowContext)}`),
              },
              {
                label: 'Create Corrected Claim',
                icon: <FileCheck2 className="h-4 w-4" />,
                disabled: createCorrectedClaimState.isLoading,
                loading: createCorrectedClaimState.isLoading,
                onClick: async () => {
                  try {
                    const correctedClaim = await createCorrectedClaimFromClaim({
                      claimId: item.claimId as string,
                      correctionReason: item.nextActionRequired || item.statusDescription || 'Correct claim from 277CA rejection.',
                    }).unwrap()
                    showToast({ severity: 'success', summary: 'Corrected claim created' })
                    navigate(`/rcm/corrected-claims${buildWorkflowSearch(
                      mergeWorkflowContext(rowContext, {
                        correctedClaimId: correctedClaim._id,
                        claimId: correctedClaim.clonedClaimId ?? item.claimId,
                      }),
                    )}`)
                  } catch (error) {
                    showToast({ severity: 'error', summary: 'Corrected claim failed', detail: getApiErrorMessage(error) })
                  }
                },
              },
              {
                label: 'Resubmit',
                icon: <RotateCcw className="h-4 w-4" />,
                onClick: () => navigate(`/rcm/claims/${item.claimId}/readiness${buildWorkflowSearch(rowContext)}`),
              },
            )
          } else if (isAcceptedTracking(item)) {
            actions.push(
              {
                label: 'Open ERA/EOB',
                icon: <FileText className="h-4 w-4" />,
                onClick: () => navigate(`/rcm/era-eob-processings${buildWorkflowSearch(rowContext)}`),
              },
              {
                label: 'View Payment',
                icon: <ReceiptText className="h-4 w-4" />,
                onClick: () => navigate(`/rcm/payment-postings${buildWorkflowSearch(rowContext)}`),
              },
            )
          } else if (item.claimId) {
            actions.push({
              label: 'Refresh Status',
              icon: <Activity className="h-4 w-4" />,
              disabled: refreshClaimStatusState.isLoading,
              loading: refreshClaimStatusState.isLoading,
              onClick: async () => {
                try {
                  await refreshClaimStatus(item.claimId as string).unwrap()
                  showToast({ severity: 'success', summary: 'Tracking refreshed' })
                } catch (error) {
                  showToast({ severity: 'error', summary: 'Refresh failed', detail: getApiErrorMessage(error) })
                }
              },
            })
          }

          if (item.claimSubmissionId) {
            actions.push({
              label: 'Open Submission',
              icon: <FileCode2 className="h-4 w-4" />,
              onClick: () => navigate(`/rcm/claim-submissions${buildWorkflowSearch(rowContext)}`),
            })
          }

          return [...actions, ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View '))]
        },
        beforeContent: () => (
          <div className="space-y-3">
            <RcmOpsStatusPanel />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <WorkflowReturnButton context={workflowContext} />
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] hover:bg-[var(--color-hover)]"
              >
                Refresh tracking
              </button>
            </div>
            <WorkflowProgressTracker
              currentStage="claimTracking"
              context={workflowContextWithClaimStatus}
              inferActiveStageFromStatus
            />
          </div>
        ),
        viewContent: (item) => {
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const itemWorkflowContext = mergeWorkflowContext(mergeClaimWorkflowStatus(workflowContext, claim), {
                claimId: item.claimId,
                claimSubmissionId: item.claimSubmissionId,
                claimTrackingId: item._id,
            trackingStatus: getTrackingWorkflowStatus(item),
            closureStatus: claim?.closureStatus ?? (isAcceptedTracking(item) ? 'AWAITING_ERA' : claim?.closureStatus),
                returnTo,
                returnLabel: 'Back to Claim Tracking',
          })

          return (
          <div className="space-y-5">
            <RcmClaimLifecycleTimeline
              currentStage="claimTracking"
              claimLabel={item.claimControlNumber ?? item.claimId}
              context={itemWorkflowContext}
              statuses={{
                claim: claim?.claimStatus,
                claimReadiness: item.claimId ? 'READY' : undefined,
                claimSubmission: item.claimSubmissionId ? 'Submitted' : undefined,
                claimTracking: getTrackingWorkflowStatus(item),
                waitingForERA: isAcceptedTracking(item) ? claim?.closureStatus ?? 'WAITING_FOR_ERA' : undefined,
                eraEobProcessing: undefined,
                paymentPosting: claim?.paymentStatus,
                closed: claim?.closureStatus,
                arWorkItem: isRejectedTracking(item) ? 'OPEN' : undefined,
              }}
              nextAction={
                isRejectedTracking(item)
                  ? 'Fix rejection defects, create an AR work item, then generate or submit a corrected claim.'
                  : isAcceptedTracking(item)
                    ? 'Wait for or import 835 ERA, then validate payment posting.'
                    : 'Refresh status until 277CA or payer status is received.'
              }
            />
            <RcmViewSummary
              title="Claim tracking workflow"
              subtitle="Interprets payer acknowledgement, rejection signals, and the next RCM action."
              status={item.statusDescription || item.statusCode || '-'}
              severity={getTrackingSeverity(item)}
              facts={[
                ['Claim', referenceOptions.claims?.find((option) => option.value === item.claimId)?.label ?? item.claimId ?? '-'],
                ['Payer claim #', item.payerClaimNumber ?? '-'],
                ['Control #', item.claimControlNumber ?? item.clearinghouseTraceNumber ?? '-'],
              ]}
              journey={[
                {
                  label: 'Acknowledgement',
                  status: item.acknowledgementType ?? '-',
                  detail: item.receivedDate ? `Received ${new Date(item.receivedDate).toLocaleString()}` : 'No received date captured.',
                  severity: item.acknowledgementType ? 'success' : 'warning',
                },
                {
                  label: 'Payer status',
                  status: item.statusCode ?? '-',
                  detail: item.statusDescription || 'No payer status description captured.',
                  severity: getTrackingSeverity(item),
                },
                {
                  label: 'Rejection',
                  status: item.rejectionLevel || (item.rejectionReasonCodes ?? []).join(', ') || 'None',
                  detail: item.rejectionSource || 'No rejection source captured.',
                  severity: item.rejectionLevel || (item.rejectionReasonCodes ?? []).length ? 'danger' : 'success',
                },
                {
                  label: 'Next action',
                  status: item.nextActionRequired ? 'Required' : 'Monitor',
                  detail: item.nextActionRequired || 'Continue status tracking.',
                  severity: item.nextActionRequired ? 'warning' : 'success',
                },
              ]}
              alerts={item.nextActionRequired ? [{ title: 'Next action required', detail: item.nextActionRequired, severity: 'warning' }] : []}
              actions={[
                ...(item.claimId ? [
                  {
                    label: 'Open Claim',
                    helper: 'Go back to the source claim record.',
                    onClick: () => {
                      navigate(
                        `/rcm/claims${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: item.claimId,
                            claimTrackingId: item._id,
                            returnTo,
                            returnLabel: 'Back to Claim Tracking',
                          }),
                        )}`,
                      )
                    },
                  },
                  {
                    label: 'Open Readiness',
                    helper: isRejectedTracking(item)
                      ? 'Review readiness/remediation defects before resubmission.'
                      : 'Review deterministic readiness and claim status.',
                    onClick: () => {
                      navigate(
                        `/rcm/claims/${item.claimId}/readiness${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: item.claimId,
                            claimTrackingId: item._id,
                            returnTo,
                            returnLabel: 'Back to Claim Tracking',
                          }),
                        )}`,
                      )
                    },
                  },
                  {
                    label: 'Open AR Work Items',
                    helper: 'Review rejection or payer follow-up work generated for this claim.',
                    onClick: () => {
                      navigate(
                        `/rcm/ar-work-items${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: item.claimId,
                            claimTrackingId: item._id,
                            returnTo,
                            returnLabel: 'Back to Claim Tracking',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []),
                ...(item.claimSubmissionId ? [
                  {
                    label: 'Open Submission',
                    helper: 'Review the 837P submission, acknowledgement, and retry state.',
                    onClick: () => {
                      navigate(
                        `/rcm/claim-submissions${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: item.claimId,
                            claimSubmissionId: item.claimSubmissionId,
                            claimTrackingId: item._id,
                            returnTo,
                            returnLabel: 'Back to Claim Tracking',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []),
                ...(isAcceptedTracking(item) ? [
                  {
                    label: 'Open ERA / EOB',
                    helper: 'Accepted claims continue to payer adjudication and 835 ERA posting.',
                    onClick: () => {
                      navigate(
                        `/rcm/era-eob-processings${buildWorkflowSearch(
                          mergeWorkflowContext(itemWorkflowContext, {
                            claimId: item.claimId,
                            claimSubmissionId: item.claimSubmissionId,
                            claimTrackingId: item._id,
                            returnTo,
                            returnLabel: 'Back to Claim Tracking',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []),
              ]}
            />
            {renderClaimTrackingDetails(item, referenceOptions)}
          </div>
          )
        },
        gridItem: (item) => renderClaimTrackingGridItem(item, referenceOptions),
      },
    }),
    [analyzeRejection, analyzeRejectionState.isLoading, claimById, createCorrectedClaimFromClaim, createCorrectedClaimState.isLoading, formConfig, navigate, referenceOptions, refreshClaimStatus, refreshClaimStatusState.isLoading, returnTo, showToast, workflowContext, workflowContextWithClaimStatus],
  )

  return <CrudPage key={workflowKey || 'claim-trackings'} config={crudConfig} />
}
