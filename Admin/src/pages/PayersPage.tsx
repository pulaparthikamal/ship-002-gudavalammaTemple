import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createPayerFormConfig, createPayerTableColumns, mapPayerFormToPayload, mapPayerToFormValues, renderPayerDetails, renderPayerGridItem } from '@/models/payerModel'
import { useBulkDeletePayersMutation, useCreatePayerMutation, useDeletePayerMutation, useGetPayersQuery, useUpdatePayerMutation } from '@/services/api/endpoints/payersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Payer, PayerCreatePayload, PayerFormValues, PayerUpdatePayload } from '@/types/payer'

type BulkDeletePayload = {
  ids: EntityId[]
}


export function PayersPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    Payer,
    PayerFormValues,
    PayerCreatePayload,
    PayerUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Payers',
      resourceName: 'Payer',
      createButtonLabel: 'Add Payer',
      createDialogTitle: 'Add payer',
      editDialogTitle: 'Edit payer',
      viewDialogTitle: 'Payer details',
      deleteDialogTitle: 'Delete payer?',
      emptyMessage: 'No payers found.',
      exportFileName: 'payers',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'payers',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderPayerGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createPayerTableColumns(referenceOptions),
      },
      form: createPayerFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeletePayersMutation,
        useListQuery: useGetPayersQuery,
        useCreateMutation: useCreatePayerMutation,
        useUpdateMutation: useUpdatePayerMutation,
        useDeleteMutation: useDeletePayerMutation,
      },
      mapItemToFormValues: mapPayerToFormValues,
      mapFormValuesToCreatePayload: mapPayerFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapPayerFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected payers?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'payer' : 'payers'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'payer' : 'payers'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => renderPayerDetails(item, referenceOptions),
        gridItem: (item) => renderPayerGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
