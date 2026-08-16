import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getFacilityFormConfig,
  getFacilityTableColumns,
  mapFacilityFormToCreatePayload,
  mapFacilityFormToUpdatePayload,
  mapFacilityToFormValues,
  type FacilityFormValues,
} from '@/models/facilityModel'
import {
  useCreateFacilityMutation,
  useDeleteFacilityMutation,
  useGetAllFacilitiesQuery,
  useUpdateFacilityMutation,
  type Facility,
  type FacilityPayload,
} from '@/services/api/endpoints/facilityApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

// Staff catalog management must use the full list (/facilities/all), not the
// public active-only feed (/facilities) used by the devotee-facing pages.
function useFacilityListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetAllFacilitiesQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function FacilityPage() {
  const { t } = useStaffTranslation()

  const facilityCrudConfig: CrudPageConfig<
    Facility,
    FacilityFormValues,
    FacilityPayload,
    Partial<FacilityPayload>
  > = useMemo(
    () => ({
      title: t('Facilities'),
      resourceName: t('Facility'),
      createButtonLabel: t('Add Facility'),
      createDialogTitle: t('Add Facility'),
      editDialogTitle: t('Edit facility'),
      viewDialogTitle: t('Facility details'),
      emptyMessage: t('No facilities found.'),
      exportFileName: 'facilities',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'name',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'facility',
      },
      getRowId: (facility: Facility) => facility._id,
      getRowLabel: (facility: Facility) => facility.name,
      table: {
        columns: getFacilityTableColumns(t),
      },
      form: getFacilityFormConfig(t),
      api: {
        useListQuery: useFacilityListQuery,
        useCreateMutation: useCreateFacilityMutation,
        useUpdateMutation: useUpdateFacilityMutation,
        useDeleteMutation: useDeleteFacilityMutation,
      },
      mapItemToFormValues: mapFacilityToFormValues,
      mapFormValuesToCreatePayload: mapFacilityFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: FacilityFormValues) => mapFacilityFormToUpdatePayload(values),
      deleteDialogMessage: (facility: Facility) =>
        t('This will permanently delete {{name}}.', { name: facility.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={facilityCrudConfig} />
    </div>
  )
}
