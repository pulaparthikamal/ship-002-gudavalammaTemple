import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getDarshanQuotaFormConfig,
  getDarshanQuotaTableColumns,
  mapDarshanQuotaFormToCreatePayload,
  mapDarshanQuotaFormToUpdatePayload,
  mapDarshanQuotaToFormValues,
  type DarshanQuotaFormValues,
} from '@/models/darshanQuotaModel'
import {
  useCreateDarshanQuotaMutation,
  useDeleteDarshanQuotaMutation,
  useGetDarshanQuotasQuery,
  useUpdateDarshanQuotaMutation,
  type DarshanQuota,
  type DarshanQuotaPayload,
} from '@/services/api/endpoints/darshanApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function useDarshanQuotaListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetDarshanQuotasQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function DarshanQuotaPage() {
  const { t } = useStaffTranslation()

  const darshanQuotaCrudConfig: CrudPageConfig<
    DarshanQuota,
    DarshanQuotaFormValues,
    DarshanQuotaPayload,
    Partial<DarshanQuotaPayload>
  > = useMemo(
    () => ({
      title: t('Darshan Quotas'),
      resourceName: t('Darshan Quota'),
      createButtonLabel: t('Add Quota'),
      createDialogTitle: t('Add Darshan Quota'),
      editDialogTitle: t('Edit darshan quota'),
      viewDialogTitle: t('Darshan quota details'),
      emptyMessage: t('No darshan quotas found.'),
      exportFileName: 'darshan-quotas',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'name',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'darshan',
      },
      getRowId: (quota: DarshanQuota) => quota._id,
      getRowLabel: (quota: DarshanQuota) => quota.name,
      table: {
        columns: getDarshanQuotaTableColumns(t),
      },
      form: getDarshanQuotaFormConfig(t),
      api: {
        useListQuery: useDarshanQuotaListQuery,
        useCreateMutation: useCreateDarshanQuotaMutation,
        useUpdateMutation: useUpdateDarshanQuotaMutation,
        useDeleteMutation: useDeleteDarshanQuotaMutation,
      },
      mapItemToFormValues: mapDarshanQuotaToFormValues,
      mapFormValuesToCreatePayload: mapDarshanQuotaFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: DarshanQuotaFormValues) => mapDarshanQuotaFormToUpdatePayload(values),
      deleteDialogMessage: (quota: DarshanQuota) => t('This will permanently delete {{name}}.', { name: quota.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={darshanQuotaCrudConfig} />
    </div>
  )
}
