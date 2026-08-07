import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createChargeMasterFormConfig,
  createChargeMasterTableColumns,
  getChargeMasterLabel,
  mapChargeMasterFormToPayload,
  mapChargeMasterToFormValues,
  renderChargeMasterDetails,
  renderChargeMasterGridItem,
} from '@/models/chargeMasterModel'
import { useBulkDeleteChargeMastersMutation, useCreateChargeMasterMutation, useDeleteChargeMasterMutation, useGetChargeMastersQuery, useUpdateChargeMasterMutation } from '@/services/api/endpoints/chargeMastersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ChargeMaster, ChargeMasterCreatePayload, ChargeMasterFormValues, ChargeMasterUpdatePayload } from '@/types/chargeMaster'

type BulkDeletePayload = {
  ids: EntityId[]
}


export function ChargeMastersPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    ChargeMaster,
    ChargeMasterFormValues,
    ChargeMasterCreatePayload,
    ChargeMasterUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Charge Masters',
      resourceName: 'Charge Master',
      createButtonLabel: 'Add Charge Master',
      createDialogTitle: 'Add charge master',
      editDialogTitle: 'Edit charge master',
      viewDialogTitle: 'Charge Master details',
      deleteDialogTitle: 'Delete charge master?',
      emptyMessage: 'No charge masters found.',
      exportFileName: 'charge-masters',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'cptCode',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'charge-masters',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getChargeMasterLabel(item, referenceOptions),
      table: {
        columns: createChargeMasterTableColumns(referenceOptions),
      },
      form: createChargeMasterFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteChargeMastersMutation,
        useListQuery: useGetChargeMastersQuery,
        useCreateMutation: useCreateChargeMasterMutation,
        useUpdateMutation: useUpdateChargeMasterMutation,
        useDeleteMutation: useDeleteChargeMasterMutation,
      },
      mapItemToFormValues: mapChargeMasterToFormValues,
      mapFormValuesToCreatePayload: mapChargeMasterFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapChargeMasterFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected charge masters?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'charge master' : 'charge masters'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'charge master' : 'charge masters'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => renderChargeMasterDetails(item, referenceOptions),
        gridItem: (item) => renderChargeMasterGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
