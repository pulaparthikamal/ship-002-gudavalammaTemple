import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { DarshanQuota, DarshanQuotaPayload } from '@/services/api/endpoints/darshanApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface DarshanQuotaFormValues {
  _id?: string
  slug: string
  name: string
  price: number
  dailyCapacity: number
  bookingOpensAt: string
  bookingClosesAt: string
  active: boolean
}

export const darshanQuotaFormSchema = z.object({
  _id: z.string().optional(),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  price: z.number().min(0, 'Price must be 0 or more'),
  dailyCapacity: z.number().min(1, 'Daily capacity must be at least 1'),
  bookingOpensAt: z.string().optional(),
  bookingClosesAt: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<DarshanQuotaFormValues>

export const darshanQuotaDefaultValues: DarshanQuotaFormValues = {
  _id: '',
  slug: '',
  name: '',
  price: 0,
  dailyCapacity: 500,
  bookingOpensAt: '',
  bookingClosesAt: '',
  active: true,
}

export function getDarshanQuotaFormConfig(t: TFn): CrudFormConfig<DarshanQuotaFormValues> {
  return {
    schema: darshanQuotaFormSchema,
    defaultValues: darshanQuotaDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Quota name'),
        type: 'text',
        placeholder: t('Enter quota name'),
      },
      {
        name: 'slug',
        label: t('Slug'),
        type: 'text',
        placeholder: 'e.g. special',
        helperText: t('Unique identifier used by the system, e.g. special.'),
      },
      {
        name: 'price',
        label: t('Price'),
        type: 'number',
        min: 0,
        step: 1,
      },
      {
        name: 'dailyCapacity',
        label: t('Daily capacity'),
        type: 'number',
        min: 1,
        step: 1,
      },
      {
        name: 'bookingOpensAt',
        label: t('Bookings open at'),
        type: 'time',
        helperText: t('Informational only — not enforced. Leave blank for no display.'),
      },
      {
        name: 'bookingClosesAt',
        label: t('Bookings close at'),
        type: 'time',
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to hide this quota from devotee booking.'),
      },
    ],
  }
}

export function getDarshanQuotaTableColumns(t: TFn): Array<CrudTableColumn<DarshanQuota>> {
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
      key: 'slug',
      header: t('Slug'),
      field: 'slug',
      filter: {
        key: 'slug',
        type: 'regexOr',
        placeholder: t('Search slug'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'price',
      header: t('Price'),
      field: 'price',
      sortField: 'price',
    },
    {
      key: 'dailyCapacity',
      header: t('Daily capacity'),
      field: 'dailyCapacity',
      sortField: 'dailyCapacity',
    },
    {
      key: 'active',
      header: t('Active'),
      field: 'active',
      render: (quota) => (quota.active ? t('Active') : t('Inactive')),
    },
  ]
}

export function mapDarshanQuotaToFormValues(quota: DarshanQuota): DarshanQuotaFormValues {
  return {
    _id: quota._id,
    slug: quota.slug,
    name: quota.name,
    price: quota.price,
    dailyCapacity: quota.dailyCapacity,
    bookingOpensAt: quota.bookingOpensAt ?? '',
    bookingClosesAt: quota.bookingClosesAt ?? '',
    active: quota.active,
  }
}

export function mapDarshanQuotaFormToCreatePayload(values: DarshanQuotaFormValues): DarshanQuotaPayload {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    price: values.price,
    dailyCapacity: values.dailyCapacity,
    bookingOpensAt: values.bookingOpensAt?.trim() || undefined,
    bookingClosesAt: values.bookingClosesAt?.trim() || undefined,
    active: values.active,
  }
}

export function mapDarshanQuotaFormToUpdatePayload(
  values: DarshanQuotaFormValues,
): Partial<DarshanQuotaPayload> {
  return mapDarshanQuotaFormToCreatePayload(values)
}
