import { CrudPage } from '@/components/crud/CrudPage'
import {
  credentialFormConfig,
  credentialTableColumns,
  mapCredentialFormToPayload,
  mapCredentialToFormValues,
  renderCredentialDetails,
} from '@/models/credentialModel'
import {
  useBulkDeleteCredentialsMutation,
  useCreateCredentialMutation,
  useDeleteCredentialMutation,
  useListCredentialsQuery,
  useUpdateCredentialMutation,
} from '@/services/api/endpoints/deploymentAgentApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Credential, CreateCredentialPayload } from '@/types/deploymentAgent'
import type { CredentialFormValues } from '@/models/credentialModel'

type CredentialBulkDeletePayload = { selectedIds: EntityId[] }

const credentialsCrudConfig: CrudPageConfig<
  Credential,
  CredentialFormValues,
  CreateCredentialPayload,
  Partial<CreateCredentialPayload>,
  CredentialBulkDeletePayload
> = {
  title: 'Credentials',
  resourceName: 'Credential',
  eyebrow: 'Deployment Agent',
  description: 'Store encrypted SSH keys, HTTPS tokens, and passwords for accessing repositories and servers.',
  createButtonLabel: 'Add Credential',
  createDialogTitle: 'Add credential',
  editDialogTitle: 'Edit credential',
  viewDialogTitle: 'Credential details',
  deleteDialogTitle: 'Delete credential?',
  emptyMessage: 'No credentials configured.',
  exportFileName: 'deployment-credentials',
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
  getRowId: (c) => c._id,
  getRowLabel: (c) => c.name,
  table: {
    columns: credentialTableColumns,
  },
  form: credentialFormConfig,
  api: {
    useListQuery: useListCredentialsQuery,
    useCreateMutation: useCreateCredentialMutation,
    useUpdateMutation: useUpdateCredentialMutation,
    useDeleteMutation: useDeleteCredentialMutation,
    useBulkDeleteMutation: useBulkDeleteCredentialsMutation,
  },
  mapItemToFormValues: mapCredentialToFormValues,
  mapFormValuesToCreatePayload: mapCredentialFormToPayload,
  mapFormValuesToUpdatePayload: (values) => mapCredentialFormToPayload(values),
  bulkDelete: {
    buttonLabel: 'Delete Selected',
    confirmTitle: 'Delete selected credentials?',
    confirmLabel: 'Delete Selected',
    confirmMessage: (items) =>
      `This will permanently delete ${items.length} selected credential${items.length !== 1 ? 's' : ''}.`,
    successMessage: (items) =>
      `${items.length} credential${items.length !== 1 ? 's' : ''} deleted successfully.`,
    mapSelectedItemsToPayload: (items) => ({ selectedIds: items.map((c) => c._id) }),
  },
  deleteDialogMessage: (c) => `This will permanently delete the credential "${c.name}". Applications using it will fail to deploy.`,
  slots: {
    viewContent: renderCredentialDetails,
  },
}

export function CredentialsPage() {
  return <CrudPage config={credentialsCrudConfig} />
}
