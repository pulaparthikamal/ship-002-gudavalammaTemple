import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { PrasadamItem, PrasadamItemPayload } from '@/services/api/endpoints/prasadamApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface PrasadamItemFormValues {
  _id?: string
  slug: string
  name: string
  price: number
  bookingOpensAt: string
  bookingClosesAt: string
  active: boolean
}

export const prasadamItemFormSchema = z.object({
  _id: z.string().optional(),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  price: z.number().min(0, 'Price must be 0 or more'),
  bookingOpensAt: z.string().optional(),
  bookingClosesAt: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<PrasadamItemFormValues>

export const prasadamItemDefaultValues: PrasadamItemFormValues = {
  _id: '',
  slug: '',
  name: '',
  price: 0,
  bookingOpensAt: '',
  bookingClosesAt: '',
  active: true,
}

export function getPrasadamItemFormConfig(t: TFn): CrudFormConfig<PrasadamItemFormValues> {
  return {
    schema: prasadamItemFormSchema,
    defaultValues: prasadamItemDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Item name'),
        type: 'text',
        placeholder: t('Enter prasadam item name'),
      },
      {
        name: 'slug',
        label: t('Slug'),
        type: 'text',
        placeholder: 'e.g. laddu',
        helperText: t('Unique identifier used by the system, e.g. laddu.'),
      },
      {
        name: 'price',
        label: t('Price'),
        type: 'number',
        min: 0,
        step: 1,
      },
      {
        name: 'bookingOpensAt',
        label: t('Orders open at'),
        type: 'time',
        helperText: t('Informational only — not enforced. Leave blank for no display.'),
      },
      {
        name: 'bookingClosesAt',
        label: t('Orders close at'),
        type: 'time',
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to hide this item from devotee ordering.'),
      },
    ],
  }
}

export function getPrasadamItemTableColumns(t: TFn): Array<CrudTableColumn<PrasadamItem>> {
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
      key: 'active',
      header: t('Active'),
      field: 'active',
      render: (item) => (item.active ? t('Active') : t('Inactive')),
    },
  ]
}

export function mapPrasadamItemToFormValues(item: PrasadamItem): PrasadamItemFormValues {
  return {
    _id: item._id,
    slug: item.slug,
    name: item.name,
    price: item.price,
    bookingOpensAt: item.bookingOpensAt ?? '',
    bookingClosesAt: item.bookingClosesAt ?? '',
    active: item.active,
  }
}

export function mapPrasadamItemFormToCreatePayload(values: PrasadamItemFormValues): PrasadamItemPayload {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    price: values.price,
    bookingOpensAt: values.bookingOpensAt?.trim() || undefined,
    bookingClosesAt: values.bookingClosesAt?.trim() || undefined,
    active: values.active,
  }
}

export function mapPrasadamItemFormToUpdatePayload(
  values: PrasadamItemFormValues,
): Partial<PrasadamItemPayload> {
  return mapPrasadamItemFormToCreatePayload(values)
}
