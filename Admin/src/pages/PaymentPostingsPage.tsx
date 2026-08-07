import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FileText, RotateCcw, Receipt, RefreshCcw, WalletCards } from 'lucide-react'
import { CrudPage } from '@/components/crud/CrudPage'
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog'
import type { CrudPageConfig } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createPaymentPostingFormConfig, createPaymentPostingTableColumns, mapPaymentPostingFormToPayload, mapPaymentPostingToFormValues, renderPaymentPostingDetails, renderPaymentPostingGridItem } from '@/models/paymentPostingModel'
import { useGetPaymentPostingsQuery, useReversePaymentPostingMutation } from '@/services/api/endpoints/paymentPostingsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PaymentPosting, PaymentPostingCreatePayload, PaymentPostingFormValues, PaymentPostingUpdatePayload } from '@/types/paymentPosting'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function PaymentPostingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { showToast } = useToast()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const [reversePaymentPosting, reversePaymentPostingState] = useReversePaymentPostingMutation()
  const [reverseAction, setReverseAction] = useState<PaymentPosting | null>(null)
  const [reverseReason, setReverseReason] = useState('')
  const returnTo = `${location.pathname}${location.search}`

  function workflowUrl(route: string, item: PaymentPosting, extra: Partial<ReturnType<typeof readWorkflowContext>> = {}) {
    return `${route}${buildWorkflowSearch(mergeWorkflowContext(workflowContext, {
      claimId: item.claimId,
      eraEobProcessingId: item.eraEobProcessingId,
      paymentPostingId: item._id,
      returnTo,
      returnLabel: 'Back to Payment Posting',
      ...extra,
    }))}`
  }

  function openReverseDialog(item: PaymentPosting) {
    setReverseAction(item)
    setReverseReason('')
  }

  function closeReverseDialog() {
    setReverseAction(null)
    setReverseReason('')
  }

  async function handleReverse() {
    const item = reverseAction
    const reason = reverseReason.trim()

    if (!item || !reason || reversePaymentPostingState.isLoading) return

    try {
      await reversePaymentPosting({ id: item._id, data: { reason } }).unwrap()
      showToast({ severity: 'success', summary: 'Payment posting reversed' })
      closeReverseDialog()
    } catch (error) {
      showToast({ severity: 'error', summary: 'Payment reversal failed', detail: getApiErrorMessage(error) })
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
      payers: payersOptions,
    }),
    [claimsOptions, payersOptions],
  )
  const claimById = useMemo(() => {
    const nextClaimById = new Map<string, { closureStatus?: string; paymentStatus?: string; claimStatus?: string }>()

    for (const claim of claimsQuery.data?.data ?? []) {
      nextClaimById.set(claim._id, claim)
    }

    return nextClaimById
  }, [claimsQuery.data])

  const crudConfig: CrudPageConfig<
    PaymentPosting,
    PaymentPostingFormValues,
    PaymentPostingCreatePayload,
    PaymentPostingUpdatePayload
  > = useMemo(
    () => ({
      title: 'Payment Postings',
      resourceName: 'Payment Posting',
      showCreateButton: false,
      createButtonLabel: 'Add Payment Posting',
      createDialogTitle: 'Add payment posting',
      editDialogTitle: 'Edit payment posting',
      viewDialogTitle: 'Payment Posting details',
      deleteDialogTitle: 'Delete payment posting?',
      emptyMessage: 'No payment postings found.',
      exportFileName: 'payment-postings',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('paymentPosting', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'payment-postings',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderPaymentPostingGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createPaymentPostingTableColumns(referenceOptions),
      },
      form: createPaymentPostingFormConfig(referenceOptions),
      api: {
        useListQuery: useGetPaymentPostingsQuery,
      },
      mapItemToFormValues: mapPaymentPostingToFormValues,
      mapFormValuesToCreatePayload: mapPaymentPostingFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapPaymentPostingFormToPayload(values),
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="paymentPosting" context={workflowContext} />
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const hasDenial = item.paymentLines.some((line) => (line.deniedAmount ?? 0) > 0)
          const hasPatientResponsibility = (item.patientResponsibilityAmount ?? 0) > 0
          const remainingBalance = item.remainingBalance ?? 0

          return [
            ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
            {
              label: 'Open Patient Billing',
              icon: <Receipt className="h-4 w-4" />,
              disabled: !item.claimId || !hasPatientResponsibility,
              onClick: () => navigate(workflowUrl('/rcm/patient-billings', item)),
            },
            {
              label: 'Open AR Work Item',
              icon: <FileText className="h-4 w-4" />,
              disabled: !item.claimId || (!hasDenial && remainingBalance <= 0),
              onClick: () => navigate(workflowUrl('/rcm/ar-work-items', item)),
            },
            {
              label: 'Open Refunds',
              icon: <WalletCards className="h-4 w-4" />,
              disabled: !item.claimId || remainingBalance >= 0,
              onClick: () => navigate(workflowUrl('/rcm/refunds', item)),
            },
            {
              label: 'Move to Collections',
              icon: <RefreshCcw className="h-4 w-4" />,
              disabled: !item.claimId || remainingBalance <= 0,
              onClick: () => navigate(workflowUrl('/rcm/collections', item)),
            },
            {
              label: 'Reverse Posting',
              icon: <RotateCcw className="h-4 w-4" />,
              tone: 'danger',
              disabled: item.postingStatus === 'REVERSED',
              onClick: () => openReverseDialog(item),
            },
          ]
        },
        viewContent: (item) => {
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const claimClosureStatus = claim?.closureStatus ?? (item.claimId === workflowContext.claimId ? workflowContext.closureStatus : undefined)

          return (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="paymentPosting"
              claimLabel={item.claimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                eraEobProcessingId: item.eraEobProcessingId,
                paymentPostingId: item._id,
                paymentStatus: claim?.paymentStatus ?? item.postingStatus,
                closureStatus: claimClosureStatus,
                returnTo,
                returnLabel: 'Back to Payment Posting',
              })}
              statuses={{
                claim: claim?.claimStatus,
                claimTracking: 'ACCEPTED',
                eraEobProcessing: item.eraEobProcessingId ? 'POSTED' : undefined,
                paymentPosting: item.postingStatus,
                denial: item.paymentLines.some((line) => (line.deniedAmount ?? 0) > 0) ? 'OPEN' : undefined,
                patientBilling: (item.patientResponsibilityAmount ?? 0) > 0 ? 'OPEN' : undefined,
                closed: claimClosureStatus === 'CLOSED' ? 'CLOSED' : undefined,
              }}
              nextAction={
                claimClosureStatus === 'CLOSED'
                  ? 'Claim is closed. Review audit trail if additional financial activity appears.'
                  : item.paymentLines.some((line) => (line.deniedAmount ?? 0) > 0)
                  ? 'Review denial and route to appeal or corrected claim.'
                  : (item.patientResponsibilityAmount ?? 0) > 0
                    ? 'Review patient billing for final responsibility.'
                    : 'Payment is posted. Review close criteria.'
              }
            />
            {renderPaymentPostingDetails(item, referenceOptions)}
          </div>
          )
        },
        gridItem: (item) => renderPaymentPostingGridItem(item, referenceOptions),
      },
    }),
    [claimById, navigate, referenceOptions, returnTo, workflowContext],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'payment-postings'} config={crudConfig} />
      <ActionReasonDialog
        open={Boolean(reverseAction)}
        title="Reverse payment posting"
        message="Record why this posting must be reversed. The system will preserve the original posting and create reversal activity instead of editing posted cash."
        reason={reverseReason}
        reasonPlaceholder="Enter reversal reason."
        confirmLabel="Reverse Posting"
        tone="danger"
        loading={reversePaymentPostingState.isLoading}
        onReasonChange={setReverseReason}
        onClose={() => {
          if (!reversePaymentPostingState.isLoading) closeReverseDialog()
        }}
        onConfirm={() => void handleReverse()}
      />
    </>
  )
}
