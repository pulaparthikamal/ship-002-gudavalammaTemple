import { z } from 'zod'
import type {
  CrudFormConfig,
  CrudPermissionAction,
  CrudPermissionEntry,
  CrudPermissionsValue,
  CrudSelectOption,
  CrudTableColumn,
} from '@/types/crud'
import type {
  Role,
  RoleCreatePayload,
  RoleFormValues,
  RolePermissionPayload,
  RoleStatus,
  RoleType,
} from '@/types/role'

type TFn = (key: string, params?: Record<string, string | number>) => string

const roleStatuses: RoleStatus[] = ['Active', 'Inactive', 'Pending']
const roleTypes: RoleType[] = ['User', 'Manager', 'Admin', 'Super Admin', 'Guest']

export const roleApiDetails = {
  endpoint: '/roles',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export function getRoleStatusOptions(t: TFn): CrudSelectOption[] {
  return roleStatuses.map((status) => ({
    label: t(status),
    value: status,
  }))
}

export function getRoleTypeOptions(t: TFn): CrudSelectOption[] {
  return roleTypes.map((roleType) => ({
    label: t(roleType),
    value: roleType,
  }))
}

// Permission action identifiers ('Add'/'Update'/'Delete') are internal, technical
// values consumed by the permissions-matrix editor, not end-user prose — left
// untranslated (see Phase 13d scoping notes for the Role permissions matrix).
export const rolePermissionActionOptions: CrudPermissionAction[] = [
  'Add',
  'Update',
  'Delete',
]

const rolePermissionTypeSchema = z.enum(['NoView', 'View', 'Edit'])
const rolePermissionActionSchema = z.enum([
  'View',
  'Add',
  'Create',
  'Update',
  'Delete',
])

export const roleFormSchema = z
  .object({
    _id: z.string().optional(),
    role: z.string().trim().min(2, 'Role name must be at least 2 characters'),
    roleType: z.enum(roleTypes),
    status: z.enum(roleStatuses),
    permissions: z.record(
      z.string(),
      z.object({
        key: z.string(),
        title: z.string(),
        route: z.string(),
        parentTitle: z.string().optional(),
        type: rolePermissionTypeSchema,
        actions: z.array(rolePermissionActionSchema),
      }),
    ),
  })
  .superRefine((values, context) => {
    const hasAccessibleScreen = Object.values(values.permissions).some(
      (permission) => permission.type !== 'NoView',
    )

    if (!hasAccessibleScreen) {
      context.addIssue({
        code: 'custom',
        path: ['permissions'],
        message: 'Select access for at least one screen.',
      })
    }
  }) as z.ZodType<RoleFormValues>

export const roleDefaultValues: RoleFormValues = {
  _id: '',
  role: '',
  roleType: 'User',
  status: 'Active',
  permissions: {},
}

export function getRoleFormConfig(t: TFn): CrudFormConfig<RoleFormValues> {
  return {
    schema: roleFormSchema,
    defaultValues: roleDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'role',
        label: t('Role'),
        type: 'text',
        placeholder: t('Enter role name'),
      },
      {
        name: 'roleType',
        label: t('Role type'),
        type: 'select',
        options: getRoleTypeOptions(t),
        placeholder: t('Choose role type'),
      },
      {
        name: 'status',
        label: t('Status'),
        type: 'select',
        options: getRoleStatusOptions(t),
        placeholder: t('Choose status'),
      },
      {
        name: 'permissions',
        label: t('Screen permissions'),
        type: 'permissions',
        fullWidth: true,
        helperText: t('Screens are loaded from menus. Choose access first, then enable edit actions where needed.'),
        permissions: {
          actions: rolePermissionActionOptions,
        },
      },
    ],
  }
}

export function normalizeRolePermissionType(value: unknown): CrudPermissionEntry['type'] {
  if (value === 'View' || value === 'Edit') {
    return value
  }

  return 'NoView'
}

