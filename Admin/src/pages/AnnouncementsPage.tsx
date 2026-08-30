import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  createAnnouncementFormConfig,
  getAnnouncementTableColumns,
  mapAnnouncementFormToCreatePayload,
  mapAnnouncementFormToUpdatePayload,
  mapAnnouncementToFormValues,
  type AnnouncementFormValues,
} from '@/models/announcementModel'
import {
  useCreateAnnouncementMutation,
  useDeleteAnnouncementMutation,
  useGetAnnouncementsQuery,
  useUpdateAnnouncementMutation,
  type Announcement,
  type AnnouncementPayload,
} from '@/services/api/endpoints/announcementApi'
import { useGetTempleEventsQuery } from '@/services/api/endpoints/templeEventsApi'
import { toStaticCrudListResult } from '@/utils/crudStaticList'
import type { CrudListQuery, CrudPageConfig, CrudSelectOption } from '@/types/crud'

function useAnnouncementListQuery(query: CrudListQuery, options?: { skip?: boolean }) {
  const result = useGetAnnouncementsQuery(undefined, options)
  return toStaticCrudListResult(query, result)
}

export function AnnouncementsPage() {
  const { t } = useStaffTranslation()
  const { data: events = [] } = useGetTempleEventsQuery()
  const eventOptions: CrudSelectOption[] = useMemo(
    () => events.map((event) => ({ label: event.name, value: event._id })),
    [events],
  )

  const announcementCrudConfig: CrudPageConfig<
    Announcement,
    AnnouncementFormValues,
    AnnouncementPayload,
    Partial<AnnouncementPayload>
  > = useMemo(
    () => ({
      title: t('Announcements'),
      resourceName: t('Announcement'),
      createButtonLabel: t('Add Announcement'),
      createDialogTitle: t('Add Announcement'),
      editDialogTitle: t('Edit announcement'),
      viewDialogTitle: t('Announcement details'),
      emptyMessage: t('No announcements found.'),
      exportFileName: 'announcements',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'priority',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'announcement',
      },
      getRowId: (announcement: Announcement) => announcement._id,
      getRowLabel: (announcement: Announcement) => announcement.title,
      table: {
        columns: getAnnouncementTableColumns(t),
      },
      form: createAnnouncementFormConfig(eventOptions, t),
      api: {
        useListQuery: useAnnouncementListQuery,
        useCreateMutation: useCreateAnnouncementMutation,
        useUpdateMutation: useUpdateAnnouncementMutation,
        useDeleteMutation: useDeleteAnnouncementMutation,
      },
      mapItemToFormValues: mapAnnouncementToFormValues,
      mapFormValuesToCreatePayload: mapAnnouncementFormToCreatePayload,
      mapFormValuesToUpdatePayload: (values: AnnouncementFormValues) => mapAnnouncementFormToUpdatePayload(values),
      deleteDialogMessage: (announcement: Announcement) =>
        t('This will permanently delete "{{name}}".', { name: announcement.title }),
    }),
    [eventOptions, t],
  )

  return (
    <div className="temple-scope">
      <CrudPage config={announcementCrudConfig} />
    </div>
  )
}
