import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getDonorFormConfig,
  getDonorTableColumns,
  getRenderDonorDetails,
  getRenderDonorGridItem,
  mapDonorFormToCreatePayload,
  mapDonorFormToUpdatePayload,
  mapDonorToFormValues,
} from '@/models/donorModel'
import {
  useBulkDeleteDonorsMutation,
  useCreateDonorMutation,
  useDeleteDonorMutation,
  useGetDonorsQuery,
  useUpdateDonorMutation,
} from '@/services/api/endpoints/donorsApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Donor, DonorCreatePayload, DonorFormValues, DonorUpdatePayload } from '@/types/donor'

type DonorBulkDeletePayload = {
  ids: EntityId[]
}

export function DonorsPage() {
  const { t } = useStaffTranslation()

  const donorsCrudConfig: CrudPageConfig<
    Donor,
    DonorFormValues,
    DonorCreatePayload,
    DonorUpdatePayload,
    DonorBulkDeletePayload
  > = useMemo(
    () => ({
      title: t('Donors'),
      resourceName: t('Donor'),
      createButtonLabel: t('Add Donor'),
      createDialogTitle: t('Add Donor'),
      editDialogTitle: t('Edit donor'),
      viewDialogTitle: t('Donor details'),
      emptyMessage: t('No donors found.'),
      exportFileName: 'donors',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'donor',
      },
      getRowId: (donor: Donor) => donor._id,
      getRowLabel: (donor: Donor) => donor.name,
      table: {
        columns: getDonorTableColumns(t),
      },
      form: getDonorFormConfig(t),
      api: {
        useBulkDeleteMutation: useBulkDeleteDonorsMutation,
        useListQuery: useGetDonorsQuery,
        useCreateMutation: useCreateDonorMutation,
        useUpdateMutation: useUpdateDonorMutation,
        useDeleteMutation: useDeleteDonorMutation,
      },
      mapItemToFormValues: mapDonorToFormValues,
      mapFormValuesToCreatePayload: mapDonorFormToCreatePayload,
      mapFormValuesToUpdatePayload: mapDonorFormToUpdatePayload,
      bulkDelete: {
        buttonLabel: t('staff.crud.deleteSelected'),
        confirmTitle: t('Delete selected donors?'),
        confirmLabel: t('staff.crud.deleteSelected'),
        confirmMessage: (donors: Donor[]) =>
          t('staff.crud.deleteSelectedMessage', {
            count: donors.length,
            resource: donors.length === 1 ? t('Donor') : t('Donors'),
          }),
        successMessage: (donors: Donor[]) =>
          t('staff.crud.bulkDeletedSuccess', {
            count: donors.length,
            resource: donors.length === 1 ? t('Donor') : t('Donors'),
          }),
        mapSelectedItemsToPayload: (donors: Donor[]) => ({
          ids: donors.map((donor) => donor._id),
        }),
      },
      deleteDialogMessage: (donor: Donor) => t('This will permanently delete {{name}}.', { name: donor.name }),
      slots: {
        viewContent: getRenderDonorDetails(t),
        gridItem: getRenderDonorGridItem(t),
      },
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={donorsCrudConfig} />
    </div>
  )
}
