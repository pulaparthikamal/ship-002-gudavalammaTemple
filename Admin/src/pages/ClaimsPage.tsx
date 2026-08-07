import { Brain, ClipboardCheck, Lock, Navigation, RotateCcw, ShieldAlert, Wand2 } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { ClaimTransmissionAudit } from '@/components/rcm/ClaimTransmissionAudit'
import { ClaimDenialPredictionModal } from '@/components/rcm/ClaimDenialPredictionModal'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import { CrudPage } from '@/components/crud/CrudPage'
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog'
import type { CrudPageConfig } from '@/types/crud'
import { createClaimFormConfig, createClaimTableColumns, getClaimRowLabel, mapClaimFormToPayload, mapClaimToFormValues, renderClaimDetails, renderClaimGridItem } from '@/models/claimModel'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetClaimSubmissionsQuery } from '@/services/api/endpoints/claimSubmissionsApi'
import { useAnalyzeClaimRejectionMutation, useBulkDeleteClaimsMutation, useCloseClaimMutation, useCreateClaimMutation, useDeleteClaimMutation, useGetClaimRejectionsQuery, useGetClaimsQuery, usePredictClaimDenialMutation, useSubmitClaimMutation, useUpdateClaimMutation } from '@/services/api/endpoints/claimsApi'
import { useGetClaimPredictionsQuery } from '@/services/api/endpoints/claimPredictionsApi'
import { useGetChargesQuery } from '@/services/api/endpoints/chargesApi'
import { useGetEncountersQuery } from '@/services/api/endpoints/encountersApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { EntityId } from '@/types/common'
import type { CrudTableAction } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { WorkflowFeedback } from '@/types/rcmWorkflow'
import type { Claim, ClaimCreatePayload, ClaimDenialPredictionPayload, ClaimDenialPredictionResult, ClaimFormValues, ClaimUpdatePayload } from '@/types/claim'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'
import { claimScrubber } from '@/utils/claimScrubber'

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

function canSubmitClaim(item: Claim) {
  const diagnosisCodeCount = (item.diagnosisCodes ?? []).filter((code) => Boolean(code?.trim())).length
  const hasReadyClaimLines =
    item.claimLines.length > 0 &&
    item.claimLines.every(
      (line) =>
        Boolean(line.cptCode?.trim()) &&
        Array.isArray(line.icdPointers) &&
        line.icdPointers.length > 0 &&
        line.icdPointers.every((pointer) => pointer >= 1 && pointer <= diagnosisCodeCount) &&
        typeof line.units === 'number' &&
        line.units > 0 &&
        typeof line.chargeAmount === 'number' &&
        line.chargeAmount > 0 &&
        Boolean(line.renderingProviderId?.trim()) &&
        Boolean(line.placeOfService?.trim()) &&
        Boolean(line.serviceDateFrom) &&
        (!line.serviceDateTo || !line.serviceDateFrom || new Date(line.serviceDateTo) >= new Date(line.serviceDateFrom)),
    )

  return (
    (item.claimStatus === 'Draft' || item.claimStatus === 'Ready for Submission' || item.claimStatus === 'On Hold')
    && item.scrubStatus === 'Passed'
    && item.submissionStatus === 'Not Submitted'
    && Boolean(item.claimDate)
    && typeof item.totalChargeAmount === 'number'
    && item.totalChargeAmount > 0
    && Boolean(item.payerId?.trim())
    && Boolean(item.billingProviderId?.trim())
    && Boolean(item.renderingProviderId?.trim())
    && Boolean(item.facilityId?.trim())
    && diagnosisCodeCount > 0
    && (!item.correctedClaimIndicator || Boolean(item.originalClaimId?.trim()))
    && hasReadyClaimLines
  )
}

