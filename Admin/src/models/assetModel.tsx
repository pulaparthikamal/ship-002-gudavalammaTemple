import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type { Asset, AssetCategory, AssetCreatePayload, AssetFormValues, AssetUpdatePayload } from '@/types/asset'

type TFn = (key: string, params?: Record<string, string | number>) => string

export const assetApiDetails = {
  endpoint: '/assets',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export function getAssetCategoryOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Furniture'), value: 'furniture' },
    { label: t('Electronics'), value: 'electronics' },
    { label: t('Vehicle'), value: 'vehicle' },
    { label: t('Jewellery'), value: 'jewellery' },
    { label: t('Other'), value: 'other' },
  ]
}

export function getAssetActiveOptions(t: TFn) {
  return [
    { label: t('Active'), value: true },
    { label: t('Inactive'), value: false },
  ]
}

export const assetFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(1, 'Name is required'),
  category: z.string().trim(),
  purchaseDate: z.any().optional(),
  cost: z.number().min(0, 'Cost must be 0 or more'),
  currentValue: z.number().min(0, 'Current value must be 0 or more'),
  custodian: z.string().trim(),
  location: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<AssetFormValues>

export const assetDefaultValues: AssetFormValues = {
  _id: '',
  name: '',
  category: '',
  purchaseDate: null,
  cost: 0,
  currentValue: 0,
  custodian: '',
  location: '',
  active: true,
}

export function getAssetFormConfig(t: TFn): CrudFormConfig<AssetFormValues> {
  return {
    schema: assetFormSchema,
    defaultValues: assetDefaultValues,
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
        placeholder: t('Enter asset name'),
      },
      {
        name: 'category',
        label: t('Category'),
        type: 'select',
        placeholder: t('Choose category'),
        options: getAssetCategoryOptions(t),
      },
      {
        name: 'purchaseDate',
        label: t('Purchase date'),
        type: 'date',
      },
      {
        name: 'cost',
        label: t('Cost'),
        type: 'number',
        min: 0,
        step: 0.01,
      },
      {
        name: 'currentValue',
        label: t('Current value'),
        type: 'number',
        min: 0,
        step: 0.01,
      },
      {
        name: 'custodian',
        label: t('Custodian'),
        type: 'text',
        placeholder: t('Enter custodian name'),
      },
      {
        name: 'location',
        label: t('Location'),
        type: 'text',
        placeholder: t('Enter location'),
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to mark this asset as inactive.'),
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

function formatAssetDate(value?: string | null) {
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

export function getAssetTableColumns(t: TFn): Array<CrudTableColumn<Asset>> {
  const categoryOptions = getAssetCategoryOptions(t)
  const activeOptions = getAssetActiveOptions(t)
  const getAssetCategoryLabel = (category?: string) => {
    if (!category) return '-'
    return categoryOptions.find((option) => option.value === category)?.label ?? category
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
      sortField: 'category',
      exportValue: (asset) => getAssetCategoryLabel(asset.category),
      filter: {
        key: 'category',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Category'),
        options: categoryOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (asset) => getAssetCategoryLabel(asset.category),
    },
    {
      key: 'cost',
      header: t('Cost'),
      field: 'cost',
      sortField: 'cost',
      exportValue: (asset) => asset.cost,
      render: (asset) => formatCurrency(asset.cost),
    },
    {
      key: 'currentValue',
      header: t('Current value'),
      field: 'currentValue',
      sortField: 'currentValue',
      exportValue: (asset) => asset.currentValue,
      render: (asset) => formatCurrency(asset.currentValue),
    },
    {
      key: 'custodian',
      header: t('Custodian'),
      field: 'custodian',
      exportValue: (asset) => asset.custodian ?? '',
      render: (asset) => asset.custodian || '-',
    },
    {
      key: 'location',
      header: t('Location'),
      field: 'location',
      exportValue: (asset) => asset.location ?? '',
      render: (asset) => asset.location || '-',
    },
    {
      key: 'active',
      header: t('Active'),
      sortField: 'active',
      exportValue: (asset) => (asset.active ? t('Active') : t('Inactive')),
      filter: {
        key: 'active',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Active'),
        options: activeOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (asset) => renderBooleanBadge(asset.active, t('Active'), t('Inactive')),
    },
    {
      key: 'updated',
      header: t('Updated'),
      field: 'updated',
      sortField: 'updated',
      exportValue: (asset) => formatAssetDate(asset.updated),
      render: (asset) => formatAssetDate(asset.updated),
    },
  ]
}

export function mapAssetToFormValues(asset: Asset): AssetFormValues {
  return {
    _id: asset._id,
    name: asset.name,
    category: (asset.category as AssetCategory) ?? '',
    purchaseDate: asset.purchaseDate ?? null,
    cost: asset.cost,
    currentValue: asset.currentValue,
    custodian: asset.custodian ?? '',
    location: asset.location ?? '',
    active: asset.active,
  }
}

export function mapAssetFormToCreatePayload(values: AssetFormValues): AssetCreatePayload {
  return {
    name: values.name.trim(),
    category: values.category ? (values.category as AssetCategory) : undefined,
    purchaseDate: toIsoDate(values.purchaseDate),
    cost: values.cost,
    currentValue: values.currentValue,
    custodian: optionalText(values.custodian),
    location: optionalText(values.location),
    active: values.active,
  }
}

export function mapAssetFormToUpdatePayload(values: AssetFormValues): AssetUpdatePayload {
  return mapAssetFormToCreatePayload(values)
}

export function getRenderAssetDetails(t: TFn) {
  const categoryOptions = getAssetCategoryOptions(t)
  const getAssetCategoryLabel = (category?: string) => {
    if (!category) return '-'
    return categoryOptions.find((option) => option.value === category)?.label ?? category
  }

  return function renderAssetDetails(asset: Asset) {
    const rows: Array<[string, string]> = [
      [t('Category'), getAssetCategoryLabel(asset.category)],
      [t('Purchase date'), formatAssetDate(asset.purchaseDate)],
      [t('Cost'), formatCurrency(asset.cost)],
      [t('Current value'), formatCurrency(asset.currentValue)],
      [t('Custodian'), asset.custodian || '-'],
      [t('Location'), asset.location || '-'],
      [t('Active'), asset.active ? t('staff.crud.yes') : t('staff.crud.no')],
      [t('Updated'), formatAssetDate(asset.updated)],
    ]

    return (
      <div className="space-y-5">
        <div>
          <h3 className="text-lg font-semibold leading-7 text-[var(--color-text-strong)]">{asset.name}</h3>
          <div className="mt-3 flex flex-wrap gap-2">{renderBooleanBadge(asset.active, t('Active'), t('Inactive'))}</div>
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

export function getRenderAssetGridItem(t: TFn) {
  const categoryOptions = getAssetCategoryOptions(t)
  const getAssetCategoryLabel = (category?: string) => {
    if (!category) return '-'
    return categoryOptions.find((option) => option.value === category)?.label ?? category
  }

  return function renderAssetGridItem(asset: Asset) {
    return (
      <div className="space-y-3">
        <div>
          <h3 className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{asset.name}</h3>
          <p className="truncate text-xs text-[var(--color-text-muted)]">{getAssetCategoryLabel(asset.category)}</p>
        </div>

        <div className="flex flex-wrap gap-2">{renderBooleanBadge(asset.active, t('Active'), t('Inactive'))}</div>

        <dl className="grid gap-2.5 sm:grid-cols-2">
          {[
            [t('Current value'), formatCurrency(asset.currentValue)],
            [t('Custodian'), asset.custodian || '-'],
            [t('Updated'), formatAssetDate(asset.updated)],
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
