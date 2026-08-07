import { useMemo, useState } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { CheckCircle2, FileWarning, PhoneCall, RefreshCw, ReceiptText, XCircle } from 'lucide-react'
import { Button } from 'primereact/button'
import { InputNumber } from 'primereact/inputnumber'
import { CrudPage } from '@/components/crud/CrudPage'
import { ActionReasonDialog } from '@/components/ui/ActionReasonDialog'
import type { CrudPageConfig } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createCollectionFormConfig, createCollectionTableColumns, mapCollectionFormToPayload, mapCollectionToFormValues, renderCollectionDetails, renderCollectionGridItem } from '@/models/collectionModel'
import { useGenerateCollectionsMutation, useGetCollectionsQuery, useRunCollectionActionMutation } from '@/services/api/endpoints/collectionsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPatientBillingsQuery } from '@/services/api/endpoints/patientBillingsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Collection, CollectionCreatePayload, CollectionFormValues, CollectionUpdatePayload } from '@/types/collection'
import { buildWorkflowCriteria, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function CollectionsPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const returnTo = `${location.pathname}${location.search}`
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const patientBillingsQuery = useGetPatientBillingsQuery(lookupQuery)
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const [generateCollections, generateCollectionsState] = useGenerateCollectionsMutation()
  const [runCollectionAction, collectionActionState] = useRunCollectionActionMutation()
  const [resolutionAction, setResolutionAction] = useState<{ item: Collection; action: 'WRITE_OFF' | 'CLOSE'; title: string } | null>(null)
  const [resolutionReason, setResolutionReason] = useState('')
  const [resolutionAmount, setResolutionAmount] = useState<number | null>(null)
  const { showToast } = useToast()

  const patientsOptions = useMemo(
    () =>
      (patientsQuery.data?.data ?? []).map((item) => ({
        label: `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        value: item._id,
      })),
    [patientsQuery.data],
  )
  const patientBillingsOptions = useMemo(
    () =>
      (patientBillingsQuery.data?.data ?? []).map((item) => ({
        label: [item.statementDate, item.statementStatus, item.amountDue].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [patientBillingsQuery.data],
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
      patientBillings: patientBillingsOptions,
      claims: claimsOptions,
    }),
    [patientsOptions, patientBillingsOptions, claimsOptions],
  )
  const claimById = useMemo(() => {
    const nextClaimById = new Map<string, { closureStatus?: string; paymentStatus?: string; claimStatus?: string }>()

    for (const claim of claimsQuery.data?.data ?? []) {
      nextClaimById.set(claim._id, claim)
    }

    return nextClaimById
  }, [claimsQuery.data])

  async function handleCollectionAction(item: Collection, action: string, data: Record<string, unknown> = {}) {
    try {
      await runCollectionAction({ id: item._id, action, data }).unwrap()
      showToast({ severity: 'success', summary: 'Collection updated', detail: `Action ${action} was recorded.` })
      return true
    } catch (error) {
      showToast({ severity: 'error', summary: 'Collection action failed', detail: getApiErrorMessage(error) })
      return false
    }
  }

  function openResolutionAction(item: Collection, action: 'WRITE_OFF' | 'CLOSE', title: string) {
    setResolutionAction({ item, action, title })
    setResolutionReason('')
    setResolutionAmount(Number(item.currentBalance ?? item.balanceAmount ?? 0) || null)
  }

  async function submitResolutionAction() {
    if (!resolutionAction || !resolutionReason.trim()) return
    const data: Record<string, unknown> = { reason: resolutionReason.trim(), notes: resolutionReason.trim() }
    if (resolutionAction.action === 'WRITE_OFF') data.writeOffAmount = resolutionAmount ?? 0
    const succeeded = await handleCollectionAction(resolutionAction.item, resolutionAction.action, data)
    if (succeeded) {
      setResolutionAction(null)
      setResolutionReason('')
      setResolutionAmount(null)
    }
  }

  const crudConfig: CrudPageConfig<
    Collection,
    CollectionFormValues,
    CollectionCreatePayload,
    CollectionUpdatePayload
  > = useMemo(
    () => ({
      title: 'Collections',
      resourceName: 'Collection',
      showCreateButton: false,
      createButtonLabel: 'Add Collection',
      createDialogTitle: 'Add collection',
      editDialogTitle: 'Edit collection',
      viewDialogTitle: 'Collection details',
      deleteDialogTitle: 'Delete collection?',
      emptyMessage: 'No collections found.',
      exportFileName: 'collections',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('collection', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'collections',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderCollectionGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createCollectionTableColumns(referenceOptions),
      },
      form: createCollectionFormConfig(referenceOptions),
      api: {
        useListQuery: useGetCollectionsQuery,
      },
      mapItemToFormValues: mapCollectionToFormValues,
      mapFormValuesToCreatePayload: mapCollectionFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapCollectionFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="collection" context={workflowContext} />
          </div>
        ),
        toolbarRight: (state) => (
          <Button
            type="button"
            label="Generate Collections"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            loading={generateCollectionsState.isLoading}
            className="flex h-8 items-center gap-1 px-3 text-xs font-semibold"
            onClick={async () => {
              try {
                await generateCollections().unwrap()
                showToast({ severity: 'success', summary: 'Collections generated', detail: 'Eligible patient balances were moved into collections review.' })
                state.refetch()
              } catch (error) {
                showToast({ severity: 'error', summary: 'Collections generation failed', detail: getApiErrorMessage(error) })
              }
            }}
          />
        ),
        rowActions: (item, defaultActions) => [
          {
            label: 'Log contact',
            icon: <PhoneCall className="h-4 w-4" />,
            disabled: ['CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(item.status ?? item.collectionStatus ?? ''),
            onClick: () => void handleCollectionAction(item, 'LOG_CONTACT', { notes: 'Contact attempt logged from collections queue.' }),
          },
          {
            label: 'Payment plan',
            icon: <CheckCircle2 className="h-4 w-4" />,
            disabled: ['CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(item.status ?? item.collectionStatus ?? ''),
            onClick: () => void handleCollectionAction(item, 'PAYMENT_PLAN'),
          },
          {
            label: 'External ready',
            icon: <FileWarning className="h-4 w-4" />,
            disabled: ['EXTERNAL_COLLECTIONS_READY', 'CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(item.status ?? item.collectionStatus ?? ''),
            onClick: () => void handleCollectionAction(item, 'EXTERNAL_READY'),
          },
          {
            label: 'Write Off',
            icon: <ReceiptText className="h-4 w-4" />,
            disabled: ['CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(item.status ?? item.collectionStatus ?? ''),
            onClick: () => openResolutionAction(item, 'WRITE_OFF', 'Write off collection balance'),
          },
          {
            label: 'Close',
            icon: <XCircle className="h-4 w-4" />,
            disabled: ['CLOSED'].includes(item.status ?? item.collectionStatus ?? ''),
            onClick: () => openResolutionAction(item, 'CLOSE', 'Close collection'),
          },
          ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
        ],
        viewContent: (item) => {
          const claim = item.claimId ? claimById.get(item.claimId) : undefined
          const claimClosureStatus = claim?.closureStatus ?? (item.claimId === workflowContext.claimId ? workflowContext.closureStatus : undefined)

          return (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="collection"
              claimLabel={item.claimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                patientId: item.patientId,
                patientBillingId: item.patientBillingId,
                collectionId: item._id,
                paymentStatus: claim?.paymentStatus,
                closureStatus: claimClosureStatus,
                collectionStatus: item.status ?? item.collectionStatus,
                returnTo,
                returnLabel: 'Back to Collections',
              })}
              statuses={{
                claim: claim?.claimStatus,
                patientBilling: item.patientBillingId ? 'COLLECTIONS' : undefined,
                collection: item.status ?? item.collectionStatus,
                closed: claimClosureStatus === 'CLOSED' ? 'CLOSED' : undefined,
              }}
              nextAction={
                claimClosureStatus === 'CLOSED'
                  ? 'Claim is closed. Review audit trail if additional financial activity appears.'
                  : ['CLOSED', 'SETTLED', 'WRITTEN_OFF'].includes(item.status ?? item.collectionStatus ?? '')
                  ? 'Collection item is resolved. Review claim closure criteria.'
                  : 'Continue collection follow-up, payment plan, external readiness, or write-off review.'
              }
            />
            {renderCollectionDetails(item, referenceOptions)}
          </div>
          )
        },
        gridItem: (item) => renderCollectionGridItem(item, referenceOptions),
      },
    }),
    [claimById, generateCollections, generateCollectionsState.isLoading, referenceOptions, returnTo, showToast, workflowContext],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'collections'} config={crudConfig} />
      <ActionReasonDialog
        open={Boolean(resolutionAction)}
        title={resolutionAction?.title ?? 'Collection action'}
        message={resolutionAction?.action === 'WRITE_OFF'
          ? 'Record the amount and reason for writing off this collection balance.'
          : 'Record why this collection item should be closed.'}
        reason={resolutionReason}
        reasonPlaceholder={resolutionAction?.action === 'WRITE_OFF' ? 'Enter write-off reason.' : 'Enter close reason.'}
        confirmLabel={resolutionAction?.action === 'WRITE_OFF' ? 'Write Off Balance' : 'Close Collection'}
        tone={resolutionAction?.action === 'WRITE_OFF' ? 'danger' : 'default'}
        loading={collectionActionState.isLoading}
        confirmDisabled={resolutionAction?.action !== 'CLOSE' && !(resolutionAmount && resolutionAmount > 0)}
        onReasonChange={setResolutionReason}
        onClose={() => {
          if (!collectionActionState.isLoading) {
            setResolutionAction(null)
            setResolutionReason('')
            setResolutionAmount(null)
          }
        }}
        onConfirm={() => void submitResolutionAction()}
      >
        {resolutionAction?.action !== 'CLOSE' ? (
          <label className="block text-sm font-medium text-[var(--color-text-strong)]" htmlFor="collection-resolution-amount">
            Amount
            <InputNumber
              inputId="collection-resolution-amount"
              value={resolutionAmount}
              onValueChange={(event) => setResolutionAmount(event.value ?? null)}
              min={0}
              mode="currency"
              currency="USD"
              locale="en-US"
              className="mt-2 w-full"
              disabled={collectionActionState.isLoading}
            />
          </label>
        ) : null}
      </ActionReasonDialog>
    </>
  )
}
