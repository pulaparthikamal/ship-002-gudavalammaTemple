import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getLiabilityFormConfig,
  getLiabilityTableColumns,
  getRenderLiabilityDetails,
  getRenderLiabilityGridItem,
  mapLiabilityFormToCreatePayload,
  mapLiabilityFormToUpdatePayload,
  mapLiabilityToFormValues,
} from '@/models/liabilityModel'
import {
  useBulkDeleteLiabilitiesMutation,
  useCreateLiabilityMutation,
  useDeleteLiabilityMutation,
  useGetLiabilitiesQuery,
  useUpdateLiabilityMutation,
} from '@/services/api/endpoints/liabilitiesApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Liability, LiabilityCreatePayload, LiabilityFormValues, LiabilityUpdatePayload } from '@/types/liability'

type LiabilityBulkDeletePayload = {
  ids: EntityId[]
}

export function LiabilitiesPage() {
  const { t } = useStaffTranslation()

  const liabilitiesCrudConfig: CrudPageConfig<
    Liability,
    LiabilityFormValues,
    LiabilityCreatePayload,
    LiabilityUpdatePayload,
    LiabilityBulkDeletePayload
  > = useMemo(
    () => ({
      title: t('Liabilities'),
      resourceName: t('Liability'),
      createButtonLabel: t('Add Liability'),
      createDialogTitle: t('Add Liability'),
      editDialogTitle: t('Edit liability'),
      viewDialogTitle: t('Liability details'),
      emptyMessage: t('No liabilities found.'),
      exportFileName: 'liabilities',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'liability',
      },
      getRowId: (liability: Liability) => liability._id,
      getRowLabel: (liability: Liability) => liability.name,
      table: {
        columns: getLiabilityTableColumns(t),
      },
      form: getLiabilityFormConfig(t),
      api: {
        useBulkDeleteMutation: useBulkDeleteLiabilitiesMutation,
        useListQuery: useGetLiabilitiesQuery,
        useCreateMutation: useCreateLiabilityMutation,
        useUpdateMutation: useUpdateLiabilityMutation,
        useDeleteMutation: useDeleteLiabilityMutation,
      },
      mapItemToFormValues: mapLiabilityToFormValues,
      mapFormValuesToCreatePayload: mapLiabilityFormToCreatePayload,
      mapFormValuesToUpdatePayload: mapLiabilityFormToUpdatePayload,
      bulkDelete: {
        buttonLabel: t('staff.crud.deleteSelected'),
        confirmTitle: t('Delete selected liabilities?'),
        confirmLabel: t('staff.crud.deleteSelected'),
        confirmMessage: (liabilities: Liability[]) =>
          t('staff.crud.deleteSelectedMessage', {
            count: liabilities.length,
            resource: liabilities.length === 1 ? t('Liability') : t('Liabilities'),
          }),
        successMessage: (liabilities: Liability[]) =>
          t('staff.crud.bulkDeletedSuccess', {
            count: liabilities.length,
            resource: liabilities.length === 1 ? t('Liability') : t('Liabilities'),
          }),
        mapSelectedItemsToPayload: (liabilities: Liability[]) => ({
          ids: liabilities.map((liability) => liability._id),
        }),
      },
      deleteDialogMessage: (liability: Liability) => t('This will permanently delete {{name}}.', { name: liability.name }),
      slots: {
        viewContent: getRenderLiabilityDetails(t),
        gridItem: getRenderLiabilityGridItem(t),
      },
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={liabilitiesCrudConfig} />
    </div>
  )
}