function canEditClaim(item: Claim, linkedClaimSubmissionId?: string) {
  if (item.claimStatus === 'Rejected' || item.submissionStatus === 'Rejected') {
    return true
  }

  return !linkedClaimSubmissionId &&
    ['Draft', 'Ready for Submission', 'Rejected', 'On Hold'].includes(item.claimStatus ?? '') &&
    ['Not Submitted', 'Failed', 'Rejected'].includes(item.submissionStatus ?? '')
}

function canDeleteClaim(item: Claim, linkedClaimSubmissionId?: string) {
  return !linkedClaimSubmissionId &&
    item.claimStatus === 'Draft' &&
    item.submissionStatus === 'Not Submitted'
}

function getClaimStatusSeverity(item: Claim, linkedClaimSubmissionId?: string): RcmSummarySeverity {
  if (linkedClaimSubmissionId || ['Submitted', 'Accepted', 'Paid'].includes(item.claimStatus ?? '') || ['Submitted', 'Transmitted', 'Acknowledged'].includes(item.submissionStatus ?? '')) {
    return 'success'
  }

  if (item.claimStatus === 'Rejected' || item.submissionStatus === 'Rejected' || item.submissionStatus === 'Failed') {
    return 'danger'
  }

  if (canSubmitClaim(item)) {
    return 'warning'
  }

  return 'neutral'
}

function buildDenialPredictionPayload(claim: Claim, referenceOptions: RcmReferenceOptions): ClaimDenialPredictionPayload {
  const claimLines = claim.claimLines ?? []
  const providerLabel = referenceOptions.providers?.find((option) => option.value === claim.renderingProviderId)?.label
  const billingProviderLabel = referenceOptions.providers?.find((option) => option.value === claim.billingProviderId)?.label
  const payerLabel = referenceOptions.payers?.find((option) => option.value === claim.payerId)?.label
  const patientLabel = referenceOptions.patients?.find((option) => option.value === claim.patientId)?.label
  const facilityLabel = referenceOptions.facilities?.find((option) => option.value === claim.facilityId)?.label
  const dateOfService = claimLines.find((line) => line.serviceDateFrom)?.serviceDateFrom

  return {
    patientDetails: {
      patientId: claim.patientId,
      patient: patientLabel,
    },
    providerDetails: {
      billingProviderId: claim.billingProviderId,
      billingProvider: billingProviderLabel,
      renderingProviderId: claim.renderingProviderId,
      renderingProvider: providerLabel,
      facilityId: claim.facilityId,
      facility: facilityLabel,
    },
    insuranceDetails: {
      payerId: claim.payerId,
      payer: payerLabel,
      coveragePriority: claim.coveragePriority,
    },
    cptCodes: claimLines.map((line) => line.cptCode).filter((code): code is string => Boolean(code?.trim())),
    icdCodes: claim.diagnosisCodes ?? [],
    modifiers: Array.from(new Set(claimLines.flatMap((line) => line.modifiers ?? []).filter(Boolean))),
    authorizationInfo: {
      correctedClaimIndicator: claim.correctedClaimIndicator,
      originalClaimId: claim.originalClaimId,
      frequencyCode: claim.frequencyCode,
    },
    claimAmount: claim.totalChargeAmount,
    dateOfService: typeof dateOfService === 'string' ? dateOfService : dateOfService?.toISOString(),
    demographics: {
      patientId: claim.patientId,
    },
    claimNotes: [
      `Claim status: ${claim.claimStatus ?? 'Unknown'}`,
      `Scrub status: ${claim.scrubStatus ?? 'Unknown'}`,
      `Submission status: ${claim.submissionStatus ?? 'Unknown'}`,
      claim.rejectionReason ? `Existing issue: ${claim.rejectionReason}` : '',
    ].filter(Boolean).join('. '),
  }
}

