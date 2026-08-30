import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getTempleEventFormConfig,
  getTempleEventTableColumns,
  mapTempleEventFormToCreatePayload,
  mapTempleEventFormToUpdatePayload,
  mapTempleEventToFormValues,
  type TempleEventFormValues,
} from '@/models/templeEventModel'
import {
  useCreateTempleEventMutation,
  useDeleteTempleEventMutation,
  useGetTempleEventsQuery,
  useUpdateTempleEventMutation,
  type TempleEvent,
  type TempleEventPayload,
} from '@/services/api/endpoints/templeEventsApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig } from '@/types/crud'

function useTempleEventListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetTempleEventsQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function EventsPage() {
  const { t } = useStaffTranslation()

  const templeEventCrudConfig: CrudPageConfig<
    TempleEvent,
    TempleEventFormValues,
    TempleEventPayload,
    Partial<TempleEventPayload>
  > = useMemo(
    () => ({
      title: t('Events'),
      resourceName: t('Event'),
      createButtonLabel: t('Add Event'),
      createDialogTitle: t('Add Event'),
      editDialogTitle: t('Edit event'),
      viewDialogTitle: t('Event details'),
      emptyMessage: t('No events found.'),
      exportFileName: 'events',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'startDate',
        direction: 'asc',
        criteria: [],
      },
      permissions: {
        module: 'templeEvent',
      },
      getRowId: (event: TempleEvent) => event._id,
      getRowLabel: (event: TempleEvent) => event.name,
      table: {
        columns: getTempleEventTableColumns(t),
      },
      form: getTempleEventFormConfig(t),
      api: {
        useListQuery: useTempleEventListQuery,
        useCreateMutation: useCreateTempleEventMutation,
        useUpdateMutation: useUpdateTempleEventMutation,
        useDeleteMutation: useDeleteTempleEventMutation,
      },
      mapItemToFormValues: mapTempleEventToFormValues,
      mapFormValuesToCreatePayload: mapTempleEventFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: TempleEventFormValues) => mapTempleEventFormToUpdatePayload(values),
      deleteDialogMessage: (event: TempleEvent) =>
        t('This will permanently delete "{{name}}".', { name: event.name }),
    }),
    [t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={templeEventCrudConfig} />
    </div>
  )
}
