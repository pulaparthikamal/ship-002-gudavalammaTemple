import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type { NearbyPlace, NearbyPlaceCategory, NearbyPlacePayload } from '@/services/api/endpoints/nearbyPlacesApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface NearbyPlaceFormValues {
  _id?: string
  name: string
  description: string
  distanceKm: number
  imageUrl: string
  category: NearbyPlaceCategory
  mapLink: string
  active: boolean
}

export function getNearbyPlaceCategoryOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Heritage'), value: 'heritage' },
    { label: t('Nature'), value: 'nature' },
    { label: t('Shopping'), value: 'shopping' },
    { label: t('Food'), value: 'food' },
    { label: t('Accommodation'), value: 'accommodation' },
    { label: t('Other'), value: 'other' },
  ]
}

export const nearbyPlaceFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  distanceKm: z.number().min(0, 'Distance must be 0 or more'),
  imageUrl: z.string().optional(),
  category: z.enum(['heritage', 'nature', 'shopping', 'food', 'accommodation', 'other']),
  mapLink: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<NearbyPlaceFormValues>

export const nearbyPlaceDefaultValues: NearbyPlaceFormValues = {
  _id: '',
  name: '',
  description: '',
  distanceKm: 0,
  imageUrl: '',
  category: 'other',
  mapLink: '',
  active: true,
}

export function getNearbyPlaceFormConfig(t: TFn): CrudFormConfig<NearbyPlaceFormValues> {
  return {
    schema: nearbyPlaceFormSchema,
    defaultValues: nearbyPlaceDefaultValues,
    columns: 2,
    fields: [
      { name: '_id', label: t('ID'), type: 'hidden' },
      { name: 'name', label: t('Place name'), type: 'text', fullWidth: true },
      { name: 'description', label: t('Description'), type: 'textarea', fullWidth: true, rows: 3 },
      { name: 'imageUrl', label: t('Image URL'), type: 'text', fullWidth: true },
      { name: 'distanceKm', label: t('Distance (km)'), type: 'number' },
      { name: 'category', label: t('Category'), type: 'select', options: getNearbyPlaceCategoryOptions(t) },
      { name: 'mapLink', label: t('Map link'), type: 'text', fullWidth: true, helperText: t('Google Maps or OpenStreetMap URL.') },
      { name: 'active', label: t('Active'), type: 'switch' },
    ],
  }
}

export function getNearbyPlaceTableColumns(t: TFn): Array<CrudTableColumn<NearbyPlace>> {
  const categoryOptions = getNearbyPlaceCategoryOptions(t)
  const categoryLabel = (value: NearbyPlaceCategory) =>
    categoryOptions.find((option) => option.value === value)?.label ?? value

  return [
    {
      key: 'name',
      header: t('Name'),
      field: 'name',
      sortField: 'name',
      filter: { key: 'name', type: 'regexOr', placeholder: t('Search name'), matchModes: ['contains', 'startsWith', 'endsWith'] },
    },
    {
      key: 'category',
      header: t('Category'),
      field: 'category',
      sortField: 'category',
      filter: { key: 'category', type: 'in', input: 'multiSelect', placeholder: t('Category'), options: categoryOptions },
      render: (p) => categoryLabel(p.category),
    },
    { key: 'distanceKm', header: t('Distance'), field: 'distanceKm', sortField: 'distanceKm', render: (p) => `${p.distanceKm} km` },
    { key: 'active', header: t('Active'), field: 'active', render: (p) => (p.active ? t('Active') : t('Inactive')) },
  ]
}

export function mapNearbyPlaceToFormValues(place: NearbyPlace): NearbyPlaceFormValues {
  return {
    _id: place._id,
    name: place.name,
    description: place.description,
    distanceKm: place.distanceKm,
    imageUrl: place.imageUrl ?? '',
    category: place.category,
    mapLink: place.mapLink ?? '',
    active: place.active,
  }
}

export function mapNearbyPlaceFormToCreatePayload(values: NearbyPlaceFormValues): NearbyPlacePayload {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    distanceKm: values.distanceKm,
    imageUrl: values.imageUrl?.trim() || undefined,
    category: values.category,
    mapLink: values.mapLink?.trim() || undefined,
    active: values.active,
  }
}

export function mapNearbyPlaceFormToUpdatePayload(values: NearbyPlaceFormValues): Partial<NearbyPlacePayload> {
  return mapNearbyPlaceFormToCreatePayload(values)
}
