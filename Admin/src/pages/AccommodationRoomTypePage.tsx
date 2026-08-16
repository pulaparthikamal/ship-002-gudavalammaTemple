import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getAccommodationRoomTypeFormConfig,
  getAccommodationRoomTypeTableColumns,
  mapAccommodationRoomTypeFormToCreatePayload,
  mapAccommodationRoomTypeFormToUpdatePayload,
  mapAccommodationRoomTypeToFormValues,
  type AccommodationRoomTypeFormValues,
} from '@/models/accommodationRoomTypeModel'
import {
  useCreateAccommodationRoomTypeMutation,
  useDeleteAccommodationRoomTypeMutation,
  useGetAccommodationRoomTypesQuery,
  useUpdateAccommodationRoomTypeMutation,
  type AccommodationRoomType,
  type AccommodationRoomTypePayload,
} from '@/services/api/endpoints/accommodationApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function useAccommodationRoomTypeListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetAccommodationRoomTypesQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function AccommodationRoomTypePage() {
  const { t } = useStaffTranslation()

  const accommodationRoomTypeCrudConfig: CrudPageConfig<
    AccommodationRoomType,
    AccommodationRoomTypeFormValues,
    AccommodationRoomTypePayload,
    Partial<AccommodationRoomTypePayload>
  > = useMemo(
    () => ({
      title: t('Accommodation Room Types'),
      resourceName: t('Room Type'),
      createButtonLabel: t('Add Room Type'),
      createDialogTitle: t('Add Room Type'),
      editDialogTitle: t('Edit room type'),
      viewDialogTitle: t('Room type details'),
      emptyMessage: t('No room types found.'),
      exportFileName: 'accommodation-room-types',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'name',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'accommodationRoomType',
      },
      getRowId: (roomType: AccommodationRoomType) => roomType._id,
      getRowLabel: (roomType: AccommodationRoomType) => roomType.name,
      table: {
        columns: getAccommodationRoomTypeTableColumns(t),
      },
      form: getAccommodationRoomTypeFormConfig(t),
      api: {
        useListQuery: useAccommodationRoomTypeListQuery,
        useCreateMutation: useCreateAccommodationRoomTypeMutation,
        useUpdateMutation: useUpdateAccommodationRoomTypeMutation,
        useDeleteMutation: useDeleteAccommodationRoomTypeMutation,
      },
      mapItemToFormValues: mapAccommodationRoomTypeToFormValues,
      mapFormValuesToCreatePayload: mapAccommodationRoomTypeFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: AccommodationRoomTypeFormValues) =>
        mapAccommodationRoomTypeFormToUpdatePayload(values),
      deleteDialogMessage: (roomType: AccommodationRoomType) =>
        t('This will permanently delete {{name}}.', { name: roomType.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={accommodationRoomTypeCrudConfig} />
    </div>
  )
}
