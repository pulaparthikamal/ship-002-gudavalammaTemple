import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import {
  createUserFormConfig,
  createUserTableColumns,
  mapUserFormToCreatePayload,
  mapUserFormToUpdatePayload,
  mapUserToFormValues,
  renderUserDetails,
  renderUserGridItem,
} from '@/models/userModel'
import {
  useBulkDeleteUsersMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUsersQuery,
  useUpdateUserMutation,
} from '@/services/api/endpoints/usersApi'
import { useGetRolesQuery } from '@/services/api/endpoints/rolesApi'
import type { EntityId } from '@/types/common'
import type { User, UserCreatePayload, UserFormValues, UserUpdatePayload } from '@/types/user'

const rolesListQuery = {
  page: 1,
  limit: 100,
  sortfield: 'role',
  direction: 'asc' as const,
  criteria: [],
}

export function UsersPage() {
  type UserBulkDeletePayload = {
    selectedIds: EntityId[]
  }

  const rolesQuery = useGetRolesQuery(rolesListQuery)
  const roleOptions = useMemo(
    () =>
      (rolesQuery.data?.data ?? []).map((role) => ({
        label: role.role,
        value: role._id,
      })),
    [rolesQuery.data],
  )
  const roleFieldHelperText = rolesQuery.isError
    ? 'Unable to load roles.'
    : rolesQuery.isLoading
      ? 'Loading roles...'
      : !roleOptions.length
        ? 'No roles available.'
        : undefined
  const isRoleFieldDisabled = rolesQuery.isLoading || rolesQuery.isError || roleOptions.length === 0

  const usersCrudConfig: CrudPageConfig<
    User,
    UserFormValues,
    UserCreatePayload,
    UserUpdatePayload,
    UserBulkDeletePayload
  > =
    useMemo(
      () => ({
        title: 'Users',
        resourceName: 'User',
        createButtonLabel: 'Add Users',
        createDialogTitle: 'Add User',
        editDialogTitle: 'Edit user',
        viewDialogTitle: 'User details',
        emptyMessage: 'No users found.',
        pageSizeOptions: [10, 20, 50],
        defaultQuery: {
          page: 1,
          limit: 20,
          sortfield: 'updatedAt',
          direction: 'desc',
          criteria: [],
        },
        permissions: {
          module: 'Users',
        },
        getRowId: (user) => user._id,
        getRowLabel: (user) => `${user.firstName} ${user.lastName}`,
        table: {
          columns: createUserTableColumns(roleOptions),
        },
        form: createUserFormConfig(roleOptions, {
          disabled: isRoleFieldDisabled,
          helperText: roleFieldHelperText,
        }),
        api: {
          useBulkDeleteMutation: useBulkDeleteUsersMutation,
          useListQuery: useGetUsersQuery,
          useCreateMutation: useCreateUserMutation,
          useUpdateMutation: useUpdateUserMutation,
          useDeleteMutation: useDeleteUserMutation,
        },
        mapItemToFormValues: (user) => mapUserToFormValues(user, roleOptions),
        mapFormValuesToCreatePayload: mapUserFormToCreatePayload,
        mapFormValuesToUpdatePayload: mapUserFormToUpdatePayload,
        bulkDelete: {
          buttonLabel: 'Delete Selected',
          confirmTitle: 'Delete selected users?',
          confirmLabel: 'Delete Selected',
          confirmMessage: (users) =>
            `This will permanently delete ${users.length} selected ${
              users.length === 1 ? 'user' : 'users'
            }.`,
          successMessage: (users) =>
            `${users.length} ${users.length === 1 ? 'user' : 'users'} deleted successfully.`,
          mapSelectedItemsToPayload: (users) => ({
            selectedIds: users.map((user) => user._id),
          }),
        },
        deleteDialogMessage: (user) =>
          `This will permanently delete ${user.firstName} ${user.lastName} (${user.email}).`,
        slots: {
          viewContent: (user) => renderUserDetails(user, roleOptions),
          gridItem: (user) => renderUserGridItem(user, roleOptions),
        },
      }),
      [isRoleFieldDisabled, roleFieldHelperText, roleOptions],
    )

  return <CrudPage config={usersCrudConfig} />
}