export function normalizeRolePermissionActions(
  actions: unknown,
  type: CrudPermissionEntry['type'],
): CrudPermissionAction[] {
  if (type === 'NoView') {
    return []
  }

  if (type === 'View') {
    return ['View']
  }

  const normalizedActions = new Set<CrudPermissionAction>(['View'])

  if (Array.isArray(actions)) {
    actions.forEach((action) => {
      if (action === 'View') {
        normalizedActions.add(action)
        return
      }

      if (action === 'Create' || action === 'Add') {
        normalizedActions.add('Add')
        return
      }

      if (action === 'Update' || action === 'Delete') {
        normalizedActions.add(action)
      }
    })
  }

  return Array.from(normalizedActions)
}

export function normalizeRolePermissions(value: unknown): CrudPermissionsValue {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  return Object.entries(value as Record<string, unknown>).reduce<CrudPermissionsValue>(
    (permissions, [key, permissionValue]) => {
      if (typeof permissionValue !== 'object' || permissionValue === null) {
        return permissions
      }

      const record = permissionValue as Record<string, unknown>
      const type = normalizeRolePermissionType(record.type)

      permissions[key] = {
        key,
        title: typeof record.title === 'string' ? record.title : key,
        route: typeof record.route === 'string' ? record.route : '',
        parentTitle: typeof record.parentTitle === 'string' ? record.parentTitle : undefined,
        type,
        actions: normalizeRolePermissionActions(record.actions, type),
      }

      return permissions
    },
    {},
  )
}

function formatRoleDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function countAccessibleScreens(permissions: CrudPermissionsValue) {
  return Object.values(permissions).filter((permission) => permission.type !== 'NoView').length
}

function countEditableScreens(permissions: CrudPermissionsValue) {
  return Object.values(permissions).filter((permission) => permission.type === 'Edit').length
}

function getRoleStatusTone(status: RoleStatus) {
  if (status === 'Active') {
    return 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
  }

  if (status === 'Pending') {
    return 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'
  }

  return 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
}

