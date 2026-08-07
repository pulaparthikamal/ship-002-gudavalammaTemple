import { CrudPage } from '@/components/crud/CrudPage'
import {
  mapServerFormToPayload,
  mapServerToFormValues,
  renderServerDetails,
  serverFormConfig,
  serverTableColumns,
} from '@/models/serverConnectionModel'
import {
  useBulkDeleteServersMutation,
  useCreateServerMutation,
  useDeleteServerMutation,
  useListServersQuery,
  useUpdateServerMutation,
} from '@/services/api/endpoints/serversApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { ServerConnection, ConnectServerPayload } from '@/types/serverManagement'
import type { ServerFormValues } from '@/models/serverConnectionModel'

type ServerBulkDeletePayload = {
  selectedIds: EntityId[]
}

const serversCrudConfig: CrudPageConfig<
  ServerConnection,
  ServerFormValues,
  ConnectServerPayload,
  Partial<ConnectServerPayload>,
  ServerBulkDeletePayload
> = {
  title: 'Servers',
  resourceName: 'Server',
  eyebrow: 'Server Connection',
  description: 'Add SSH targets for monitoring, scan discovery, alerts, and reports.',
  createButtonLabel: 'Add Server',
  createDialogTitle: 'Connect a server',
  editDialogTitle: 'Edit server',
  viewDialogTitle: 'Server details',
  deleteDialogTitle: 'Delete server?',
  emptyMessage: 'No servers connected.',
  exportFileName: 'servers',
  pageSizeOptions: [10, 20, 50],
  defaultQuery: {
    page: 1,
    limit: 20,
    sortfield: 'created',
    direction: 'desc',
    criteria: [],
  },
  permissions: {
    module: 'SERVER_AGENT_CONNECT',
  },
  getRowId: (server) => server._id,
  getRowLabel: (server) => server.name,
  table: {
    columns: serverTableColumns,
  },
  form: serverFormConfig,
  api: {
    useListQuery: useListServersQuery,
    useCreateMutation: useCreateServerMutation,
    useUpdateMutation: useUpdateServerMutation,
    useDeleteMutation: useDeleteServerMutation,
    useBulkDeleteMutation: useBulkDeleteServersMutation,
  },
  mapItemToFormValues: mapServerToFormValues,
  mapFormValuesToCreatePayload: mapServerFormToPayload,
  mapFormValuesToUpdatePayload: (values) => mapServerFormToPayload(values),
  bulkDelete: {
    buttonLabel: 'Delete Selected',
    confirmTitle: 'Delete selected servers?',
    confirmLabel: 'Delete Selected',
    confirmMessage: (servers) =>
      `This will permanently delete ${servers.length} selected ${servers.length === 1 ? 'server' : 'servers'}.`,
    successMessage: (servers) =>
      `${servers.length} ${servers.length === 1 ? 'server' : 'servers'} deleted successfully.`,
    mapSelectedItemsToPayload: (servers) => ({
      selectedIds: servers.map((s) => s._id),
    }),
  },
  deleteDialogMessage: (server) =>
    `This will permanently delete the server "${server.name}" (${server.host}) and all associated data.`,
  slots: {
    viewContent: renderServerDetails,
  },
}

export function ServerConnectionPage() {
  return <CrudPage config={serversCrudConfig} />
}
