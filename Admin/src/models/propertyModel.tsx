import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type {
  Property,
  PropertyCreatePayload,
  PropertyFormValues,
  PropertyStatus,
  PropertyType,
  PropertyUpdatePayload,
} from '@/types/property'

type TFn = (key: string, params?: Record<string, string | number>) => string

export const propertyApiDetails = {
  endpoint: '/properties',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export function getPropertyTypeOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Land'), value: 'land' },
    { label: t('Building'), value: 'building' },
    { label: t('Vehicle'), value: 'vehicle' },
    { label: t('Jewellery'), value: 'jewellery' },
    { label: t('Other'), value: 'other' },
  ]
}

export function getPropertyStatusOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Active'), value: 'active' },
    { label: t('Disputed'), value: 'disputed' },
    { label: t('Sold'), value: 'sold' },
  ]
}

export function getPropertyActiveOptions(t: TFn) {
  return [
    { label: t('Active'), value: true },
    { label: t('Inactive'), value: false },
  ]
}

export const propertyFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  type: z.enum(['land', 'building', 'vehicle', 'jewellery', 'other']),
  location: z.string().trim(),
  areaSqft: z.number().min(0, 'Area must be 0 or more').optional(),
  acquisitionDate: z.any().optional(),
  estimatedValue: z.number().min(0, 'Estimated value must be 0 or more'),
  status: z.enum(['active', 'disputed', 'sold']),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<PropertyFormValues>

export const propertyDefaultValues: PropertyFormValues = {
  _id: '',
  name: '',
  type: 'land' as PropertyType,
  location: '',
  areaSqft: undefined,
  acquisitionDate: null,
  estimatedValue: 0,
  status: 'active' as PropertyStatus,
  notes: '',
  active: true,
}

