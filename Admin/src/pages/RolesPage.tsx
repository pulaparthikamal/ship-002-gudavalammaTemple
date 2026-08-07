import { CrudPage } from '@/components/crud/CrudPage'
import {
  mapRoleFormToPayload,
  mapRoleToFormValues,
  renderRoleDetails,
  renderRoleGridItem,
  roleFormConfig,
  roleTableColumns,
} from '@/models/roleModel'
import {
  useBulkDeleteRolesMutation,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetRolesQuery,
  useUpdateRoleMutation,
} from '@/services/api/endpoints/rolesApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type { Role, RoleCreatePayload, RoleFormValues, RoleUpdatePayload } from '@/types/role'

type RoleBulkDeletePayload = {
  selectedIds: EntityId[]
}

const rolesCrudConfig: CrudPageConfig<
  Role,
  RoleFormValues,
  RoleCreatePayload,
  RoleUpdatePayload,
  RoleBulkDeletePayload
> = {
  title: 'Roles',
  resourceName: 'Role',
  createButtonLabel: 'Add Roles',
  createDialogTitle: 'Add Role',
  editDialogTitle: 'Edit role',
  viewDialogTitle: 'Role details',
  deleteDialogTitle: 'Delete role?',
  emptyMessage: 'No roles found.',
  exportFileName: 'roles',
  pageSizeOptions: [10, 20, 50],
  defaultQuery: {
    page: 1,
    limit: 20,
    sortfield: 'updatedAt',
    direction: 'desc',
    criteria: [],
  },
  permissions: {
    module: 'Roles',
  },
  getRowId: (role) => role._id,
  getRowLabel: (role) => role.role,
  table: {
    columns: roleTableColumns,
  },
  form: roleFormConfig,
  api: {
    useBulkDeleteMutation: useBulkDeleteRolesMutation,
    useListQuery: useGetRolesQuery,
    useCreateMutation: useCreateRoleMutation,
    useUpdateMutation: useUpdateRoleMutation,
    useDeleteMutation: useDeleteRoleMutation,
  },
  mapItemToFormValues: mapRoleToFormValues,
  mapFormValuesToCreatePayload: mapRoleFormToPayload,
  mapFormValuesToUpdatePayload: (values) => mapRoleFormToPayload(values),
  bulkDelete: {
    buttonLabel: 'Delete Selected',
    confirmTitle: 'Delete selected roles?',
    confirmLabel: 'Delete Selected',
    confirmMessage: (roles) =>
      `This will permanently delete ${roles.length} selected ${
        roles.length === 1 ? 'role' : 'roles'
      }.`,
    successMessage: (roles) =>
      `${roles.length} ${roles.length === 1 ? 'role' : 'roles'} deleted successfully.`,
    mapSelectedItemsToPayload: (roles) => ({
      selectedIds: roles.map((role) => role._id),
    }),
  },
  deleteDialogMessage: (role) =>
    `This will permanently delete the ${role.role} role and its configured permissions.`,
  slots: {
    viewContent: renderRoleDetails,
    gridItem: renderRoleGridItem,
  },
}

export function RolesPage() {
  return <CrudPage config={rolesCrudConfig} />
}
