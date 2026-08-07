import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import {
  createApplicationFormConfig,
  applicationTableColumns,
  mapApplicationFormToPayload,
  mapApplicationToFormValues,
  renderApplicationDetails,
} from '@/models/applicationModel'
import {
  useBulkDeleteApplicationsMutation,
  useCreateApplicationMutation,
  useDeleteApplicationMutation,
  useGetCredentialsQuery,
  useListApplicationsQuery,
  useUpdateApplicationMutation,
} from '@/services/api/endpoints/deploymentAgentApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Application, CreateApplicationPayload } from '@/types/deploymentAgent'
import type { ApplicationFormValues } from '@/models/applicationModel'

type AppBulkDeletePayload = { selectedIds: EntityId[] }

export function ApplicationsPage() {
  const { data: credentials = [] } = useGetCredentialsQuery()

  const formConfig = useMemo(() => createApplicationFormConfig(credentials), [credentials])

  const config = useMemo<
    CrudPageConfig<
      Application,
      ApplicationFormValues,
      CreateApplicationPayload,
      Partial<CreateApplicationPayload>,
      AppBulkDeletePayload
    >
  >(
    () => ({
      title: 'Applications',
      resourceName: 'Application',
      eyebrow: 'Deployment Agent',
      description: 'Define applications and their components for automated deployment.',
      createButtonLabel: 'Add Application',
      createDialogTitle: 'Add application',
      editDialogTitle: 'Edit application',
      viewDialogTitle: 'Application details',
      deleteDialogTitle: 'Delete application?',
      emptyMessage: 'No applications defined.',
      exportFileName: 'deployment-applications',
      pageSizeOptions: [10, 25, 50],
      defaultQuery: {
        page: 1,
        limit: 25,
        sortfield: 'created',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'DEPLOYMENT_AGENT',
      },
      getRowId: (a) => a._id,
      getRowLabel: (a) => a.name,
      table: {
        columns: applicationTableColumns,
      },
      form: formConfig,
      api: {
        useListQuery: useListApplicationsQuery,
        useCreateMutation: useCreateApplicationMutation,
        useUpdateMutation: useUpdateApplicationMutation,
        useDeleteMutation: useDeleteApplicationMutation,
        useBulkDeleteMutation: useBulkDeleteApplicationsMutation,
      },
      mapItemToFormValues: mapApplicationToFormValues,
      mapFormValuesToCreatePayload: mapApplicationFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapApplicationFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected applications?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected application${items.length !== 1 ? 's' : ''}.`,
        successMessage: (items) =>
          `${items.length} application${items.length !== 1 ? 's' : ''} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({ selectedIds: items.map((a) => a._id) }),
      },
      deleteDialogMessage: (a) =>
        `This will permanently delete "${a.name}" and all its configuration. Deployment history is preserved.`,
      slots: {
        viewContent: renderApplicationDetails,
      },
      style: {
        viewDialogWidth: '56rem',
      },
    }),
    [formConfig],
  )

  return <CrudPage config={config} />
}
