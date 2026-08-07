import { useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { FilePenLine, FileText, FileWarning, Send } from 'lucide-react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { createCorrectedClaimFormConfig, createCorrectedClaimTableColumns, mapCorrectedClaimFormToPayload, mapCorrectedClaimToFormValues, renderCorrectedClaimDetails, renderCorrectedClaimGridItem } from '@/models/correctedClaimModel'
import { useGetCorrectedClaimsQuery, useSubmitCorrectedClaimMutation } from '@/services/api/endpoints/correctedClaimsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { CorrectedClaim, CorrectedClaimCreatePayload, CorrectedClaimFormValues, CorrectedClaimUpdatePayload } from '@/types/correctedClaim'
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

export function CorrectedClaimsPage() {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const [submitCorrectedClaim] = useSubmitCorrectedClaimMutation()
  const returnTo = `${location.pathname}${location.search}`

  function correctedClaimContext(item: CorrectedClaim) {
    return mergeWorkflowContext(workflowContext, {
      claimId: item.clonedClaimId ?? item.originalClaimId ?? item.correctedFromClaimId,
      denialId: item.sourceDenialId ?? item.denialId,
      correctedClaimId: item._id,
      returnTo,
      returnLabel: 'Back to Corrected Claims',
    })
  }

  async function handleSubmitCorrectedClaim(item: CorrectedClaim) {
    try {
      await submitCorrectedClaim(item._id).unwrap()
      showToast({ severity: 'success', summary: 'Corrected claim submitted' })
    } catch (error) {
      showToast({ severity: 'error', summary: 'Corrected claim submission failed', detail: getApiErrorMessage(error) })
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

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      claims: claimsOptions,
    }),
    [claimsOptions],
  )

  const crudConfig: CrudPageConfig<
    CorrectedClaim,
    CorrectedClaimFormValues,
    CorrectedClaimCreatePayload,
    CorrectedClaimUpdatePayload
  > = useMemo(
    () => ({
      title: 'Corrected Claims / Resubmissions',
      resourceName: 'Corrected Claim',
      showCreateButton: false,
      createButtonLabel: 'Add Corrected Claim',
      createDialogTitle: 'Add corrected claim',
      editDialogTitle: 'Edit corrected claim',
      viewDialogTitle: 'Corrected Claim details',
      deleteDialogTitle: 'Delete corrected claim?',
      emptyMessage: 'No corrected claims found.',
      exportFileName: 'corrected-claims',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('correctedClaim', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'corrected-claims',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderCorrectedClaimGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createCorrectedClaimTableColumns(referenceOptions),
      },
      form: createCorrectedClaimFormConfig(referenceOptions),
      api: {
        useListQuery: useGetCorrectedClaimsQuery,
      },
      mapItemToFormValues: mapCorrectedClaimToFormValues,
      mapFormValuesToCreatePayload: mapCorrectedClaimFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapCorrectedClaimFormToPayload(values),
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="correctedClaim" context={workflowContext} />
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const viewOnlyDefaults = defaultActions.filter((action) => {
            const label = typeof action.label === 'function' ? action.label(item) : action.label
            return label.toLowerCase().includes('view')
          })
          const context = correctedClaimContext(item)
          const claimId = item.clonedClaimId ?? item.originalClaimId ?? item.correctedFromClaimId
          const originalClaimId = item.originalClaimId ?? item.correctedFromClaimId
          const denialId = item.sourceDenialId ?? item.denialId

          return [
            ...viewOnlyDefaults,
            {
              label: 'Open Original Claim',
              icon: <FileText className="h-4 w-4" />,
              disabled: !originalClaimId,
              onClick: () => navigate(`/rcm/claims${buildWorkflowSearch({ ...context, claimId: originalClaimId })}`),
            },
            {
              label: 'View Denial/Rejection',
              icon: <FileWarning className="h-4 w-4" />,
              disabled: !denialId,
              onClick: () => navigate(`/rcm/denials${buildWorkflowSearch({ ...context, denialId })}`),
            },
            {
              label: 'Open Cloned Claim',
              icon: <FilePenLine className="h-4 w-4" />,
              disabled: !claimId,
              onClick: () => navigate(`/rcm/claims${buildWorkflowSearch({ ...context, claimId })}`),
            },
            {
              label: 'Submit corrected claim',
              icon: <Send className="h-4 w-4" />,
              disabled: item.correctedClaimStatus === 'SUBMITTED' || !item.clonedClaimId,
              onClick: () => void handleSubmitCorrectedClaim(item),
            },
          ]
        },
        viewContent: (item) => (
          <div className="space-y-4">
            <RcmClaimLifecycleTimeline
              currentStage="correctedClaim"
              claimLabel={item.clonedClaimId ?? item.correctedFromClaimId}
              context={mergeWorkflowContext(workflowContext, {
                claimId: item.clonedClaimId ?? item.correctedFromClaimId,
                denialId: item.sourceDenialId ?? item.denialId,
                correctedClaimId: item._id,
                returnTo,
                returnLabel: 'Back to Corrected Claims',
              })}
              statuses={{
                denial: item.sourceDenialId ?? item.denialId ? 'CORRECTED_CLAIM_READY' : undefined,
                correctedClaim: item.correctedClaimStatus,
                claimSubmission: item.correctedClaimStatus === 'SUBMITTED' ? 'Submitted' : undefined,
              }}
              nextAction={
                item.correctedClaimStatus === 'SUBMITTED'
                  ? 'Track the corrected claim acknowledgement and payer response.'
                  : item.clonedClaimId
                    ? 'Open the cloned claim, make corrections, run readiness, then submit corrected claim.'
                    : 'Create the corrected claim clone from the denial workflow.'
              }
            />
            {renderCorrectedClaimDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderCorrectedClaimGridItem(item, referenceOptions),
      },
    }),
    [navigate, referenceOptions, returnTo, submitCorrectedClaim, workflowContext],
  )

  return <CrudPage key={workflowKey || 'corrected-claims'} config={crudConfig} />
}
