import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  mapPrasadamItemFormToCreatePayload,
  mapPrasadamItemFormToUpdatePayload,
  mapPrasadamItemToFormValues,
  getPrasadamItemFormConfig,
  getPrasadamItemTableColumns,
  type PrasadamItemFormValues,
} from '@/models/prasadamItemModel'
import {
  useCreatePrasadamItemMutation,
  useDeletePrasadamItemMutation,
  useGetPrasadamItemsQuery,
  useUpdatePrasadamItemMutation,
  type PrasadamItem,
  type PrasadamItemPayload,
} from '@/services/api/endpoints/prasadamApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function usePrasadamItemListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetPrasadamItemsQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function PrasadamItemPage() {
  const { t } = useStaffTranslation()

  const prasadamItemCrudConfig: CrudPageConfig<
    PrasadamItem,
    PrasadamItemFormValues,
    PrasadamItemPayload,
    Partial<PrasadamItemPayload>
  > = useMemo(
    () => ({
      title: t('Prasadam Items'),
      resourceName: t('Prasadam Item'),
      createButtonLabel: t('Add Item'),
      createDialogTitle: t('Add Prasadam Item'),
      editDialogTitle: t('Edit prasadam item'),
      viewDialogTitle: t('Prasadam item details'),
      emptyMessage: t('No prasadam items found.'),
      exportFileName: 'prasadam-items',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'name',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'prasadamItem',
      },
      getRowId: (item: PrasadamItem) => item._id,
      getRowLabel: (item: PrasadamItem) => item.name,
      table: {
        columns: getPrasadamItemTableColumns(t),
      },
      form: getPrasadamItemFormConfig(t),
      api: {
        useListQuery: usePrasadamItemListQuery,
        useCreateMutation: useCreatePrasadamItemMutation,
        useUpdateMutation: useUpdatePrasadamItemMutation,
        useDeleteMutation: useDeletePrasadamItemMutation,
      },
      mapItemToFormValues: mapPrasadamItemToFormValues,
      mapFormValuesToCreatePayload: mapPrasadamItemFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: PrasadamItemFormValues) => mapPrasadamItemFormToUpdatePayload(values),
      deleteDialogMessage: (item: PrasadamItem) => t('This will permanently delete {{name}}.', { name: item.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={prasadamItemCrudConfig} />
    </div>
  )
}
