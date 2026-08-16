import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { Facility, FacilityPayload } from '@/services/api/endpoints/facilityApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface FacilityFormValues {
  _id?: string
  slug: string
  name: string
  description: string
  icon: string
  active: boolean
}

export const facilityFormSchema = z.object({
  _id: z.string().optional(),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().trim().min(2, 'Description is required'),
  icon: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<FacilityFormValues>

export const facilityDefaultValues: FacilityFormValues = {
  _id: '',
  slug: '',
  name: '',
  description: '',
  icon: '',
  active: true,
}

export function getFacilityFormConfig(t: TFn): CrudFormConfig<FacilityFormValues> {
  return {
    schema: facilityFormSchema,
    defaultValues: facilityDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Facility name'),
        type: 'text',
        placeholder: t('Enter facility name'),
      },
      {
        name: 'slug',
        label: t('Slug'),
        type: 'text',
        placeholder: 'e.g. parking',
        helperText: t('Unique identifier used by the system, e.g. parking.'),
      },
      {
        name: 'icon',
        label: t('Icon'),
        type: 'text',
        placeholder: 'e.g. pi pi-car',
        helperText: t('Optional icon name/class shown alongside the facility.'),
      },
      {
        name: 'description',
        label: t('Description'),
        type: 'textarea',
        placeholder: t('Enter facility description'),
        fullWidth: true,
        rows: 4,
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to hide this facility from the public facilities list.'),
      },
    ],
  }
}

export function getFacilityTableColumns(t: TFn): Array<CrudTableColumn<Facility>> {
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
      key: 'description',
      header: t('Description'),
      field: 'description',
    },
    {
      key: 'active',
      header: t('Active'),
      field: 'active',
      render: (facility) => (facility.active ? t('Active') : t('Inactive')),
    },
  ]
}

export function mapFacilityToFormValues(facility: Facility): FacilityFormValues {
  return {
    _id: facility._id,
    slug: facility.slug,
    name: facility.name,
    description: facility.description,
    icon: facility.icon ?? '',
    active: facility.active,
  }
}

export function mapFacilityFormToCreatePayload(values: FacilityFormValues): FacilityPayload {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    icon: values.icon.trim() || undefined,
    active: values.active,
  }
}

export function mapFacilityFormToUpdatePayload(values: FacilityFormValues): Partial<FacilityPayload> {
  return mapFacilityFormToCreatePayload(values)
}
