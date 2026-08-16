import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type {
  User,
  UserCreatePayload,
  UserFormValues,
  UserRoleReference,
  UserUpdatePayload,
} from '@/types/user'

type TFn = (key: string, params?: Record<string, string | number>) => string

const defaultUserRoleId = ''

export const userApiDetails = {
  endpoint: '/users',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export function getUserActiveOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Active'), value: true },
    { label: t('Inactive'), value: false },
  ]
}

export function getUserEmailVerifiedOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Verified'), value: true },
    { label: t('Unverified'), value: false },
  ]
}

export function getUserRoleId(role: UserRoleReference) {
  return typeof role === 'string' ? role : role._id
}

function findRoleOptionByLabel(roleOptions: CrudSelectOption[], label: string) {
  return roleOptions.find((option) => option.label.trim().toLowerCase() === label.trim().toLowerCase())
}

export function getUserRoleLabel(
  role: UserRoleReference,
  roleOptions: CrudSelectOption[] = [],
) {
  const roleId = getUserRoleId(role)
  const configuredRole = roleOptions.find((option) => option.value === roleId)

  if (configuredRole) {
    return configuredRole.label
  }

  if (typeof role !== 'string') {
    return role.role ?? role.roleType ?? role._id
  }

  return role
}

function resolveUserRoleValue(role: UserRoleReference, roleOptions: CrudSelectOption[] = []) {
  const roleId = getUserRoleId(role)
  const configuredRole = roleOptions.find((option) => option.value === roleId)

  if (configuredRole) {
    return String(configuredRole.value)
  }

  if (typeof role === 'string') {
    return String(findRoleOptionByLabel(roleOptions, role)?.value ?? role)
  }

  return role._id
}

export const userFormSchema = z
  .object({
    _id: z.string().optional(),
    firstName: z.string().trim().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().trim().min(2, 'Last name must be at least 2 characters'),
    email: z.string().trim().email('Enter a valid email address'),
    password: z.string(),
    phone: z.string().trim(),
    profileImage: z.string().trim(),
    role: z.string().trim().min(1, 'Choose a role'),
    isActive: z.boolean(),
    isEmailVerified: z.boolean(),
  })
  .superRefine((values, context) => {
    const isCreateMode = !values._id
    const hasPassword = values.password.length > 0

    if (isCreateMode && !hasPassword) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password is required for new users',
      })
      return
    }

    if (hasPassword && values.password.length < 8) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'Password must be at least 8 characters',
      })
    }
  }) as z.ZodType<UserFormValues>

export const userDefaultValues: UserFormValues = {
  _id: '',
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  profileImage: '',
  role: defaultUserRoleId,
  isActive: true,
  isEmailVerified: false,
}

interface UserRoleFieldState {
  disabled?: boolean
  helperText?: string
}

export function createUserFormConfig(
  t: TFn,
  roleOptions: CrudSelectOption[],
  roleFieldState?: UserRoleFieldState,
): CrudFormConfig<UserFormValues> {
  return {
    schema: userFormSchema,
    defaultValues: userDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'firstName',
        label: t('First name'),
        type: 'text',
        placeholder: t('First name'),
      },
      {
        name: 'lastName',
        label: t('Last name'),
        type: 'text',
        placeholder: t('Last name'),
      },
      {
        name: 'email',
        label: t('Email'),
        type: 'email',
        placeholder: 'user@example.com',
      },
      {
        name: 'password',
        label: t('Password'),
        type: 'password',
        placeholder: t('Enter password'),
        helperText: t('Required for new users. Leave blank while editing to keep the current password.'),
      },
      {
        name: 'phone',
        label: t('Phone'),
        type: 'text',
        placeholder: '+1234567890',
      },
      {
        name: 'role',
        label: t('Role'),
        type: 'select',
        placeholder: t('Choose role'),
        options: roleOptions,
        disabled: roleFieldState?.disabled,
        helperText: roleFieldState?.helperText,
      },
      {
        name: 'profileImage',
        label: t('Profile image'),
        type: 'text',
        placeholder: 'https://example.com/avatar.png',
        fullWidth: true,
      },
      {
        name: 'isActive',
        label: t('Active user'),
        type: 'switch',
        helperText: t('Disable this when the user should not be allowed to sign in.'),
      },
      {
        name: 'isEmailVerified',
        label: t('Email verified'),
        type: 'switch',
        helperText: t('Enable after the user email address has been verified.'),
      },
    ],
  }
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

function formatUserDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function renderBooleanBadge(value: boolean, trueLabel: string, falseLabel: string) {
  return (
    <span
      className={
        value
          ? 'inline-flex rounded-lg bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]'
          : 'inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]'
      }
    >
      {value ? trueLabel : falseLabel}
    </span>
  )
}

