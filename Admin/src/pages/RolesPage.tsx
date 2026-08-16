import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import {
  getRenderRoleDetails,
  getRenderRoleGridItem,
  getRoleFormConfig,
  getRoleTableColumns,
  mapRoleFormToPayload,
  mapRoleToFormValues,
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

export function RolesPage() {
  const { t } = useStaffTranslation()

  const rolesCrudConfig: CrudPageConfig<
    Role,
    RoleFormValues,
    RoleCreatePayload,
    RoleUpdatePayload,
    RoleBulkDeletePayload
  > = useMemo(
    () => ({
      title: t('Roles'),
      resourceName: t('Role'),
      createButtonLabel: t('Add Roles'),
      createDialogTitle: t('Add Role'),
      editDialogTitle: t('Edit role'),
      viewDialogTitle: t('Role details'),
      deleteDialogTitle: t('Delete role?'),
      emptyMessage: t('No roles found.'),
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
        columns: getRoleTableColumns(t),
      },
      form: getRoleFormConfig(t),
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
        buttonLabel: t('staff.crud.deleteSelected'),
        confirmTitle: t('Delete selected roles?'),
        confirmLabel: t('staff.crud.deleteSelected'),
        confirmMessage: (roles) =>
          t('staff.crud.deleteSelectedMessage', {
            count: roles.length,
            resource: roles.length === 1 ? t('Role') : t('Roles'),
          }),
        successMessage: (roles) =>
          t('staff.crud.bulkDeletedSuccess', {
            count: roles.length,
            resource: roles.length === 1 ? t('Role') : t('Roles'),
          }),
        mapSelectedItemsToPayload: (roles) => ({
          selectedIds: roles.map((role) => role._id),
        }),
      },
      deleteDialogMessage: (role) =>
        t('This will permanently delete the {{role}} role and its configured permissions.', {
          role: role.role,
        }),
      slots: {
        viewContent: getRenderRoleDetails(t),
        gridItem: getRenderRoleGridItem(t),
      },
    }),
    [t],
  )

  return <CrudPage config={rolesCrudConfig} />
}
