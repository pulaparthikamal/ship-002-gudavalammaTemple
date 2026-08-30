import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getNearbyPlaceFormConfig,
  getNearbyPlaceTableColumns,
  mapNearbyPlaceFormToCreatePayload,
  mapNearbyPlaceFormToUpdatePayload,
  mapNearbyPlaceToFormValues,
  type NearbyPlaceFormValues,
} from '@/models/nearbyPlaceModel'
import {
  useCreateNearbyPlaceMutation,
  useDeleteNearbyPlaceMutation,
  useGetNearbyPlacesQuery,
  useUpdateNearbyPlaceMutation,
  type NearbyPlace,
  type NearbyPlacePayload,
} from '@/services/api/endpoints/nearbyPlacesApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function useNearbyPlaceListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetNearbyPlacesQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function NearbyPlacesPage() {
  const { t } = useStaffTranslation()

  const nearbyPlaceCrudConfig: CrudPageConfig<
    NearbyPlace,
    NearbyPlaceFormValues,
    NearbyPlacePayload,
    Partial<NearbyPlacePayload>
  > = useMemo(
    () => ({
      title: t('Nearby Places'),
      resourceName: t('Place'),
      createButtonLabel: t('Add Place'),
      createDialogTitle: t('Add nearby place'),
      editDialogTitle: t('Edit nearby place'),
      viewDialogTitle: t('Place details'),
      emptyMessage: t('No nearby places found.'),
      exportFileName: 'nearby-places',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'distanceKm',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'nearbyPlace',
      },
      getRowId: (place: NearbyPlace) => place._id,
      getRowLabel: (place: NearbyPlace) => place.name,
      table: {
        columns: getNearbyPlaceTableColumns(t),
      },
      form: getNearbyPlaceFormConfig(t),
      api: {
        useListQuery: useNearbyPlaceListQuery,
        useCreateMutation: useCreateNearbyPlaceMutation,
        useUpdateMutation: useUpdateNearbyPlaceMutation,
        useDeleteMutation: useDeleteNearbyPlaceMutation,
      },
      mapItemToFormValues: mapNearbyPlaceToFormValues,
      mapFormValuesToCreatePayload: mapNearbyPlaceFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: NearbyPlaceFormValues) => mapNearbyPlaceFormToUpdatePayload(values),
      deleteDialogMessage: (place: NearbyPlace) =>
        t('This will permanently delete "{{name}}".', { name: place.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={nearbyPlaceCrudConfig} />
    </div>
  )
}
