import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { TempleEvent, TempleEventPayload } from '@/services/api/endpoints/templeEventsApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface TempleEventFormValues {
  _id?: string
  name: string
  description: string
  imageUrl: string
  startDate: Date | string | null
  endDate: Date | string | null
  registrationRequired: boolean
  capacity: number | null
  registrationDeadline: Date | string | null
  active: boolean
}

export const templeEventFormSchema = z.object({
  _id: z.string().optional(),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  startDate: z.any(),
  endDate: z.any().optional().nullable(),
  registrationRequired: z.boolean(),
  capacity: z.number().nullable().optional(),
  registrationDeadline: z.any().optional().nullable(),
  active: z.boolean(),
}) as z.ZodType<TempleEventFormValues>

export const templeEventDefaultValues: TempleEventFormValues = {
  _id: '',
  name: '',
  description: '',
  imageUrl: '',
  startDate: null,
  endDate: null,
  registrationRequired: false,
  capacity: null,
  registrationDeadline: null,
  active: true,
}

export function getTempleEventFormConfig(t: TFn): CrudFormConfig<TempleEventFormValues> {
  return {
    schema: templeEventFormSchema,
    defaultValues: templeEventDefaultValues,
    columns: 2,
    fields: [
      { name: '_id', label: t('ID'), type: 'hidden' },
      { name: 'name', label: t('Event name'), type: 'text', fullWidth: true },
      { name: 'description', label: t('Description'), type: 'textarea', fullWidth: true, rows: 3 },
      { name: 'imageUrl', label: t('Image URL'), type: 'text', fullWidth: true },
      { name: 'startDate', label: t('Start date'), type: 'date', date: { showIcon: true } },
      { name: 'endDate', label: t('End date'), type: 'date', date: { showIcon: true } },
      { name: 'registrationRequired', label: t('Registration required'), type: 'switch' },
      { name: 'capacity', label: t('Capacity'), type: 'number', helperText: t('Leave blank for unlimited.') },
      { name: 'registrationDeadline', label: t('Registration deadline'), type: 'date', date: { showIcon: true } },
      { name: 'active', label: t('Active'), type: 'switch' },
    ],
  }
}

function formatEventDate(value?: string | null) {
  if (!value) return '-'
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).format(new Date(value))
}

export function getTempleEventTableColumns(t: TFn): Array<CrudTableColumn<TempleEvent>> {
  return [
    {
      key: 'name',
      header: t('Name'),
      field: 'name',
      sortField: 'name',
      filter: { key: 'name', type: 'regexOr', placeholder: t('Search name'), matchModes: ['contains', 'startsWith', 'endsWith'] },
    },
    {
      key: 'startDate',
      header: t('Start'),
      field: 'startDate',
      sortField: 'startDate',
      filter: { key: 'startDate', input: 'date', placeholder: t('Start date') },
      render: (e) => formatEventDate(e.startDate),
    },
    { key: 'endDate', header: t('End'), field: 'endDate', render: (e) => formatEventDate(e.endDate) },
    {
      key: 'registrationRequired',
      header: t('Registration'),
      field: 'registrationRequired',
      render: (e) => (e.registrationRequired ? t('Required') : t('Not required')),
    },
    { key: 'capacity', header: t('Capacity'), field: 'capacity', render: (e) => e.capacity ?? t('Unlimited') },
    { key: 'active', header: t('Active'), field: 'active', render: (e) => (e.active ? t('Active') : t('Inactive')) },
  ]
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) return undefined
  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString()
}

export function mapTempleEventToFormValues(event: TempleEvent): TempleEventFormValues {
  return {
    _id: event._id,
    name: event.name,
    description: event.description,
    imageUrl: event.imageUrl ?? '',
    startDate: event.startDate,
    endDate: event.endDate ?? null,
    registrationRequired: event.registrationRequired,
    capacity: event.capacity ?? null,
    registrationDeadline: event.registrationDeadline ?? null,
    active: event.active,
  }
}

export function mapTempleEventFormToCreatePayload(values: TempleEventFormValues): TempleEventPayload {
  return {
    name: values.name.trim(),
    description: values.description?.trim() || undefined,
    imageUrl: values.imageUrl?.trim() || undefined,
    startDate: toIsoDate(values.startDate) ?? new Date().toISOString(),
    endDate: toIsoDate(values.endDate),
    registrationRequired: values.registrationRequired,
    capacity: values.capacity ?? undefined,
    registrationDeadline: toIsoDate(values.registrationDeadline),
    active: values.active,
  }
}

export function mapTempleEventFormToUpdatePayload(values: TempleEventFormValues): Partial<TempleEventPayload> {
  return mapTempleEventFormToCreatePayload(values)
}
