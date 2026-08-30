import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getSevaCatalogFormConfig,
  getSevaCatalogTableColumns,
  mapSevaFormToCreatePayload,
  mapSevaFormToUpdatePayload,
  mapSevaToFormValues,
  type SevaCatalogFormValues,
} from '@/models/sevaCatalogModel'
import {
  useCreateSevaMutation,
  useDeleteSevaMutation,
  useGetSevasQuery,
  useUpdateSevaMutation,
  type Seva,
  type SevaCatalogPayload,
} from '@/services/api/endpoints/sevaApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function useSevaCatalogListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetSevasQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function SevaCatalogPage() {
  const { t } = useStaffTranslation()

  const sevaCatalogCrudConfig: CrudPageConfig<
    Seva,
    SevaCatalogFormValues,
    SevaCatalogPayload,
    Partial<SevaCatalogPayload>
  > = useMemo(
    () => ({
      title: t('Seva Catalog'),
      resourceName: t('Seva'),
      createButtonLabel: t('Add Seva'),
      createDialogTitle: t('Add Seva'),
      editDialogTitle: t('Edit seva'),
      viewDialogTitle: t('Seva details'),
      emptyMessage: t('No sevas found.'),
      exportFileName: 'seva-catalog',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'name',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'seva',
      },
      getRowId: (seva: Seva) => seva._id,
      getRowLabel: (seva: Seva) => seva.name,
      table: {
        columns: getSevaCatalogTableColumns(t),
      },
      form: getSevaCatalogFormConfig(t),
      api: {
        useListQuery: useSevaCatalogListQuery,
        useCreateMutation: useCreateSevaMutation,
        useUpdateMutation: useUpdateSevaMutation,
        useDeleteMutation: useDeleteSevaMutation,
      },
      mapItemToFormValues: mapSevaToFormValues,
      mapFormValuesToCreatePayload: mapSevaFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: SevaCatalogFormValues) => mapSevaFormToUpdatePayload(values),
      deleteDialogMessage: (seva: Seva) => t('This will permanently delete {{name}}.', { name: seva.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={sevaCatalogCrudConfig} />
    </div>
  )
}