export function ClaimsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null)
  const [predictClaimDenial, predictClaimDenialState] = usePredictClaimDenialMutation()
  const [analyzeClaimRejection, analyzeClaimRejectionState] = useAnalyzeClaimRejectionMutation()
  const [submitClaim, submitClaimState] = useSubmitClaimMutation()
  const [closeClaim, closeClaimState] = useCloseClaimMutation()

  const [showDenialPredictionModal, setShowDenialPredictionModal] = useState(false)
  const [denialPrediction, setDenialPrediction] = useState<ClaimDenialPredictionResult | null>(null)
  const [denialPredictionError, setDenialPredictionError] = useState<string | null>(null)
  const [claimReasonAction, setClaimReasonAction] = useState<{ type: 'close'; claim: Claim } | null>(null)
  const [claimActionReason, setClaimActionReason] = useState('')
  const predictionClaimRef = useRef<Claim | null>(null)
  const claimSubmissionsQuery = useGetClaimSubmissionsQuery(lookupQuery)
  const chargesQuery = useGetChargesQuery(lookupQuery)
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const encountersQuery = useGetEncountersQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)

  const openClaimReasonAction = useCallback((type: 'close', claim: Claim) => {
    setClaimReasonAction({ type, claim })
    setClaimActionReason('')
  }, [])

  const closeClaimReasonAction = useCallback(() => {
    if (closeClaimState.isLoading) {
      return
    }

    setClaimReasonAction(null)
    setClaimActionReason('')
  }, [closeClaimState.isLoading])

  const submitClaimReasonAction = useCallback(async () => {
    const reason = claimActionReason.trim()
    if (!claimReasonAction || !reason) return

    try {
      await closeClaim({ id: claimReasonAction.claim._id, reason }).unwrap()
      setWorkflowFeedback({ severity: 'success', text: 'Claim closed after passing closure criteria.' })
      setClaimReasonAction(null)
      setClaimActionReason('')
    } catch (error) {
      setWorkflowFeedback({ severity: 'error', text: getApiErrorMessage(error) })
    }
  }, [claimActionReason, claimReasonAction, closeClaim])

  const chargesOptions = useMemo(
    () =>
      (chargesQuery.data?.data ?? []).map((item) => ({
        label: [item.serviceDate, item.chargeStatus].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [chargesQuery.data],
  )
  const claimsOptions = useMemo(
    () =>
      (claimsQuery.data?.data ?? []).map((item) => ({
        label: [item.claimDate, item.claimStatus, item.batchId].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [claimsQuery.data],
  )
  const encountersOptions = useMemo(
    () =>
      (encountersQuery.data?.data ?? []).map((item) => ({
        label: [item.encounterDate, item.visitStatus].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [encountersQuery.data],
  )
  const facilitiesOptions = useMemo(
    () =>
      (facilitiesQuery.data?.data ?? []).map((item) => ({
        label: item.facilityName || item.facilityCode || item._id,
        value: item._id,
      })),
    [facilitiesQuery.data],
  )
  const patientsOptions = useMemo(
    () =>
      (patientsQuery.data?.data ?? []).map((item) => ({
        label: `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        value: item._id,
      })),
    [patientsQuery.data],
  )
  const payersOptions = useMemo(
    () =>
      (payersQuery.data?.data ?? []).map((item) => ({
        label: item.payerName ? `${item.payerName} (${item.payerId ?? item._id})` : item.payerId ?? item._id,
        value: item.payerId ?? item._id,
      })),
    [payersQuery.data],
  )
  const providersOptions = useMemo(
    () =>
      (providersQuery.data?.data ?? []).map((item) => ({
        label: [item.firstName, item.lastName, item.credentials].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [providersQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      charges: chargesOptions,
      claims: claimsOptions,
      encounters: encountersOptions,
      facilities: facilitiesOptions,
      patients: patientsOptions,
      payers: payersOptions,
      providers: providersOptions,
    }),
    [chargesOptions, claimsOptions, encountersOptions, facilitiesOptions, patientsOptions, payersOptions, providersOptions],
  )
  const claimSubmissionIdByClaimId = useMemo(() => {
    const submissionMap = new Map<string, string>()

    for (const submission of claimSubmissionsQuery.data?.data ?? []) {
      if (!submission.claimId) {
        continue
      }

      const currentSubmissionId = submissionMap.get(submission.claimId)

      if (!currentSubmissionId) {
        submissionMap.set(submission.claimId, submission._id)
      }
    }

    return submissionMap
  }, [claimSubmissionsQuery.data])
  const returnTo = `${location.pathname}${location.search}`

  const runDenialPrediction = useCallback(
    async (claim: Claim) => {
      setWorkflowFeedback(null)
      setDenialPrediction(null)
      setDenialPredictionError(null)
      setShowDenialPredictionModal(true)
      predictionClaimRef.current = claim

      try {
        const result = await predictClaimDenial(buildDenialPredictionPayload(claim, referenceOptions)).unwrap()
        setDenialPrediction(result)
      } catch (error) {
        setDenialPredictionError(getApiErrorMessage(error))
      }
    },
    [predictClaimDenial, referenceOptions],
  )

  const retryDenialPrediction = useCallback(() => {
    const claim = predictionClaimRef.current

    if (claim) {
      void runDenialPrediction(claim)
    }
  }, [runDenialPrediction])

  const runRejectionAnalysis = useCallback(
    async (claim: Claim) => {
      setWorkflowFeedback(null)

      try {
        const result = await analyzeClaimRejection(claim._id).unwrap()
        setWorkflowFeedback({
          severity: 'success',
          text: `AI suggestion: ${result.rootCause}. ${result.suggestion} Confidence ${result.confidence}%.`,
        })
      } catch (error) {
        setWorkflowFeedback({ severity: 'error', text: getApiErrorMessage(error) })
      }
    },
    [analyzeClaimRejection],
  )

  const runResubmission = useCallback(
    async (claim: Claim) => {
      setWorkflowFeedback(null)

      try {
        const result = await submitClaim(claim._id).unwrap()
        const rejected = result.claim.claimStatus === 'Rejected' || result.claim.submissionStatus === 'Rejected'
        setWorkflowFeedback({
          severity: rejected ? 'warn' : 'success',
          text: rejected
            ? `Claim rejected again. ${result.claim.rejectionReason ?? 'Review rejection details.'}`
            : `Claim resubmitted with status ${result.claim.submissionStatus ?? result.trackingStatus ?? 'submitted'}.`,
        })
      } catch (error) {
        setWorkflowFeedback({ severity: 'error', text: getApiErrorMessage(error) })
      }
    },
    [submitClaim],
  )

  const crudConfig: CrudPageConfig<
    Claim,
    ClaimFormValues,
    ClaimCreatePayload,
    ClaimUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Claims',
      resourceName: 'Claim',
      help: {
        title: 'Claims',
        intro: 'Use this queue to inspect claims from approved coding reviews and open the readiness workflow before submission.',
        steps: [
          {
            label: 'Review claim details',
            icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
            description: 'Confirm patient, payer, providers, facility, claim lines, billed amounts, and claim status.',
          },
          {
            label: 'Claim Readiness',
            icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Claim Readiness on the claim row to validate eligibility, pricing, authorization, referral, and submission readiness.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Claim',
      createDialogTitle: 'Add claim',
      editDialogTitle: 'Edit claim',
      viewDialogTitle: 'Claim details',
      deleteDialogTitle: 'Delete claim?',
      emptyMessage: 'No claims found.',
      exportFileName: 'claims',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'claimDate',
        direction: 'desc',
        criteria: buildWorkflowCriteria('claim', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'claims',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getClaimRowLabel(item, referenceOptions),
      table: {
        columns: createClaimTableColumns(referenceOptions),
      },
      form: createClaimFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteClaimsMutation,
        useListQuery: useGetClaimsQuery,
        useCreateMutation: useCreateClaimMutation,
        useUpdateMutation: useUpdateClaimMutation,
        useDeleteMutation: useDeleteClaimMutation,
      },
      mapItemToFormValues: mapClaimToFormValues,
      mapFormValuesToCreatePayload: mapClaimFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapClaimFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected claims?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'claim' : 'claims'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'claim' : 'claims'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="claim" context={workflowContext} />
            {workflowFeedback ? (
              <Message severity={workflowFeedback.severity} text={workflowFeedback.text} className="w-full justify-start" />
            ) : null}
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const workflowActions: Array<CrudTableAction<Claim>> = []
          const linkedClaimSubmissionId = claimSubmissionIdByClaimId.get(item._id)
          const safeDefaultActions = defaultActions.filter((action) => {
            const label = typeof action.label === 'string' ? action.label.toLowerCase() : ''

            if (label.includes('edit') && !canEditClaim(item, linkedClaimSubmissionId)) {
              return false
            }

            if (label.includes('delete') && !canDeleteClaim(item, linkedClaimSubmissionId)) {
              return false
            }

            return true
          })

          if (linkedClaimSubmissionId) {
            workflowActions.push({
              label: 'Go to Claim Submission',
              icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
              onClick: (claim) => {
                navigate(
                  `/rcm/claim-submissions${buildWorkflowSearch(
                    mergeWorkflowContext(workflowContext, {
                      claimId: claim._id,
                      claimSubmissionId: linkedClaimSubmissionId,
                      dashboardQueue: undefined,
                      dashboardEntityId: undefined,
                      returnTo,
                      returnLabel: 'Back to Claims',
                    }),
                  )}`,
                )
              },
            })
            if (item.claimStatus === 'Rejected' || item.submissionStatus === 'Rejected') {
              workflowActions.push({
                label: 'AI Root Cause',
                icon: <Brain className="h-4 w-4" aria-hidden="true" />,
                disabled: analyzeClaimRejectionState.isLoading,
                loading: analyzeClaimRejectionState.isLoading,
                onClick: (claim) => {
                  void runRejectionAnalysis(claim)
                },
              })
              workflowActions.push({
                label: 'Correct & Resubmit',
                icon: <RotateCcw className="h-4 w-4" aria-hidden="true" />,
                disabled: submitClaimState.isLoading,
                loading: submitClaimState.isLoading,
                onClick: (claim) => {
                  void runResubmission(claim)
                },
              })
            }
          } else {
            workflowActions.push({
              label: 'Claim Readiness',
              icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
              onClick: (claim) => {
                navigate(
                  `/rcm/claims/${claim._id}/readiness${buildWorkflowSearch(
                    mergeWorkflowContext(workflowContext, {
                      claimId: claim._id,
                      dashboardQueue: undefined,
                      dashboardEntityId: undefined,
                      returnTo,
                      returnLabel: 'Back to Claims',
                    }),
                  )}`,
                )
              },
            })
            workflowActions.push({
              label: 'Predict Denial Risk',
              icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
              disabled: predictClaimDenialState.isLoading,
              loading: predictClaimDenialState.isLoading,
              onClick: (claim) => {
                void runDenialPrediction(claim)
              },
            })
          }

          if (item.closureStatus === 'READY_TO_CLOSE') {
            workflowActions.push({
              label: 'Close Claim',
              icon: <Lock className="h-4 w-4" aria-hidden="true" />,
              disabled: closeClaimState.isLoading,
              loading: closeClaimState.isLoading,
              onClick: (claim) => {
                openClaimReasonAction('close', claim)
              },
            })
          }

          return [...workflowActions, ...safeDefaultActions]
        },
        viewContent: (item) => (
          <div className="space-y-8">
            <RcmViewSummary
              title="Claim readiness workflow"
              subtitle="Shows why this claim can or cannot be submitted to the payer."
              status={claimSubmissionIdByClaimId.get(item._id) ? 'Submitted' : item.claimStatus ?? '-'}
              severity={getClaimStatusSeverity(item, claimSubmissionIdByClaimId.get(item._id))}
              facts={[
                ['Payer', referenceOptions.payers?.find((option) => option.value === item.payerId)?.label ?? item.payerId ?? '-'],
                ['Lines', `${item.claimLines.length}`],
                ['Total charge', typeof item.totalChargeAmount === 'number' ? `$${item.totalChargeAmount.toFixed(2)}` : '-'],
              ]}
              journey={[
                {
                  label: 'Claim build',
                  status: item.claimStatus ?? '-',
                  detail: item.correctedClaimIndicator ? 'Corrected claim indicator is set.' : 'Original claim.',
                  severity: getClaimStatusSeverity(item, claimSubmissionIdByClaimId.get(item._id)),
                },
                {
                  label: 'Scrub',
                  status: item.scrubStatus ?? '-',
                  detail: item.rejectionReason || 'Local and AI scrub results are applied before submission.',
                  severity: item.scrubStatus === 'Passed' ? 'success' : 'danger',
                },
                {
                  label: 'Submission',
                  status: item.submissionStatus ?? '-',
                  detail: claimSubmissionIdByClaimId.get(item._id) ? 'Transmission record exists.' : 'Submit Claim creates the claim submission.',
                  severity: claimSubmissionIdByClaimId.get(item._id) ? 'success' : canSubmitClaim(item) ? 'warning' : 'neutral',
                },
                {
                  label: 'Next handoff',
                  status: claimSubmissionIdByClaimId.get(item._id) ? 'Claim submission' : canSubmitClaim(item) ? 'Submit' : 'Correct',
                  detail: claimSubmissionIdByClaimId.get(item._id) ? 'Review acknowledgement and tracking.' : canSubmitClaim(item) ? 'Open readiness; backend validation remains the submit gate.' : 'Resolve scrub/readiness issues before submission.',
                  severity: claimSubmissionIdByClaimId.get(item._id) || canSubmitClaim(item) ? 'warning' : 'danger',
                },
              ]}
              alerts={[
                ...(item.rejectionReason ? [{ title: 'Claim issue', detail: item.rejectionReason, severity: 'danger' as const }] : []),
                ...(claimScrubber(item).errors.map((error) => ({ title: `Advisory scrubber error: ${error.field}`, detail: error.message, severity: 'danger' as const }))),
                ...(claimScrubber(item).warnings.map((warning) => ({ title: `Advisory scrubber warning: ${warning.field}`, detail: warning.message, severity: 'warning' as const }))),
              ]}
              actions={claimSubmissionIdByClaimId.get(item._id) ? [
                {
                  label: 'Open Claim Submission',
                  helper: 'Review EDI transmission and acknowledgement for this claim.',
                  onClick: () => {
                    const linkedClaimSubmissionId = claimSubmissionIdByClaimId.get(item._id)
                    if (!linkedClaimSubmissionId) {
                      return
                    }
                    navigate(
                      `/rcm/claim-submissions${buildWorkflowSearch(
                        mergeWorkflowContext(workflowContext, {
                          claimId: item._id,
                          claimSubmissionId: linkedClaimSubmissionId,
                          dashboardQueue: undefined,
                          dashboardEntityId: undefined,
                          returnTo,
                          returnLabel: 'Back to Claims',
                        }),
                      )}`,
                    )
                  },
                },
              ] : []}
            />
            <ClaimTransmissionAudit claim={item} />
            {(item.claimStatus === 'Rejected' || item.submissionStatus === 'Rejected' || item.parentClaimId) ? (
              <ClaimRejectionPanel claimId={item.parentClaimId ?? item._id} />
            ) : null}
            <ClaimFinancialSummary claimId={item._id} />
            <div className="border-t border-neutral-100 pt-8">
              {renderClaimDetails(item, referenceOptions)}
            </div>
          </div>
        ),
        gridItem: (item) => renderClaimGridItem(item, referenceOptions),
      },
    }),
    [
      claimSubmissionIdByClaimId,
      navigate,
      predictClaimDenialState.isLoading,
      referenceOptions,
      returnTo,
      runDenialPrediction,
      runRejectionAnalysis,
      openClaimReasonAction,
      runResubmission,
      analyzeClaimRejectionState.isLoading,
      closeClaimState.isLoading,
      submitClaimState.isLoading,
      workflowContext,
      workflowFeedback,
    ],
  )

  const handleDenialPredictionClose = () => {
    setShowDenialPredictionModal(false)
    predictionClaimRef.current = null
  }

  return (
    <>
      <CrudPage key={workflowKey || 'claims'} config={crudConfig} />
      <ClaimDenialPredictionModal
        visible={showDenialPredictionModal}
        prediction={denialPrediction}
        loading={predictClaimDenialState.isLoading}
        error={denialPredictionError}
        canSubmit={false}
        submitLoading={false}
        onClose={handleDenialPredictionClose}
        onRetry={retryDenialPrediction}
        onProceed={handleDenialPredictionClose}
      />
      <ActionReasonDialog
        open={Boolean(claimReasonAction)}
        title="Close claim"
        message="Record why this claim is ready for final closure."
        reason={claimActionReason}
        reasonPlaceholder="Enter closure reason."
        confirmLabel="Close Claim"
        tone="danger"
        loading={closeClaimState.isLoading}
        onReasonChange={setClaimActionReason}
        onClose={closeClaimReasonAction}
        onConfirm={() => void submitClaimReasonAction()}
      />
    </>
  )
}

function ClaimRejectionPanel({ claimId }: { claimId: string }) {
  const { data: rejections = [], isLoading } = useGetClaimRejectionsQuery(claimId)

  if (isLoading) {
    return <Message severity="info" text="Loading rejection history..." className="w-full justify-start" />
  }

  if (!rejections.length) {
    return null
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-red-600" aria-hidden="true" />
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Rejection management</h3>
      </div>
      <div className="grid gap-3">
        {rejections.map((rejection) => (
          <div key={rejection._id} className="rounded-lg border border-red-100 bg-red-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-red-900">
                {[rejection.rejectionCode, rejection.category].filter(Boolean).join(' / ') || 'Payer rejection'}
              </p>
              <span className="text-xs font-semibold uppercase tracking-normal text-red-700">{rejection.status ?? 'Open'}</span>
            </div>
            <p className="mt-2 text-sm text-neutral-700">{rejection.rejectionReason ?? '-'}</p>
            {rejection.aiSuggestion ? (
              <div className="mt-3 rounded-md bg-white p-3 text-sm">
                <p className="font-semibold text-neutral-900">{rejection.aiSuggestion.rootCause}</p>
                <p className="mt-1 text-neutral-700">{rejection.aiSuggestion.suggestion}</p>
                <p className="mt-1 text-xs font-semibold text-neutral-500">Confidence {rejection.aiSuggestion.confidence}%</p>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  )
}

function ClaimFinancialSummary({ claimId }: { claimId: string }) {
  const { data: predictionsData, isLoading } = useGetClaimPredictionsQuery({
    page: 1,
    limit: 10,
    sortfield: 'created',
    direction: 'desc',
    criteria: [{ key: 'claimId', value: claimId, type: 'equals' }]
  });

  if (isLoading || !predictionsData?.data?.length) return null;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/20 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Wand2 className="h-5 w-5 text-emerald-600" />
        <h3 className="text-lg font-bold text-neutral-900">AI Financial Prediction</h3>
      </div>
      
      <div className="space-y-4">
        {predictionsData.data.map((prediction) => (
          <div key={prediction._id} className="rounded-xl bg-white p-4 border border-emerald-100 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Line {prediction.lineNumber || 1}: {prediction.cptCode}</span>
                <p className="text-[10px] text-neutral-500 font-medium">Confidence: {Math.round(prediction.confidenceScore * 100)}% ({prediction.source})</p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-neutral-400 uppercase">Est. Reimbursement</span>
                <p className="text-lg font-bold text-emerald-600">${prediction.predictedPaid.toFixed(2)}</p>
              </div>
            </div>
            <div className="text-[11px] text-neutral-600 italic border-t border-neutral-50 pt-2">
              {prediction.explanation}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