export function getRoleTableColumns(t: TFn): Array<CrudTableColumn<Role>> {
  const roleTypeOptions = getRoleTypeOptions(t)
  const roleStatusOptions = getRoleStatusOptions(t)

  return [
    {
      key: 'role',
      header: t('Role'),
      field: 'role',
      filter: {
        key: 'roleSearch',
        type: 'regexOr',
        placeholder: t('Search role'),
        matchModes: ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
      render: (role) => (
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{role.role}</p>
          <p className="text-[11px] text-[var(--color-text-muted)]">{role.roleType}</p>
        </div>
      ),
    },
    {
      key: 'roleType',
      header: t('Role type'),
      field: 'roleType',
      filter: {
        key: 'roleType',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Role type'),
        options: roleTypeOptions,
        matchModes: ['in', 'notIn'],
      },
    },
    {
      key: 'status',
      header: t('Status'),
      sortField: 'status',
      exportValue: (role) => role.status,
      filter: {
        key: 'status',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Status'),
        options: roleStatusOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (role) => (
        <span
          className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${getRoleStatusTone(role.status)}`}
        >
          {role.status}
        </span>
      ),
    },
    {
      key: 'permissions',
      header: t('Permissions'),
      sortable: false,
      exportValue: (role) => t('{{count}} screens', { count: countAccessibleScreens(role.permissions) }),
      render: (role) => (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex rounded-lg bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
            {t('{{count}} screens', { count: countAccessibleScreens(role.permissions) })}
          </span>
          <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
            {t('{{count}} edit', { count: countEditableScreens(role.permissions) })}
          </span>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: t('Updated'),
      sortField: 'updatedAt',
      field: 'updatedAt',
      exportValue: (role) => formatRoleDate(role.updatedAt),
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: t('Updated date'),
      },
      render: (role) => formatRoleDate(role.updatedAt),
    },
  ]
}

export function mapRoleToFormValues(role: Role): RoleFormValues {
  return {
    _id: role._id,
    role: role.role,
    roleType: role.roleType,
    status: role.status,
    permissions: role.permissions,
  }
}

function mapPermissionsToPayload(permissions: CrudPermissionsValue): RolePermissionPayload {
  return Object.entries(permissions).reduce<RolePermissionPayload>((payload, [key, permission]) => {
    payload[key] = {
      type: permission.type,
      actions: normalizeRolePermissionActions(permission.actions, permission.type),
    }

    return payload
  }, {})
}

export function mapRoleFormToPayload(values: RoleFormValues): RoleCreatePayload {
  return {
    role: values.role.trim().toUpperCase(),
    roleType: values.roleType,
    status: values.status,
    permissions: mapPermissionsToPayload(values.permissions),
  }
}

// permission.type ('NoView'/'View'/'Edit') and permission.actions ('View'/'Add'/
// 'Update'/'Delete') below are the internal, per-module technical values from the
// dynamic permissions matrix (~30-80 entries) — left untranslated, along with
// permission.title/route/key, which come from backend-defined menu items and are
// already handled separately by the sidebar's menu-title translation (see
// translations/en.ts's "Staff sidebar menu titles" comment). Only the static
// chrome around this list (headings, empty-state message, row labels) is translated.
export function getRenderRoleDetails(t: TFn) {
  return function renderRoleDetails(role: Role) {
    const permissionRows = Object.values(role.permissions)
      .filter((permission) => permission.type !== 'NoView')
      .sort((firstPermission, secondPermission) => firstPermission.title.localeCompare(secondPermission.title))

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{role.role}</h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">{role.roleType}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`inline-flex rounded-lg px-3 py-1 text-sm font-medium ${getRoleStatusTone(role.status)}`}
            >
              {role.status}
            </span>
            <span className="inline-flex rounded-lg bg-[var(--color-primary-soft)] px-3 py-1 text-sm font-medium text-[var(--color-primary)]">
              {t('{{count}} screens', { count: countAccessibleScreens(role.permissions) })}
            </span>
          </div>
        </div>

        <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          {[
            [t('Role'), role.role],
            [t('Role type'), role.roleType],
            [t('Status'), role.status],
            [t('Created'), formatRoleDate(role.createdAt)],
            [t('Updated'), formatRoleDate(role.updatedAt)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
            >
              <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                {label}
              </dt>
              <dd className="text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            {t('Screen permissions')}
          </div>
          <div className="max-h-[20rem] overflow-y-auto">
            {permissionRows.length ? (
              permissionRows.map((permission) => (
                <div
                  key={permission.key}
                  className="grid gap-2 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)] sm:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{permission.title}</p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                      {permission.parentTitle ? `${permission.parentTitle} • ` : ''}
                      {permission.route || permission.key}
                    </p>
                  </div>
                  <div className="text-sm font-medium text-[var(--color-text)]">{permission.type}</div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {permission.actions.map((action) => (
                      <span
                        key={`${permission.key}-${action}`}
                        className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]"
                      >
                        {action}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-5 text-sm text-[var(--color-text-muted)]">
                {t('No screens are accessible for this role.')}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }
}

export function getRenderRoleGridItem(t: TFn) {
  return function renderRoleGridItem(role: Role) {
    return (
      <div className="space-y-3">
        <div className="space-y-1">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{role.role}</h3>
          <p className="text-xs text-[var(--color-text-muted)]">{role.roleType}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span
            className={`inline-flex rounded-lg px-2 py-0.5 text-[11px] font-semibold ${getRoleStatusTone(role.status)}`}
          >
            {role.status}
          </span>
          <span className="inline-flex rounded-lg bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]">
            {t('{{count}} screens', { count: countAccessibleScreens(role.permissions) })}
          </span>
          <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
            {t('{{count}} edit', { count: countEditableScreens(role.permissions) })}
          </span>
        </div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            [t('Role type'), role.roleType],
            [t('Updated'), formatRoleDate(role.updatedAt)],
          ].map(([label, value]) => (
            <div key={label} className="space-y-1">
              <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                {label}
              </dt>
              <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }
}
