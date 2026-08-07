import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import {
  createDeploymentTargetFormConfig,
  deploymentTargetTableColumns,
  mapTargetFormToPayload,
  mapTargetToFormValues,
  renderTargetDetails,
} from '@/models/deploymentTargetModel'
import {
  useBulkDeleteDeploymentTargetsMutation,
  useCreateDeploymentTargetMutation,
  useDeleteDeploymentTargetMutation,
  useGetCredentialsQuery,
  useListDeploymentTargetsQuery,
  useTestTargetConnectionMutation,
  useUpdateDeploymentTargetMutation,
} from '@/services/api/endpoints/deploymentAgentApi'
import { useToast } from '@/hooks/useToast'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { CreateDeploymentTargetPayload, DeploymentTarget } from '@/types/deploymentAgent'
import type { DeploymentTargetFormValues } from '@/models/deploymentTargetModel'
import { RefreshCw } from 'lucide-react'

type TargetBulkDeletePayload = { selectedIds: EntityId[] }

export function DeploymentTargetsPage() {
  const { data: credentials = [] } = useGetCredentialsQuery()
  const [testConnection] = useTestTargetConnectionMutation()
  const { showToast } = useToast()

  const formConfig = useMemo(() => createDeploymentTargetFormConfig(credentials), [credentials])

  const config = useMemo<
    CrudPageConfig<
      DeploymentTarget,
      DeploymentTargetFormValues,
      CreateDeploymentTargetPayload,
      Partial<CreateDeploymentTargetPayload>,
      TargetBulkDeletePayload
    >
  >(
    () => ({
      title: 'Deployment Targets',
      resourceName: 'Target',
      eyebrow: 'Deployment Agent',
      description: 'Configure SSH servers where applications will be deployed.',
      createButtonLabel: 'Add Target',
      createDialogTitle: 'Add deployment target',
      editDialogTitle: 'Edit deployment target',
      viewDialogTitle: 'Target details',
      deleteDialogTitle: 'Delete target?',
      emptyMessage: 'No deployment targets configured.',
      exportFileName: 'deployment-targets',
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
      getRowId: (t) => t._id,
      getRowLabel: (t) => t.name,
      table: {
        columns: deploymentTargetTableColumns,
      },
      form: formConfig,
      api: {
        useListQuery: useListDeploymentTargetsQuery,
        useCreateMutation: useCreateDeploymentTargetMutation,
        useUpdateMutation: useUpdateDeploymentTargetMutation,
        useDeleteMutation: useDeleteDeploymentTargetMutation,
        useBulkDeleteMutation: useBulkDeleteDeploymentTargetsMutation,
      },
      mapItemToFormValues: mapTargetToFormValues,
      mapFormValuesToCreatePayload: mapTargetFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapTargetFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected targets?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected target${items.length !== 1 ? 's' : ''}.`,
        successMessage: (items) =>
          `${items.length} target${items.length !== 1 ? 's' : ''} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({ selectedIds: items.map((t) => t._id) }),
      },
      deleteDialogMessage: (t) =>
        `This will permanently delete the target "${t.name}" (${t.host}). Existing deployments referencing this target will no longer be actionable.`,
      slots: {
        viewContent: renderTargetDetails,
        rowActions: (_, defaultActions) => [
          {
            label: 'Test connection',
            icon: <RefreshCw size={14} />,
            onClick: async (t) => {
              try {
                const result = await testConnection(t._id).unwrap()
                if (result.reachable) {
                  showToast({ severity: 'success', summary: `Connected to ${t.host} successfully.` })
                } else {
                  showToast({ severity: 'warn', summary: `Cannot reach ${t.host}`, detail: result.message })
                }
              } catch {
                showToast({ severity: 'error', summary: `Connection test failed for ${t.host}.` })
              }
            },
          },
          ...defaultActions,
        ],
      },
    }),
    [formConfig, testConnection, showToast],
  )

  return <CrudPage config={config} />
}
