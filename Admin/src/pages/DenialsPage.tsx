import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FilePenLine, FileStack, Navigation, ReceiptText, RotateCcw, Sparkles, UserRound } from 'lucide-react'
import { CrudPage } from '@/components/crud/CrudPage'
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog'
import type { CrudPageConfig } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createDenialFormConfig, createDenialTableColumns, mapDenialFormToPayload, mapDenialToFormValues, renderDenialDetails, renderDenialGridItem } from '@/models/denialModel'
import { useGetDenialsQuery, useMarkDenialReadyForAppealMutation, useMarkDenialReadyForCorrectedClaimMutation, useReopenDenialMutation, useRunDenialAiAnalysisMutation, useTransferDenialToPatientMutation, useWriteOffDenialMutation } from '@/services/api/endpoints/denialsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Denial, DenialCreatePayload, DenialFormValues, DenialUpdatePayload } from '@/types/denial'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function DenialsPage() {
  const { showToast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const returnTo = `${location.pathname}${location.search}`
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const [markCorrectedClaimReady] = useMarkDenialReadyForCorrectedClaimMutation()
  const [markAppealReady] = useMarkDenialReadyForAppealMutation()
  const [writeOffDenial] = useWriteOffDenialMutation()
  const [transferToPatient] = useTransferDenialToPatientMutation()
  const [reopenDenial] = useReopenDenialMutation()
  const [runAiAnalysis] = useRunDenialAiAnalysisMutation()
  const [reasonAction, setReasonAction] = useState<{
    item: Denial
    action: 'WRITE_OFF' | 'TRANSFER_TO_PATIENT' | 'REOPEN'
    title: string
  } | null>(null)
  const [reason, setReason] = useState('')

  async function runDenialAction(action: () => Promise<unknown>, summary: string) {
    try {
      await action()
      showToast({ severity: 'success', summary })
    } catch (error) {
      showToast({ severity: 'error', summary: 'Denial action failed', detail: getApiErrorMessage(error) })
    }
  }

  const claimsOptions = useMemo(
    () =>
      (claimsQuery.data?.data ?? []).map((item) => ({
        label: [item.claimDate, item.claimStatus, item.batchId].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [claimsQuery.data],
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

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      claims: claimsOptions,
      patients: patientsOptions,
      payers: payersOptions,
    }),
    [claimsOptions, patientsOptions, payersOptions],
  )

  const crudConfig: CrudPageConfig<
    Denial,
    DenialFormValues,
    DenialCreatePayload,
    DenialUpdatePayload
  > = useMemo(
    () => ({
      title: 'Denial Management',
      resourceName: 'Denial',
      help: {
        title: 'Denial Management',
        intro: 'Follow the denial resolution workflow: analyze the root cause using AI, then initiate the appeal process.',
        steps: [
          {
            label: 'AI Root Cause',
            icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
            description: 'Run AI denial analysis on the denial record to analyze adjustment reason codes and suggest the best corrective path.',
          },
          {
            label: 'Create Appeal',
            icon: <FileStack className="h-4 w-4" aria-hidden="true" />,
            description: 'Initiate an appeal for the denied claim. This will create a new appeal draft and automatically transition you to the Appeals screen.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Denial',
      createDialogTitle: 'Add denial',
      editDialogTitle: 'Edit denial',
      viewDialogTitle: 'Denial details',
      deleteDialogTitle: 'Delete denial?',
      emptyMessage: 'No denials found.',
      exportFileName: 'denials',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('denial', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'denials',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderDenialGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createDenialTableColumns(referenceOptions),
      },
      form: createDenialFormConfig(referenceOptions),
      api: {
        useListQuery: useGetDenialsQuery,
      },
      mapItemToFormValues: mapDenialToFormValues,
      mapFormValuesToCreatePayload: mapDenialFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapDenialFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="denial" context={workflowContext} />
          </div>
        ),
        rowActions: (item, defaultActions) => [
          {
            label: 'Open Claim',
            icon: <Navigation className="h-4 w-4" />,
            disabled: !item.claimId,
            onClick: () => navigate(`/rcm/claims${buildWorkflowSearch(
              mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                denialId: item._id,
                returnTo,
                returnLabel: 'Back to Denials',
              }),
            )}`),
          },
          {
            label: 'Create Corrected Claim',
            icon: <FilePenLine className="h-4 w-4" />,
            disabled: ['CORRECTED_CLAIM_PENDING', 'CORRECTED_CLAIM_READY', 'RESOLVED', 'WRITTEN_OFF', 'CLOSED'].includes(item.denialStatus ?? ''),
            onClick: () => void runDenialAction(
              () => markCorrectedClaimReady(item._id).unwrap(),
              'Corrected claim created',
            ),
          },
          {
            label: 'AI Root Cause',
            icon: <Sparkles className="h-4 w-4" />,
            disabled: ['RESOLVED', 'WRITTEN_OFF', 'CLOSED'].includes(item.denialStatus ?? ''),
            onClick: () => void runDenialAction(
              () => runAiAnalysis(item._id).unwrap(),
              'AI denial analysis completed',
            ),
          },
          {
            label: item.appealId ? 'Open Appeal' : 'Create Appeal',
            icon: <FileStack className="h-4 w-4" />,
            disabled: !item.appealId && item.denialStatus !== 'OPEN',
            onClick: () => {
              if (item.appealId) {
                navigate(`/rcm/appeals${buildWorkflowSearch(
                  mergeWorkflowContext(workflowContext, {
                    claimId: item.claimId,
                    denialId: item._id,
                    appealId: item.appealId,
                    returnTo,
                    returnLabel: 'Back to Denials',
                  }),
                )}`)
                return
              }
              void runDenialAction(
                async () => {
                  const denial = await markAppealReady(item._id).unwrap()
                  if (!denial.appealId) {
                    return
                  }
                  navigate(`/rcm/appeals${buildWorkflowSearch(
                    mergeWorkflowContext(workflowContext, {
                      claimId: denial.claimId,
                      denialId: denial._id,
                      appealId: denial.appealId,
                      returnTo,
                      returnLabel: 'Back to Denials',
                    }),
                  )}`)
                },
                'Appeal draft created',
              )
            },
          },
          {
            label: 'Write off',
            icon: <ReceiptText className="h-4 w-4" />,
            tone: 'danger',
            disabled: item.denialStatus === 'WRITTEN_OFF' || item.denialStatus === 'RESOLVED',
            onClick: () => {
              setReasonAction({ item, action: 'WRITE_OFF', title: 'Write off denial' })
              setReason('')
            },
          },
          {
            label: 'Transfer to Patient',
            icon: <UserRound className="h-4 w-4" />,
            disabled: ['RESOLVED', 'WRITTEN_OFF', 'CLOSED'].includes(item.denialStatus ?? ''),
            onClick: () => {
              setReasonAction({ item, action: 'TRANSFER_TO_PATIENT', title: 'Transfer denial to patient' })
              setReason('')
            },
          },
          {
            label: 'Reopen',
            icon: <RotateCcw className="h-4 w-4" />,
            disabled: !['RESOLVED', 'WRITTEN_OFF', 'CLOSED'].includes(item.denialStatus ?? ''),
            onClick: () => {
              setReasonAction({ item, action: 'REOPEN', title: 'Reopen denial' })
              setReason('')
            },
          },
          ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
        ],
        viewContent: (item) => (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="denial"
              claimLabel={item.claimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                denialId: item._id,
                paymentPostingId: item.paymentPostingId,
                arWorkItemId: item.arWorkItemId,
                returnTo,
                returnLabel: 'Back to Denials',
              })}
              statuses={{
                claimTracking: 'ACCEPTED',
                paymentPosting: item.paymentPostingId ? 'POSTED' : undefined,
                denial: item.denialStatus,
                arWorkItem: item.arWorkItemId ? 'OPEN' : undefined,
                appeal: item.denialStatus === 'APPEAL_READY' ? 'READY' : undefined,
                correctedClaim: item.denialStatus === 'CORRECTED_CLAIM_READY' ? 'READY' : undefined,
              }}
              nextAction={
                item.denialStatus === 'APPEAL_READY'
                  ? 'Create or submit the appeal and monitor payer follow-up.'
                  : item.denialStatus === 'CORRECTED_CLAIM_READY'
                    ? 'Create corrected claim, rerun readiness, and resubmit.'
                    : 'Classify the denial and choose appeal, corrected claim, or write-off.'
              }
            />
            {renderDenialDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderDenialGridItem(item, referenceOptions),
      },
    }),
    [markAppealReady, markCorrectedClaimReady, navigate, referenceOptions, returnTo, runAiAnalysis, workflowContext],
  )

  async function submitReasonAction() {
    if (!reasonAction || !reason.trim()) return
    const note = reason.trim()
    if (reasonAction.action === 'WRITE_OFF') {
      await runDenialAction(() => writeOffDenial({ id: reasonAction.item._id, resolutionNotes: note }).unwrap(), 'Denial written off')
    } else if (reasonAction.action === 'TRANSFER_TO_PATIENT') {
      await runDenialAction(() => transferToPatient({ id: reasonAction.item._id, resolutionNotes: note }).unwrap(), 'Transferred to patient responsibility')
    } else {
      await runDenialAction(() => reopenDenial({ id: reasonAction.item._id, reason: note }).unwrap(), 'Denial reopened')
    }
    setReasonAction(null)
    setReason('')
  }

  return (
    <>
      <CrudPage key={workflowKey || 'denials'} config={crudConfig} />
      <ActionReasonDialog
        open={Boolean(reasonAction)}
        title={reasonAction?.title ?? 'Denial action'}
        message="Record the reason for this denial workflow action."
        reason={reason}
        reasonPlaceholder="Enter denial action reason."
        confirmLabel={reasonAction?.action === 'WRITE_OFF' ? 'Write Off' : reasonAction?.action === 'TRANSFER_TO_PATIENT' ? 'Transfer' : 'Reopen'}
        tone={reasonAction?.action === 'WRITE_OFF' ? 'danger' : 'default'}
        onReasonChange={setReason}
        onClose={() => {
          setReasonAction(null)
          setReason('')
        }}
        onConfirm={() => void submitReasonAction()}
      />
    </>
  )
}
