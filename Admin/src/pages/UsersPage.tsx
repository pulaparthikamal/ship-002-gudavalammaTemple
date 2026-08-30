import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { useStaffTranslation } from '@/i18n/useTranslation'
import type { CrudPageConfig } from '@/types/crud'
import {
  createUserFormConfig,
  createUserTableColumns,
  getRenderUserDetails,
  getRenderUserGridItem,
  mapUserFormToCreatePayload,
  mapUserFormToUpdatePayload,
  mapUserToFormValues,
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

  const { t } = useStaffTranslation()

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
    ? t('Unable to load roles.')
    : rolesQuery.isLoading
      ? t('Loading roles...')
      : !roleOptions.length
        ? t('No roles available.')
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
        title: t('Users'),
        resourceName: t('User'),
        createButtonLabel: t('Add Users'),
        createDialogTitle: t('Add User'),
        editDialogTitle: t('Edit user'),
        viewDialogTitle: t('User details'),
        emptyMessage: t('No users found.'),
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
          columns: createUserTableColumns(t, roleOptions),
        },
        form: createUserFormConfig(t, roleOptions, {
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
          buttonLabel: t('staff.crud.deleteSelected'),
          confirmTitle: t('Delete selected users?'),
          confirmLabel: t('staff.crud.deleteSelected'),
          confirmMessage: (users) =>
            t('staff.crud.deleteSelectedMessage', {
              count: users.length,
              resource: users.length === 1 ? t('User') : t('Users'),
            }),
          successMessage: (users) =>
            t('staff.crud.bulkDeletedSuccess', {
              count: users.length,
              resource: users.length === 1 ? t('User') : t('Users'),
            }),
          mapSelectedItemsToPayload: (users) => ({
            selectedIds: users.map((user) => user._id),
          }),
        },
        deleteDialogMessage: (user) =>
          t('This will permanently delete {{name}} ({{email}}).', {
            name: `${user.firstName} ${user.lastName}`,
            email: user.email,
          }),
        slots: {
          viewContent: getRenderUserDetails(t, roleOptions),
          gridItem: getRenderUserGridItem(t, roleOptions),
        },
      }),
      [t, isRoleFieldDisabled, roleFieldHelperText, roleOptions],
    )

  return <CrudPage config={usersCrudConfig} />
}
