import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { CreditCard, FilePenLine, FileWarning, Gavel, Navigation, RefreshCw, Sparkles } from 'lucide-react'
import { Button } from 'primereact/button'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createArWorkItemFormConfig, createArWorkItemTableColumns, mapArWorkItemFormToPayload, mapArWorkItemToFormValues, renderArWorkItemDetails, renderArWorkItemGridItem } from '@/models/arWorkItemModel'
import { useGenerateArWorkItemsMutation, useGetArWorkItemsQuery, usePrioritizeArWorkItemWithAiMutation } from '@/services/api/endpoints/arWorkItemsApi'
import { useMarkDenialReadyForAppealMutation, useMarkDenialReadyForCorrectedClaimMutation } from '@/services/api/endpoints/denialsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ArWorkItem, ArWorkItemCreatePayload, ArWorkItemFormValues, ArWorkItemUpdatePayload } from '@/types/arWorkItem'
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

export function ArWorkItemsPage() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const returnTo = `${location.pathname}${location.search}`
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const [generateArWorkItems, generateArWorkItemsState] = useGenerateArWorkItemsMutation()
  const { showToast } = useToast()
  const navigate = useNavigate()
  const [markCorrectedClaimReady] = useMarkDenialReadyForCorrectedClaimMutation()
  const [markAppealReady] = useMarkDenialReadyForAppealMutation()
  const [prioritizeWithAi] = usePrioritizeArWorkItemWithAiMutation()

  async function runArAction(action: () => Promise<unknown>, summary: string) {
    try {
      await action()
      showToast({ severity: 'success', summary })
    } catch (error) {
      showToast({ severity: 'error', summary: 'AR action failed', detail: getApiErrorMessage(error) })
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
    ArWorkItem,
    ArWorkItemFormValues,
    ArWorkItemCreatePayload,
    ArWorkItemUpdatePayload
  > = useMemo(
    () => ({
      title: 'AR Work Queue',
      resourceName: 'AR Work Item',
      showCreateButton: false,
      createButtonLabel: 'Add AR Work Item',
      createDialogTitle: 'Add ar work item',
      editDialogTitle: 'Edit ar work item',
      viewDialogTitle: 'AR Work Item details',
      deleteDialogTitle: 'Delete ar work item?',
      emptyMessage: 'No ar work items found.',
      exportFileName: 'ar-work-items',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('arWorkItem', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'ar-work-items',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderArWorkItemGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createArWorkItemTableColumns(referenceOptions),
      },
      form: createArWorkItemFormConfig(referenceOptions),
      api: {
        useListQuery: useGetArWorkItemsQuery,
      },
      mapItemToFormValues: mapArWorkItemToFormValues,
      mapFormValuesToCreatePayload: mapArWorkItemFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapArWorkItemFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="arWorkItem" context={workflowContext} />
          </div>
        ),
        rowActions: (item, defaultActions) => [
          {
            label: 'Open Claim',
            icon: <Navigation className="h-4 w-4" />,
            disabled: !item.claimId || item.claimId === '',
            onClick: () => navigate(`/rcm/claims${buildWorkflowSearch(
              mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                arWorkItemId: item._id,
                returnTo,
                returnLabel: 'Back to AR Work Queue',
              }),
            )}`),
          },
          {
            label: 'Open Denial',
            icon: <FileWarning className="h-4 w-4" />,
            disabled: !item.denialId || item.denialId === '',
            onClick: () => navigate(`/rcm/denials${buildWorkflowSearch(
              mergeWorkflowContext(workflowContext, {
                denialId: item.denialId,
                arWorkItemId: item._id,
                returnTo,
                returnLabel: 'Back to AR Work Queue',
              }),
            )}`),
          },
          {
            label: 'Open Patient Billing',
            icon: <CreditCard className="h-4 w-4" />,
            disabled: !item.patientId || item.patientId === '',
            onClick: () => navigate(`/rcm/patient-billings${buildWorkflowSearch(
              mergeWorkflowContext(workflowContext, {
                patientId: item.patientId,
                arWorkItemId: item._id,
                returnTo,
                returnLabel: 'Back to AR Work Queue',
              }),
            )}`),
          },
          {
            label: 'AI Prioritize',
            icon: <Sparkles className="h-4 w-4" />,
            disabled: ['RESOLVED', 'CLOSED'].includes(item.status ?? ''),
            onClick: () => void runArAction(
              () => prioritizeWithAi(item._id).unwrap(),
              'AI prioritization completed',
            ),
          },
          {
            label: 'Corrected claim ready',
            icon: <FilePenLine className="h-4 w-4" />,
            disabled: !item.denialId || item.denialId === '' || item.status === 'RESOLVED' || item.correctedClaimRequired,
            onClick: () => void runArAction(
              () => markCorrectedClaimReady(item.denialId!).unwrap(),
              'Marked denial ready for corrected claim',
            ),
          },
          {
            label: 'Appeal ready',
            icon: <Gavel className="h-4 w-4" />,
            disabled: !item.denialId || item.denialId === '' || item.status === 'RESOLVED' || item.appealRequired,
            onClick: () => void runArAction(
              () => markAppealReady(item.denialId!).unwrap(),
              'Marked denial ready for appeal',
            ),
          },
          ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
        ],
        toolbarRight: (state) => (
          <Button
            type="button"
            label="Generate Queue"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            severity="secondary"
            outlined
            loading={generateArWorkItemsState.isLoading}
            className="flex h-8 items-center gap-1 px-3 text-xs font-semibold"
            onClick={async () => {
              try {
                await generateArWorkItems().unwrap()
                showToast({ severity: 'success', summary: 'AR queue generated', detail: 'Operational AR work items were created or refreshed.' })
                state.refetch()
              } catch (error) {
                showToast({ severity: 'error', summary: 'AR queue generation failed', detail: getApiErrorMessage(error) })
              }
            }}
          />
        ),
        viewContent: (item) => (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="arWorkItem"
              claimLabel={item.claimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.claimId,
                denialId: item.denialId,
                appealId: item.appealId,
                correctedClaimId: item.correctedClaimId,
                arWorkItemId: item._id,
                returnTo,
                returnLabel: 'Back to AR Work Queue',
              })}
              statuses={{
                denial: item.denialId ? 'OPEN' : undefined,
                appeal: item.appealId ? 'PENDING' : undefined,
                correctedClaim: item.correctedClaimId ? 'READY' : undefined,
                arWorkItem: item.status,
              }}
              nextAction={item.nextAction ?? 'Work the payer or patient follow-up item and update status.'}
            />
            {renderArWorkItemDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderArWorkItemGridItem(item, referenceOptions),
      },
    }),
    [generateArWorkItems, generateArWorkItemsState.isLoading, markAppealReady, markCorrectedClaimReady, navigate, prioritizeWithAi, referenceOptions, returnTo, showToast, workflowContext],
  )

  return <CrudPage key={workflowKey || 'ar-work-items'} config={crudConfig} />
}
