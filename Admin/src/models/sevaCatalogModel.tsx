import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type { Seva, SevaCatalogPayload, SevaCategory } from '@/services/api/endpoints/sevaApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface SevaCatalogFormValues {
  _id?: string
  slug: string
  name: string
  category: SevaCategory
  timing: string
  price: number
  bookingOpensAt: string
  bookingClosesAt: string
  active: boolean
}

export function getSevaCategoryOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Pratyaksha'), value: 'pratyaksha' },
    { label: t('Paroksha'), value: 'paroksha' },
    { label: t('Saswata'), value: 'saswata' },
  ]
}

export const sevaCatalogFormSchema = z.object({
  _id: z.string().optional(),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  category: z.enum(['pratyaksha', 'paroksha', 'saswata']),
  timing: z.string().trim().min(2, 'Timing is required'),
  price: z.number().min(0, 'Price must be 0 or more'),
  bookingOpensAt: z.string().optional(),
  bookingClosesAt: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<SevaCatalogFormValues>

export const sevaCatalogDefaultValues: SevaCatalogFormValues = {
  _id: '',
  slug: '',
  name: '',
  category: 'pratyaksha',
  timing: '',
  price: 0,
  bookingOpensAt: '',
  bookingClosesAt: '',
  active: true,
}

export function getSevaCatalogFormConfig(t: TFn): CrudFormConfig<SevaCatalogFormValues> {
  return {
    schema: sevaCatalogFormSchema,
    defaultValues: sevaCatalogDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Seva name'),
        type: 'text',
        placeholder: t('Enter seva name'),
      },
      {
        name: 'slug',
        label: t('Slug'),
        type: 'text',
        placeholder: 'e.g. archana',
        helperText: t('Unique identifier used by the system, e.g. archana.'),
      },
      {
        name: 'category',
        label: t('Category'),
        type: 'select',
        options: getSevaCategoryOptions(t),
      },
      {
        name: 'timing',
        label: t('Timing'),
        type: 'text',
        placeholder: 'e.g. 7:00 - 10:00 AM daily',
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
        helperText: t('Disable to hide this seva from devotee booking.'),
      },
    ],
  }
}

export function getSevaCatalogTableColumns(t: TFn): Array<CrudTableColumn<Seva>> {
  const categoryOptions = getSevaCategoryOptions(t)

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
      key: 'category',
      header: t('Category'),
      field: 'category',
      sortField: 'category',
      filter: {
        key: 'category',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Category'),
        options: categoryOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (seva) => categoryOptions.find((option) => option.value === seva.category)?.label ?? seva.category,
    },
    {
      key: 'timing',
      header: t('Timing'),
      field: 'timing',
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
      render: (seva) => (seva.active ? t('Active') : t('Inactive')),
    },
  ]
}

export function mapSevaToFormValues(seva: Seva): SevaCatalogFormValues {
  return {
    _id: seva._id,
    slug: seva.slug,
    name: seva.name,
    category: seva.category,
    timing: seva.timing,
    price: seva.price,
    bookingOpensAt: seva.bookingOpensAt ?? '',
    bookingClosesAt: seva.bookingClosesAt ?? '',
    active: seva.active,
  }
}

export function mapSevaFormToCreatePayload(values: SevaCatalogFormValues): SevaCatalogPayload {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    category: values.category,
    timing: values.timing.trim(),
    price: values.price,
    bookingOpensAt: values.bookingOpensAt?.trim() || undefined,
    bookingClosesAt: values.bookingClosesAt?.trim() || undefined,
    active: values.active,
  }
}

export function mapSevaFormToUpdatePayload(values: SevaCatalogFormValues): Partial<SevaCatalogPayload> {
  return mapSevaFormToCreatePayload(values)
}
