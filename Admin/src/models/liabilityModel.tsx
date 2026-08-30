import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type {
  Liability,
  LiabilityCreatePayload,
  LiabilityFormValues,
  LiabilityStatus,
  LiabilityUpdatePayload,
} from '@/types/liability'

type TFn = (key: string, params?: Record<string, string | number>) => string

export const liabilityApiDetails = {
  endpoint: '/liabilities',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export function getLiabilityStatusOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Open'), value: 'open' },
    { label: t('Paid'), value: 'paid' },
  ]
}

export function getLiabilityActiveOptions(t: TFn) {
  return [
    { label: t('Active'), value: true },
    { label: t('Inactive'), value: false },
  ]
}

export const liabilityFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  category: z.string().trim(),
  amount: z.number().min(0, 'Amount must be 0 or more'),
  dueDate: z.any().optional(),
  creditor: z.string().trim(),
  status: z.enum(['open', 'paid']),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<LiabilityFormValues>

export const liabilityDefaultValues: LiabilityFormValues = {
  _id: '',
  name: '',
  category: '',
  amount: 0,
  dueDate: null,
  creditor: '',
  status: 'open' as LiabilityStatus,
  notes: '',
  active: true,
}

export function getLiabilityFormConfig(t: TFn): CrudFormConfig<LiabilityFormValues> {
  return {
    schema: liabilityFormSchema,
    defaultValues: liabilityDefaultValues,
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
        placeholder: t('Enter liability name'),
      },
      {
        name: 'category',
        label: t('Category'),
        type: 'text',
        placeholder: t('Enter category'),
      },
      {
        name: 'amount',
        label: t('Amount'),
        type: 'number',
        min: 0,
        step: 0.01,
      },
      {
        name: 'dueDate',
        label: t('Due date'),
        type: 'date',
      },
      {
        name: 'creditor',
        label: t('Creditor'),
        type: 'text',
        placeholder: t('Enter creditor name'),
      },
      {
        name: 'status',
        label: t('Status'),
        type: 'select',
        placeholder: t('Choose status'),
        options: getLiabilityStatusOptions(t),
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
        helperText: t('Disable to mark this liability as inactive.'),
      },
    ],
  }
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return undefined
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString()
}

function formatLiabilityDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value)
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

export function getLiabilityTableColumns(t: TFn): Array<CrudTableColumn<Liability>> {
  const statusOptions = getLiabilityStatusOptions(t)
  const activeOptions = getLiabilityActiveOptions(t)
  const getLiabilityStatusLabel = (status: LiabilityStatus) => {
    return statusOptions.find((option) => option.value === status)?.label ?? status
  }

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
      key: 'category',
      header: t('Category'),
      field: 'category',
      exportValue: (liability) => liability.category ?? '',
      render: (liability) => liability.category || '-',
    },
    {
      key: 'amount',
      header: t('Amount'),
      field: 'amount',
      sortField: 'amount',
      exportValue: (liability) => liability.amount,
      render: (liability) => formatCurrency(liability.amount),
    },
    {
      key: 'creditor',
      header: t('Creditor'),
      field: 'creditor',
      exportValue: (liability) => liability.creditor ?? '',
      render: (liability) => liability.creditor || '-',
    },
    {
      key: 'dueDate',
      header: t('Due date'),
      field: 'dueDate',
      exportValue: (liability) => formatLiabilityDate(liability.dueDate),
      filter: {
        key: 'dueDate',
        input: 'date',
        placeholder: t('Due date'),
      },
      render: (liability) => formatLiabilityDate(liability.dueDate),
    },
    {
      key: 'status',
      header: t('Status'),
      sortField: 'status',
      exportValue: (liability) => getLiabilityStatusLabel(liability.status),
      filter: {
        key: 'status',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Status'),
        options: statusOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (liability) => getLiabilityStatusLabel(liability.status),
    },
    {
      key: 'active',
      header: t('Active'),
      sortField: 'active',
      exportValue: (liability) => (liability.active ? t('Active') : t('Inactive')),
      filter: {
        key: 'active',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Active'),
        options: activeOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (liability) => renderBooleanBadge(liability.active, t('Active'), t('Inactive')),
    },
    {
      key: 'updated',
      header: t('Updated'),
      field: 'updated',
      sortField: 'updated',
      exportValue: (liability) => formatLiabilityDate(liability.updated),
      render: (liability) => formatLiabilityDate(liability.updated),
    },
  ]
}

export function mapLiabilityToFormValues(liability: Liability): LiabilityFormValues {
  return {
    _id: liability._id,
    name: liability.name,
    category: liability.category ?? '',
    amount: liability.amount,
    dueDate: liability.dueDate ?? null,
    creditor: liability.creditor ?? '',
    status: liability.status,
    notes: liability.notes ?? '',
    active: liability.active,
  }
}

export function mapLiabilityFormToCreatePayload(values: LiabilityFormValues): LiabilityCreatePayload {
  return {
    name: values.name.trim(),
    category: optionalText(values.category),
    amount: values.amount,
    dueDate: toIsoDate(values.dueDate),
    creditor: optionalText(values.creditor),
    status: values.status,
    notes: optionalText(values.notes),
    active: values.active,
  }
}

export function mapLiabilityFormToUpdatePayload(values: LiabilityFormValues): LiabilityUpdatePayload {
  return mapLiabilityFormToCreatePayload(values)
}

export function getRenderLiabilityDetails(t: TFn) {
  const statusOptions = getLiabilityStatusOptions(t)
  const getLiabilityStatusLabel = (status: LiabilityStatus) => {
    return statusOptions.find((option) => option.value === status)?.label ?? status
  }

  return function renderLiabilityDetails(liability: Liability) {
    const rows: Array<[string, string]> = [
      [t('Category'), liability.category || '-'],
      [t('Amount'), formatCurrency(liability.amount)],
      [t('Due date'), formatLiabilityDate(liability.dueDate)],
      [t('Creditor'), liability.creditor || '-'],
      [t('Status'), getLiabilityStatusLabel(liability.status)],
      [t('Notes'), liability.notes || '-'],
      [t('Active'), liability.active ? t('staff.crud.yes') : t('staff.crud.no')],
      [t('Updated'), formatLiabilityDate(liability.updated)],
    ]

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--color-text-strong)]">{liability.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {renderBooleanBadge(liability.active, t('Active'), t('Inactive'))}
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

export function getRenderLiabilityGridItem(t: TFn) {
  const statusOptions = getLiabilityStatusOptions(t)
  const getLiabilityStatusLabel = (status: LiabilityStatus) => {
    return statusOptions.find((option) => option.value === status)?.label ?? status
  }

  return function renderLiabilityGridItem(liability: Liability) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{liability.name}</h3>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{liability.creditor || '-'}</p>
        </div>

        <div className="flex flex-wrap gap-2">{renderBooleanBadge(liability.active, t('Active'), t('Inactive'))}</div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            [t('Amount'), formatCurrency(liability.amount)],
            [t('Status'), getLiabilityStatusLabel(liability.status)],
            [t('Updated'), formatLiabilityDate(liability.updated)],
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
