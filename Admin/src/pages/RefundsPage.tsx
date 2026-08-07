import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Ban, CircleCheck, Send } from 'lucide-react'
import { CrudPage } from '@/components/crud/CrudPage'
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog'
import type { CrudPageConfig } from '@/types/crud'
import { createRefundFormConfig, createRefundTableColumns, mapRefundFormToPayload, mapRefundToFormValues, renderRefundDetails, renderRefundGridItem } from '@/models/refundModel'
import { useCreateRefundMutation, useGetRefundsQuery, useRunRefundActionMutation } from '@/services/api/endpoints/refundsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Refund, RefundCreatePayload, RefundFormValues, RefundUpdatePayload } from '@/types/refund'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import { readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function RefundsPage() {
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const [runRefundAction, actionState] = useRunRefundActionMutation()
  const [selectedAction, setSelectedAction] = useState<{ item: Refund; action: 'APPROVE' | 'PROCESS' | 'REJECT' | 'CANCEL'; title: string } | null>(null)
  const [reason, setReason] = useState('')
  const { showToast } = useToast()

  async function submitAction() {
    if (!selectedAction || !reason.trim()) return
    try {
      await runRefundAction({
        id: selectedAction.item._id,
        action: selectedAction.action,
        data: { reason: reason.trim() },
      }).unwrap()
      showToast({ severity: 'success', summary: 'Refund updated' })
      setSelectedAction(null)
      setReason('')
    } catch (error) {
      showToast({ severity: 'error', summary: 'Refund action failed', detail: getApiErrorMessage(error) })
    }
  }

  const patientsOptions = useMemo(
    () =>
      (patientsQuery.data?.data ?? []).map((item) => ({
        label: `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        value: item._id,
      })),
    [patientsQuery.data],
  )
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
      patients: patientsOptions,
      claims: claimsOptions,
    }),
    [patientsOptions, claimsOptions],
  )

  const crudConfig: CrudPageConfig<
    Refund,
    RefundFormValues,
    RefundCreatePayload,
    RefundUpdatePayload
  > = useMemo(
    () => ({
      title: 'Refunds',
      resourceName: 'Refund',
      createButtonLabel: 'Request Refund',
      createDialogTitle: 'Request refund',
      editDialogTitle: 'Edit refund',
      viewDialogTitle: 'Refund details',
      deleteDialogTitle: 'Delete refund?',
      emptyMessage: 'No refunds found.',
      exportFileName: 'refunds',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: workflowContext.claimId
          ? [{ key: 'claimId', value: workflowContext.claimId, type: 'equals' }]
          : workflowContext.patientId
            ? [{ key: 'patientId', value: workflowContext.patientId, type: 'equals' }]
            : [],
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'refunds',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderRefundGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createRefundTableColumns(referenceOptions),
      },
      form: createRefundFormConfig(referenceOptions),
      api: {
        useListQuery: useGetRefundsQuery,
        useCreateMutation: useCreateRefundMutation,
      },
      mapItemToFormValues: mapRefundToFormValues,
      mapFormValuesToCreatePayload: mapRefundFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapRefundFormToPayload(values),
      slots: {
        rowActions: (item, defaultActions) => {
          const status = String(item.refundStatus ?? 'PENDING_REVIEW').toUpperCase()
          return [
            {
              label: 'Approve Refund',
              icon: <CircleCheck className="h-4 w-4" />,
              disabled: !['PENDING_REVIEW', 'REQUESTED', 'PENDING'].includes(status),
              onClick: () => {
                setSelectedAction({ item, action: 'APPROVE', title: 'Approve refund' })
                setReason('')
              },
            },
            {
              label: 'Process Refund',
              icon: <Send className="h-4 w-4" />,
              disabled: status !== 'APPROVED',
              onClick: () => {
                setSelectedAction({ item, action: 'PROCESS', title: 'Process refund' })
                setReason('')
              },
            },
            {
              label: 'Reject Refund',
              icon: <Ban className="h-4 w-4" />,
              disabled: ['PROCESSED', 'REJECTED', 'CANCELLED'].includes(status),
              onClick: () => {
                setSelectedAction({ item, action: 'REJECT', title: 'Reject refund' })
                setReason('')
              },
            },
            {
              label: 'Cancel Refund',
              icon: <Ban className="h-4 w-4" />,
              disabled: !['PENDING_REVIEW', 'REQUESTED', 'PENDING'].includes(status),
              onClick: () => {
                setSelectedAction({ item, action: 'CANCEL', title: 'Cancel refund' })
                setReason('')
              },
            },
            ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
          ]
        },
        viewContent: (item) => renderRefundDetails(item, referenceOptions),
        gridItem: (item) => renderRefundGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions, workflowContext],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'refunds'} config={crudConfig} />
      <ActionReasonDialog
        open={Boolean(selectedAction)}
        title={selectedAction?.title ?? 'Refund action'}
        message="Record the reason for this refund workflow action."
        reason={reason}
        reasonPlaceholder="Enter refund action reason."
        confirmLabel={selectedAction?.action === 'APPROVE' ? 'Approve Refund' : selectedAction?.action === 'PROCESS' ? 'Process Refund' : selectedAction?.action === 'CANCEL' ? 'Cancel Refund' : 'Reject Refund'}
        tone={selectedAction?.action === 'REJECT' || selectedAction?.action === 'CANCEL' ? 'danger' : 'default'}
        loading={actionState.isLoading}
        onReasonChange={setReason}
        onClose={() => {
          if (!actionState.isLoading) {
            setSelectedAction(null)
            setReason('')
          }
        }}
        onConfirm={() => void submitAction()}
      />
    </>
  )
}
