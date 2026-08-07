import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createAdjustmentFormConfig, createAdjustmentTableColumns, mapAdjustmentFormToPayload, mapAdjustmentToFormValues, renderAdjustmentDetails, renderAdjustmentGridItem } from '@/models/adjustmentModel'
import { useGetAdjustmentsQuery } from '@/services/api/endpoints/adjustmentsApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Adjustment, AdjustmentCreatePayload, AdjustmentFormValues, AdjustmentUpdatePayload } from '@/types/adjustment'
import { readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function AdjustmentsPage() {
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const claimsQuery = useGetClaimsQuery(lookupQuery)

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
    Adjustment,
    AdjustmentFormValues,
    AdjustmentCreatePayload,
    AdjustmentUpdatePayload
  > = useMemo(
    () => ({
      title: 'Adjustments / Write-offs',
      resourceName: 'Adjustment',
      showCreateButton: false,
      createButtonLabel: 'Add Adjustment',
      createDialogTitle: 'Add adjustment',
      editDialogTitle: 'Edit adjustment',
      viewDialogTitle: 'Adjustment details',
      deleteDialogTitle: 'Delete adjustment?',
      emptyMessage: 'No adjustments found.',
      exportFileName: 'adjustments',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'adjustments',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderAdjustmentGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createAdjustmentTableColumns(referenceOptions),
      },
      form: createAdjustmentFormConfig(referenceOptions),
      api: {
        useListQuery: useGetAdjustmentsQuery,
      },
      mapItemToFormValues: mapAdjustmentToFormValues,
      mapFormValuesToCreatePayload: mapAdjustmentFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapAdjustmentFormToPayload(values),
      slots: {
        rowActions: (_item, defaultActions) =>
          defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
        viewContent: (item) => renderAdjustmentDetails(item, referenceOptions),
        gridItem: (item) => renderAdjustmentGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions, workflowContext.dashboardEntityId, workflowContext.dashboardQueue],
  )

  return <CrudPage key={workflowKey || 'adjustments'} config={crudConfig} />
}