export function createUserTableColumns(t: TFn, roleOptions: CrudSelectOption[]): Array<CrudTableColumn<User>> {
  const activeOptions = getUserActiveOptions(t)
  const emailVerifiedOptions = getUserEmailVerifiedOptions(t)

  return [
    {
      key: 'user',
      header: t('User'),
      sortField: 'fullName',
      exportValue: (user) => `${user.firstName} ${user.lastName}`,
      filter: {
        key: 'firstName|lastName|email',
        type: 'regexOr',
        placeholder: t('Search user'),
        matchModes: ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
      render: (user) => (
        <div className="flex min-w-56 items-center gap-3">
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt={`${user.firstName} ${user.lastName}`}
              className="h-9 w-9 rounded-lg object-cover"
            />
          ) : (
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]">
              {user.firstName.charAt(0)}
              {user.lastName.charAt(0)}
            </span>
          )}
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">{user.email}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'email',
      header: t('Email'),
      field: 'email',
      filter: {
        key: 'email',
        type: 'regexOr',
        placeholder: t('Search email'),
        matchModes: ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'phone',
      header: t('Phone'),
      field: 'phone',
      exportValue: (user) => user.phone ?? '',
      filter: {
        key: 'phone',
        type: 'regexOr',
        placeholder: t('Search phone'),
        matchModes: ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
      render: (user) => user.phone || '-',
    },
    {
      key: 'role',
      header: t('Role'),
      sortField: 'role',
      exportValue: (user) => getUserRoleLabel(user.role, roleOptions),
      filter: {
        key: 'role',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Role'),
        options: roleOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (user) => (
        <span className="inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text)]">
          {getUserRoleLabel(user.role, roleOptions)}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: t('Active'),
      sortField: 'isActive',
      exportValue: (user) => (user.isActive ? t('Active') : t('Inactive')),
      filter: {
        key: 'isActive',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Status'),
        options: activeOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (user) => renderBooleanBadge(user.isActive, t('Active'), t('Inactive')),
    },
    {
      key: 'isEmailVerified',
      header: t('Verified'),
      sortField: 'isEmailVerified',
      exportValue: (user) => (user.isEmailVerified ? t('Verified') : t('Unverified')),
      filter: {
        key: 'isEmailVerified',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Verification'),
        options: emailVerifiedOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (user) => renderBooleanBadge(user.isEmailVerified, t('Verified'), t('Unverified')),
    },
    {
      key: 'updatedAt',
      header: t('Updated'),
      sortField: 'updatedAt',
      field: 'updatedAt',
      exportValue: (user) => formatUserDate(user.updatedAt),
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: t('Updated date'),
      },
      render: (user) => formatUserDate(user.updatedAt),
    },
  ]
}

export function mapUserToFormValues(user: User, roleOptions: CrudSelectOption[] = []): UserFormValues {
  return {
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    password: '',
    phone: user.phone ?? '',
    profileImage: user.profileImage ?? '',
    role: resolveUserRoleValue(user.role, roleOptions),
    isActive: user.isActive,
    isEmailVerified: user.isEmailVerified,
  }
}

export function mapUserFormToCreatePayload(values: UserFormValues): UserCreatePayload {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim().toLowerCase(),
    password: values.password,
    phone: optionalText(values.phone),
    profileImage: optionalText(values.profileImage),
    role: values.role,
    isActive: values.isActive,
    isEmailVerified: values.isEmailVerified,
  }
}

export function mapUserFormToUpdatePayload(values: UserFormValues): UserUpdatePayload {
  const payload: UserUpdatePayload = {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim().toLowerCase(),
    phone: optionalText(values.phone),
    profileImage: optionalText(values.profileImage),
    role: values.role,
    isActive: values.isActive,
    isEmailVerified: values.isEmailVerified,
  }

  if (values.password) {
    payload.password = values.password
  }

  return payload
}

export function getRenderUserDetails(t: TFn, roleOptions: CrudSelectOption[] = []) {
  return function renderUserDetails(user: User) {
    const fullName = `${user.firstName} ${user.lastName}`
    const rows = [
      [t('Phone'), user.phone || '-'],
      [t('Role'), getUserRoleLabel(user.role, roleOptions)],
      [t('Account status'), user.isActive ? t('Active') : t('Inactive')],
      [t('Email status'), user.isEmailVerified ? t('Verified') : t('Unverified')],
      [t('Created'), formatUserDate(user.createdAt)],
      [t('Updated'), formatUserDate(user.updatedAt)],
      [t('Deleted'), user.isDeleted ? t('staff.crud.yes') : t('staff.crud.no')],
    ]

    return (
      <div className="space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt={fullName}
              className="h-16 w-16 rounded-lg object-cover"
            />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-xl font-semibold text-[var(--color-primary)]">
              {user.firstName.charAt(0)}
              {user.lastName.charAt(0)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-semibold leading-7 text-[var(--color-text-strong)]">{fullName}</h3>
            <p className="break-all text-sm leading-5 text-[var(--color-text-muted)]">{user.email}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {renderBooleanBadge(user.isActive, t('Active'), t('Inactive'))}
              {renderBooleanBadge(user.isEmailVerified, t('Email verified'), t('Email unverified'))}
            </div>
          </div>
        </div>

        <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
            >
              <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                {label}
              </dt>
              <dd className="min-w-0 break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    )
  }
}

export function getRenderUserGridItem(t: TFn, roleOptions: CrudSelectOption[] = []) {
  return function renderUserGridItem(user: User) {
    const fullName = `${user.firstName} ${user.lastName}`

    return (
      <div className="space-y-3">
        <div className="flex items-start gap-2.5">
          {user.profileImage ? (
            <img
              src={user.profileImage}
              alt={fullName}
              className="h-10 w-10 rounded-lg object-cover"
            />
          ) : (
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-primary-soft)] text-xs font-semibold text-[var(--color-primary)]">
              {user.firstName.charAt(0)}
              {user.lastName.charAt(0)}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{fullName}</h3>
            <p className="truncate text-xs text-[var(--color-text-muted)]">{user.email}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {renderBooleanBadge(user.isActive, t('Active'), t('Inactive'))}
          {renderBooleanBadge(user.isEmailVerified, t('Verified'), t('Unverified'))}
        </div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            [t('Phone'), user.phone || '-'],
            [t('Role'), getUserRoleLabel(user.role, roleOptions)],
            [t('Updated'), formatUserDate(user.updatedAt)],
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
