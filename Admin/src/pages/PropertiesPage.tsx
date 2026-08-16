import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getPropertyFormConfig,
  getPropertyTableColumns,
  getRenderPropertyDetails,
  getRenderPropertyGridItem,
  mapPropertyFormToCreatePayload,
  mapPropertyFormToUpdatePayload,
  mapPropertyToFormValues,
} from '@/models/propertyModel'
import {
  useBulkDeletePropertiesMutation,
  useCreatePropertyMutation,
  useDeletePropertyMutation,
  useGetPropertiesQuery,
  useUpdatePropertyMutation,
} from '@/services/api/endpoints/propertiesApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Property, PropertyCreatePayload, PropertyFormValues, PropertyUpdatePayload } from '@/types/property'

type PropertyBulkDeletePayload = {
  ids: EntityId[]
}

export function PropertiesPage() {
  const { t } = useStaffTranslation()

  const propertiesCrudConfig: CrudPageConfig<
    Property,
    PropertyFormValues,
    PropertyCreatePayload,
    PropertyUpdatePayload,
    PropertyBulkDeletePayload
  > = useMemo(
    () => ({
      title: t('Properties'),
      resourceName: t('Property'),
      createButtonLabel: t('Add Property'),
      createDialogTitle: t('Add Property'),
      editDialogTitle: t('Edit property'),
      viewDialogTitle: t('Property details'),
      emptyMessage: t('No properties found.'),
      exportFileName: 'properties',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'property',
      },
      getRowId: (property: Property) => property._id,
      getRowLabel: (property: Property) => property.name,
      table: {
        columns: getPropertyTableColumns(t),
      },
      form: getPropertyFormConfig(t),
      api: {
        useBulkDeleteMutation: useBulkDeletePropertiesMutation,
        useListQuery: useGetPropertiesQuery,
        useCreateMutation: useCreatePropertyMutation,
        useUpdateMutation: useUpdatePropertyMutation,
        useDeleteMutation: useDeletePropertyMutation,
      },
      mapItemToFormValues: mapPropertyToFormValues,
      mapFormValuesToCreatePayload: mapPropertyFormToCreatePayload,
      mapFormValuesToUpdatePayload: mapPropertyFormToUpdatePayload,
      bulkDelete: {
        buttonLabel: t('staff.crud.deleteSelected'),
        confirmTitle: t('Delete selected properties?'),
        confirmLabel: t('staff.crud.deleteSelected'),
        confirmMessage: (properties: Property[]) =>
          t('staff.crud.deleteSelectedMessage', {
            count: properties.length,
            resource: properties.length === 1 ? t('Property') : t('Properties'),
          }),
        successMessage: (properties: Property[]) =>
          t('staff.crud.bulkDeletedSuccess', {
            count: properties.length,
            resource: properties.length === 1 ? t('Property') : t('Properties'),
          }),
        mapSelectedItemsToPayload: (properties: Property[]) => ({
          ids: properties.map((property) => property._id),
        }),
      },
      deleteDialogMessage: (property: Property) => t('This will permanently delete {{name}}.', { name: property.name }),
      slots: {
        viewContent: getRenderPropertyDetails(t),
        gridItem: getRenderPropertyGridItem(t),
      },
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={propertiesCrudConfig} />
    </div>
  )
}
