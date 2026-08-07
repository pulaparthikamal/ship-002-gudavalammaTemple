import { useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Banknote, Send, ShieldAlert } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputTextarea } from 'primereact/inputtextarea'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createPatientBillingFormConfig, createPatientBillingTableColumns, mapPatientBillingFormToPayload, mapPatientBillingToFormValues, renderPatientBillingDetails, renderPatientBillingGridItem } from '@/models/patientBillingModel'
import { useGetPatientBillingsQuery, useRunPatientBillingActionMutation } from '@/services/api/endpoints/patientBillingsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PatientBilling, PatientBillingCreatePayload, PatientBillingFormValues, PatientBillingUpdatePayload } from '@/types/patientBilling'
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

export function PatientBillingsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const returnTo = `${location.pathname}${location.search}`
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const [runPatientBillingAction, actionState] = useRunPatientBillingActionMutation()
  const [collectionsBilling, setCollectionsBilling] = useState<PatientBilling | null>(null)
  const [collectionsReason, setCollectionsReason] = useState('')
  const { showToast } = useToast()

  async function handleAction(item: PatientBilling, action: string, data: Record<string, unknown> = {}) {
    try {
      await runPatientBillingAction({ id: item._id, action, data }).unwrap()
      showToast({ severity: 'success', summary: 'Patient billing updated' })
      return true
    } catch (error) {
      showToast({ severity: 'error', summary: 'Patient billing action failed', detail: getApiErrorMessage(error) })
      return false
    }
  }

  async function referToCollections() {
    if (!collectionsBilling || !collectionsReason.trim()) return
    const succeeded = await handleAction(collectionsBilling, 'MARK_COLLECTIONS_READY', { reason: collectionsReason.trim() })
    if (succeeded) {
      setCollectionsBilling(null)
      setCollectionsReason('')
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
  const claimById = useMemo(() => {
    const nextClaimById = new Map<string, { closureStatus?: string; paymentStatus?: string; claimStatus?: string }>()

    for (const claim of claimsQuery.data?.data ?? []) {
      nextClaimById.set(claim._id, claim)
    }

    return nextClaimById
  }, [claimsQuery.data])

  const crudConfig: CrudPageConfig<
    PatientBilling,
    PatientBillingFormValues,
    PatientBillingCreatePayload,
    PatientBillingUpdatePayload
  > = useMemo(
    () => ({
      title: 'Patient Billing',
      resourceName: 'Patient Billing',
      showCreateButton: false,
      createButtonLabel: 'Add Patient Billing',
      createDialogTitle: 'Add patient billing',
      editDialogTitle: 'Edit patient billing',
      viewDialogTitle: 'Patient Billing details',
      deleteDialogTitle: 'Delete patient billing?',
      emptyMessage: 'No patient billings found.',
      exportFileName: 'patient-billings',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('patientBilling', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'patient-billings',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderPatientBillingGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createPatientBillingTableColumns(referenceOptions),
      },
      form: createPatientBillingFormConfig(referenceOptions),
      api: {
        useListQuery: useGetPatientBillingsQuery,
      },
      mapItemToFormValues: mapPatientBillingToFormValues,
      mapFormValuesToCreatePayload: mapPatientBillingFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapPatientBillingFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="patientBilling" context={workflowContext} />
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const status = String(item.status ?? item.statementStatus ?? '').toUpperCase()
          const noOpenBalance = Number(item.currentBalance ?? item.amountDue ?? 0) <= 0
          const isClosed = ['PAID', 'CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(status)
          return [
            {
              label: 'Send Statement',
              icon: <Send className="h-4 w-4" />,
              disabled: noOpenBalance || isClosed || status === 'COLLECTIONS_READY',
              onClick: () => void handleAction(item, 'SEND_STATEMENT'),
            },
            {
              label: 'Record Payment',
              icon: <Banknote className="h-4 w-4" />,
              disabled: noOpenBalance || isClosed,
              onClick: () => navigate(`/rcm/patient-payments${buildWorkflowSearch(mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                patientId: item.patientId,
                patientBillingId: item._id,
                patientBillingStatus: item.status ?? item.statementStatus,
                returnTo,
                returnLabel: 'Back to Patient Billing',
              }))}`),
            },
            {
              label: 'Refer to Collections',
              icon: <ShieldAlert className="h-4 w-4" />,
              disabled: noOpenBalance || isClosed || status === 'COLLECTIONS_READY',
              onClick: () => {
                setCollectionsBilling(item)
                setCollectionsReason('')
              },
            },
            ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
          ]
        },
        viewContent: (item) => {
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const claimClosureStatus = claim?.closureStatus ?? (item.claimId === workflowContext.claimId ? workflowContext.closureStatus : undefined)

          return (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="patientBilling"
              claimLabel={item.claimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                patientId: item.patientId,
                paymentPostingId: item.paymentPostingId,
                patientBillingId: item._id,
                paymentStatus: claim?.paymentStatus,
                closureStatus: claimClosureStatus,
                patientBillingStatus: item.status ?? item.statementStatus,
                returnTo,
                returnLabel: 'Back to Patient Billing',
              })}
              statuses={{
                claim: claim?.claimStatus,
                paymentPosting: item.paymentPostingId ? 'POSTED' : undefined,
                patientBilling: item.status ?? item.statementStatus,
                collection: item.collectionsFlag ? 'OPEN' : undefined,
                closed: claimClosureStatus === 'CLOSED' ? 'CLOSED' : undefined,
              }}
              nextAction={
                claimClosureStatus === 'CLOSED'
                  ? 'Claim is closed. Review audit trail if additional financial activity appears.'
                  : item.collectionsFlag
                  ? 'Review collections follow-up for the remaining patient balance.'
                  : Number(item.currentBalance ?? item.amountDue ?? 0) > 0
                    ? 'Send statement, collect payment, or refer to collections.'
                    : 'Patient balance is resolved. Review claim closure criteria.'
              }
            />
            {renderPatientBillingDetails(item, referenceOptions)}
          </div>
          )
        },
        gridItem: (item) => renderPatientBillingGridItem(item, referenceOptions),
      },
    }),
    [claimById, navigate, referenceOptions, returnTo, runPatientBillingAction, showToast, workflowContext],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'patient-billings'} config={crudConfig} />
      <Dialog
        header="Refer balance to collections"
        visible={Boolean(collectionsBilling)}
        onHide={() => {
          if (!actionState.isLoading) setCollectionsBilling(null)
        }}
        style={{ width: 'min(560px, 96vw)' }}
        modal
        draggable={false}
        resizable={false}
      >
        <div className="space-y-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold">Referral reason</span>
            <InputTextarea value={collectionsReason} onChange={(event) => setCollectionsReason(event.target.value)} rows={4} className="w-full" autoFocus />
          </label>
          <div className="flex justify-end gap-2 border-t border-[var(--color-border)] pt-4">
            <Button label="Cancel" severity="secondary" outlined disabled={actionState.isLoading} onClick={() => setCollectionsBilling(null)} />
            <Button label="Refer to Collections" loading={actionState.isLoading} disabled={!collectionsReason.trim()} onClick={() => void referToCollections()} />
          </div>
        </div>
      </Dialog>
    </>
  )
}
