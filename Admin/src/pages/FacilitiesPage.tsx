import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createFacilityFormConfig, createFacilityTableColumns, mapFacilityFormToPayload, mapFacilityToFormValues, renderFacilityDetails, renderFacilityGridItem } from '@/models/facilityModel'
import { useBulkDeleteFacilitiesMutation, useCreateFacilityMutation, useDeleteFacilityMutation, useGetFacilitiesQuery, useUpdateFacilityMutation } from '@/services/api/endpoints/facilitiesApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Facility, FacilityCreatePayload, FacilityFormValues, FacilityUpdatePayload } from '@/types/facility'

type BulkDeletePayload = {
  ids: EntityId[]
}


export function FacilitiesPage() {
  const referenceOptions: RcmReferenceOptions = useMemo(() => ({}), [])

  const crudConfig: CrudPageConfig<
    Facility,
    FacilityFormValues,
    FacilityCreatePayload,
    FacilityUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Facilities',
      resourceName: 'Facility',
      createButtonLabel: 'Add Facility',
      createDialogTitle: 'Add facility',
      editDialogTitle: 'Edit facility',
      viewDialogTitle: 'Facility details',
      deleteDialogTitle: 'Delete facility?',
      emptyMessage: 'No facilities found.',
      exportFileName: 'facilities',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'facilities',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderFacilityGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createFacilityTableColumns(referenceOptions),
      },
      form: createFacilityFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteFacilitiesMutation,
        useListQuery: useGetFacilitiesQuery,
        useCreateMutation: useCreateFacilityMutation,
        useUpdateMutation: useUpdateFacilityMutation,
        useDeleteMutation: useDeleteFacilityMutation,
      },
      mapItemToFormValues: mapFacilityToFormValues,
      mapFormValuesToCreatePayload: mapFacilityFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapFacilityFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected facilities?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'facility' : 'facilities'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'facility' : 'facilities'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => renderFacilityDetails(item, referenceOptions),
        gridItem: (item) => renderFacilityGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
