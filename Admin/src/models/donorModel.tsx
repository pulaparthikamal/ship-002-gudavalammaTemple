import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { Donor, DonorCreatePayload, DonorFormValues, DonorUpdatePayload } from '@/types/donor'

type TFn = (key: string, params?: Record<string, string | number>) => string

export const donorApiDetails = {
  endpoint: '/donors',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export function getDonorActiveOptions(t: TFn) {
  return [
    { label: t('Active'), value: true },
    { label: t('Inactive'), value: false },
  ]
}

export const donorFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim(),
  email: z.string().trim().refine((value) => value === '' || z.string().email().safeParse(value).success, {
    message: 'Enter a valid email address',
  }),
  address: z.string().trim(),
  panNumber: z.string().trim(),
  linkedUserId: z.string().trim(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<DonorFormValues>

export const donorDefaultValues: DonorFormValues = {
  _id: '',
  name: '',
  phone: '',
  email: '',
  address: '',
  panNumber: '',
  linkedUserId: '',
  notes: '',
  active: true,
}

export function getDonorFormConfig(t: TFn): CrudFormConfig<DonorFormValues> {
  return {
    schema: donorFormSchema,
    defaultValues: donorDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Name'),
        type: 'text',
        placeholder: t('Enter donor name'),
      },
      {
        name: 'phone',
        label: t('Phone'),
        type: 'text',
        placeholder: '+1234567890',
      },
      {
        name: 'email',
        label: t('Email'),
        type: 'email',
        placeholder: 'donor@example.com',
      },
      {
        name: 'panNumber',
        label: t('PAN number'),
        type: 'text',
        placeholder: t('Enter PAN number'),
      },
      {
        name: 'address',
        label: t('Address'),
        type: 'textarea',
        placeholder: t('Enter address'),
        fullWidth: true,
        rows: 3,
      },
      {
        name: 'linkedUserId',
        label: t('Linked user ID'),
        type: 'text',
        placeholder: t('Optional linked user ObjectId'),
        helperText: t('Link this donor to an existing user account by ID.'),
      },
      {
        name: 'notes',
        label: t('Notes'),
        type: 'textarea',
        placeholder: t('Enter notes'),
        fullWidth: true,
        rows: 3,
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to mark this donor as inactive.'),
      },
    ],
  }
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

function formatDonorDate(value?: string | null) {
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

export function getDonorTableColumns(t: TFn): Array<CrudTableColumn<Donor>> {
  return [
    {
      key: 'name',
      header: t('Name'),
      field: 'name',
      sortField: 'name',
      filter: {
        key: 'name',
        type: 'regexOr',
        placeholder: t('Search name'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'phone',
      header: t('Phone'),
      field: 'phone',
      exportValue: (donor) => donor.phone ?? '',
      filter: {
        key: 'phone',
        type: 'regexOr',
        placeholder: t('Search phone'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
      render: (donor) => donor.phone || '-',
    },
    {
      key: 'email',
      header: t('Email'),
      field: 'email',
      exportValue: (donor) => donor.email ?? '',
      filter: {
        key: 'email',
        type: 'regexOr',
        placeholder: t('Search email'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
      render: (donor) => donor.email || '-',
    },
    {
      key: 'panNumber',
      header: t('PAN number'),
      field: 'panNumber',
      exportValue: (donor) => donor.panNumber ?? '',
      render: (donor) => donor.panNumber || '-',
    },
    {
      key: 'active',
      header: t('Status'),
      sortField: 'active',
      exportValue: (donor) => (donor.active ? t('Active') : t('Inactive')),
      filter: {
        key: 'active',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Status'),
        options: getDonorActiveOptions(t),
        matchModes: ['in', 'notIn'],
      },
      render: (donor) => renderBooleanBadge(donor.active, t('Active'), t('Inactive')),
    },
    {
      key: 'updated',
      header: t('Updated'),
      field: 'updated',
      sortField: 'updated',
      exportValue: (donor) => formatDonorDate(donor.updated),
      render: (donor) => formatDonorDate(donor.updated),
    },
  ]
}

export function mapDonorToFormValues(donor: Donor): DonorFormValues {
  return {
    _id: donor._id,
    name: donor.name,
    phone: donor.phone ?? '',
    email: donor.email ?? '',
    address: donor.address ?? '',
    panNumber: donor.panNumber ?? '',
    linkedUserId: donor.linkedUserId ?? '',
    notes: donor.notes ?? '',
    active: donor.active,
  }
}

export function mapDonorFormToCreatePayload(values: DonorFormValues): DonorCreatePayload {
  return {
    name: values.name.trim(),
    phone: optionalText(values.phone),
    email: optionalText(values.email),
    address: optionalText(values.address),
    panNumber: optionalText(values.panNumber),
    linkedUserId: optionalText(values.linkedUserId),
    notes: optionalText(values.notes),
    active: values.active,
  }
}

export function mapDonorFormToUpdatePayload(values: DonorFormValues): DonorUpdatePayload {
  return mapDonorFormToCreatePayload(values)
}

export function getRenderDonorDetails(t: TFn) {
  return function renderDonorDetails(donor: Donor) {
    const rows: Array<[string, string]> = [
      [t('Phone'), donor.phone || '-'],
      [t('Email'), donor.email || '-'],
      [t('Address'), donor.address || '-'],
      [t('PAN number'), donor.panNumber || '-'],
      [t('Notes'), donor.notes || '-'],
      [t('Status'), donor.active ? t('Active') : t('Inactive')],
      [t('Updated'), formatDonorDate(donor.updated)],
    ]

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--color-text-strong)]">{donor.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">{renderBooleanBadge(donor.active, t('Active'), t('Inactive'))}</div>
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

export function getRenderDonorGridItem(t: TFn) {
  return function renderDonorGridItem(donor: Donor) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{donor.name}</h3>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{donor.email || donor.phone || '-'}</p>
        </div>

        <div className="flex flex-wrap gap-2">{renderBooleanBadge(donor.active, t('Active'), t('Inactive'))}</div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            [t('Phone'), donor.phone || '-'],
            [t('PAN number'), donor.panNumber || '-'],
            [t('Updated'), formatDonorDate(donor.updated)],
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
