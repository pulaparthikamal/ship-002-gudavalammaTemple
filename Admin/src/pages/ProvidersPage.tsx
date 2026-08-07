import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createProviderFormConfig, createProviderTableColumns, mapProviderFormToPayload, mapProviderToFormValues, renderProviderDetails, renderProviderGridItem } from '@/models/providerModel'
import { useBulkDeleteProvidersMutation, useCreateProviderMutation, useDeleteProviderMutation, useGetProvidersQuery, useUpdateProviderMutation } from '@/services/api/endpoints/providersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Provider, ProviderCreatePayload, ProviderFormValues, ProviderUpdatePayload } from '@/types/provider'

type BulkDeletePayload = {
  ids: EntityId[]
}


export function ProvidersPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    Provider,
    ProviderFormValues,
    ProviderCreatePayload,
    ProviderUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Providers',
      resourceName: 'Provider',
      createButtonLabel: 'Add Provider',
      createDialogTitle: 'Add provider',
      editDialogTitle: 'Edit provider',
      viewDialogTitle: 'Provider details',
      deleteDialogTitle: 'Delete provider?',
      emptyMessage: 'No providers found.',
      exportFileName: 'providers',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'providers',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderProviderGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createProviderTableColumns(referenceOptions),
      },
      form: createProviderFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteProvidersMutation,
        useListQuery: useGetProvidersQuery,
        useCreateMutation: useCreateProviderMutation,
        useUpdateMutation: useUpdateProviderMutation,
        useDeleteMutation: useDeleteProviderMutation,
      },
      mapItemToFormValues: mapProviderToFormValues,
      mapFormValuesToCreatePayload: mapProviderFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapProviderFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected providers?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'provider' : 'providers'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'provider' : 'providers'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => renderProviderDetails(item, referenceOptions),
        gridItem: (item) => renderProviderGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