export function getPropertyFormConfig(t: TFn): CrudFormConfig<PropertyFormValues> {
  return {
    schema: propertyFormSchema,
    defaultValues: propertyDefaultValues,
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
        placeholder: t('Enter property name'),
      },
      {
        name: 'type',
        label: t('Type'),
        type: 'select',
        placeholder: t('Choose type'),
        options: getPropertyTypeOptions(t),
      },
      {
        name: 'location',
        label: t('Location'),
        type: 'text',
        placeholder: t('Enter location'),
      },
      {
        name: 'areaSqft',
        label: t('Area (sqft)'),
        type: 'number',
        min: 0,
      },
      {
        name: 'acquisitionDate',
        label: t('Acquisition date'),
        type: 'date',
      },
      {
        name: 'estimatedValue',
        label: t('Estimated value'),
        type: 'number',
        min: 0,
        step: 0.01,
      },
      {
        name: 'status',
        label: t('Status'),
        type: 'select',
        placeholder: t('Choose status'),
        options: getPropertyStatusOptions(t),
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
        helperText: t('Disable to mark this property as inactive.'),
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

function formatPropertyDate(value?: string | null) {
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

export function getPropertyTableColumns(t: TFn): Array<CrudTableColumn<Property>> {
  const typeOptions = getPropertyTypeOptions(t)
  const statusOptions = getPropertyStatusOptions(t)
  const activeOptions = getPropertyActiveOptions(t)
  const getPropertyTypeLabel = (type: PropertyType) => {
    return typeOptions.find((option) => option.value === type)?.label ?? type
  }
  const getPropertyStatusLabel = (status: PropertyStatus) => {
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
      key: 'type',
      header: t('Type'),
      sortField: 'type',
      exportValue: (property) => getPropertyTypeLabel(property.type),
      filter: {
        key: 'type',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Type'),
        options: typeOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (property) => getPropertyTypeLabel(property.type),
    },
    {
      key: 'location',
      header: t('Location'),
      field: 'location',
      exportValue: (property) => property.location ?? '',
      render: (property) => property.location || '-',
    },
    {
      key: 'estimatedValue',
      header: t('Estimated value'),
      field: 'estimatedValue',
      sortField: 'estimatedValue',
      exportValue: (property) => property.estimatedValue,
      render: (property) => formatCurrency(property.estimatedValue),
    },
    {
      key: 'status',
      header: t('Status'),
      sortField: 'status',
      exportValue: (property) => getPropertyStatusLabel(property.status),
      filter: {
        key: 'status',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Status'),
        options: statusOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (property) => getPropertyStatusLabel(property.status),
    },
    {
      key: 'active',
      header: t('Active'),
      sortField: 'active',
      exportValue: (property) => (property.active ? t('Active') : t('Inactive')),
      filter: {
        key: 'active',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Active'),
        options: activeOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (property) => renderBooleanBadge(property.active, t('Active'), t('Inactive')),
    },
    {
      key: 'updated',
      header: t('Updated'),
      field: 'updated',
      sortField: 'updated',
      exportValue: (property) => formatPropertyDate(property.updated),
      render: (property) => formatPropertyDate(property.updated),
    },
  ]
}

export function mapPropertyToFormValues(property: Property): PropertyFormValues {
  return {
    _id: property._id,
    name: property.name,
    type: property.type,
    location: property.location ?? '',
    areaSqft: property.areaSqft,
    acquisitionDate: property.acquisitionDate ?? null,
    estimatedValue: property.estimatedValue,
    status: property.status,
    notes: property.notes ?? '',
    active: property.active,
  }
}

export function mapPropertyFormToCreatePayload(values: PropertyFormValues): PropertyCreatePayload {
  return {
    name: values.name.trim(),
    type: values.type,
    location: optionalText(values.location),
    areaSqft: values.areaSqft,
    acquisitionDate: toIsoDate(values.acquisitionDate),
    estimatedValue: values.estimatedValue,
    status: values.status,
    notes: optionalText(values.notes),
    active: values.active,
  }
}

export function mapPropertyFormToUpdatePayload(values: PropertyFormValues): PropertyUpdatePayload {
  return mapPropertyFormToCreatePayload(values)
}

export function getRenderPropertyDetails(t: TFn) {
  const typeOptions = getPropertyTypeOptions(t)
  const statusOptions = getPropertyStatusOptions(t)
  const getPropertyTypeLabel = (type: PropertyType) => {
    return typeOptions.find((option) => option.value === type)?.label ?? type
  }
  const getPropertyStatusLabel = (status: PropertyStatus) => {
    return statusOptions.find((option) => option.value === status)?.label ?? status
  }

  return function renderPropertyDetails(property: Property) {
    const rows: Array<[string, string]> = [
      [t('Type'), getPropertyTypeLabel(property.type)],
      [t('Location'), property.location || '-'],
      [t('Area (sqft)'), property.areaSqft != null ? String(property.areaSqft) : '-'],
      [t('Acquisition date'), formatPropertyDate(property.acquisitionDate)],
      [t('Estimated value'), formatCurrency(property.estimatedValue)],
      [t('Status'), getPropertyStatusLabel(property.status)],
      [t('Notes'), property.notes || '-'],
      [t('Active'), property.active ? t('staff.crud.yes') : t('staff.crud.no')],
      [t('Updated'), formatPropertyDate(property.updated)],
    ]

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--color-text-strong)]">{property.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">{renderBooleanBadge(property.active, t('Active'), t('Inactive'))}</div>
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

export function getRenderPropertyGridItem(t: TFn) {
  const typeOptions = getPropertyTypeOptions(t)
  const statusOptions = getPropertyStatusOptions(t)
  const getPropertyTypeLabel = (type: PropertyType) => {
    return typeOptions.find((option) => option.value === type)?.label ?? type
  }
  const getPropertyStatusLabel = (status: PropertyStatus) => {
    return statusOptions.find((option) => option.value === status)?.label ?? status
  }

  return function renderPropertyGridItem(property: Property) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{property.name}</h3>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{getPropertyTypeLabel(property.type)}</p>
        </div>

        <div className="flex flex-wrap gap-2">{renderBooleanBadge(property.active, t('Active'), t('Inactive'))}</div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            [t('Status'), getPropertyStatusLabel(property.status)],
            [t('Value'), formatCurrency(property.estimatedValue)],
            [t('Updated'), formatPropertyDate(property.updated)],
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
