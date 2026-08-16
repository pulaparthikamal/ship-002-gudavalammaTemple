import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type {
  AccommodationRoomType,
  AccommodationRoomTypePayload,
} from '@/services/api/endpoints/accommodationApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface AccommodationRoomTypeFormValues {
  _id?: string
  slug: string
  name: string
  detail: string
  pricePerNight: number
  totalRooms: number
  bookingOpensAt: string
  bookingClosesAt: string
  active: boolean
}

export const accommodationRoomTypeFormSchema = z.object({
  _id: z.string().optional(),
  slug: z.string().trim().min(2, 'Slug must be at least 2 characters'),
  name: z.string().trim().min(2, 'Name must be at least 2 characters'),
  detail: z.string().trim(),
  pricePerNight: z.number().min(0, 'Price per night must be 0 or more'),
  totalRooms: z.number().min(1, 'Total rooms must be at least 1'),
  bookingOpensAt: z.string().optional(),
  bookingClosesAt: z.string().optional(),
  active: z.boolean(),
}) as z.ZodType<AccommodationRoomTypeFormValues>

export const accommodationRoomTypeDefaultValues: AccommodationRoomTypeFormValues = {
  _id: '',
  slug: '',
  name: '',
  detail: '',
  pricePerNight: 0,
  totalRooms: 20,
  bookingOpensAt: '',
  bookingClosesAt: '',
  active: true,
}

export function getAccommodationRoomTypeFormConfig(t: TFn): CrudFormConfig<AccommodationRoomTypeFormValues> {
  return {
    schema: accommodationRoomTypeFormSchema,
    defaultValues: accommodationRoomTypeDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'name',
        label: t('Room type name'),
        type: 'text',
        placeholder: t('Enter room type name'),
      },
      {
        name: 'slug',
        label: t('Slug'),
        type: 'text',
        placeholder: 'e.g. deluxe',
        helperText: t('Unique identifier used by the system, e.g. deluxe.'),
      },
      {
        name: 'detail',
        label: t('Detail'),
        type: 'textarea',
        placeholder: t('Enter room type detail'),
        fullWidth: true,
        rows: 3,
      },
      {
        name: 'pricePerNight',
        label: t('Price per night'),
        type: 'number',
        min: 0,
        step: 1,
      },
      {
        name: 'totalRooms',
        label: t('Total rooms'),
        type: 'number',
        min: 1,
        step: 1,
      },
      {
        name: 'bookingOpensAt',
        label: t('Booking desk opens at'),
        type: 'time',
        helperText: t('Informational only — not enforced. Leave blank for no display.'),
      },
      {
        name: 'bookingClosesAt',
        label: t('Booking desk closes at'),
        type: 'time',
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to hide this room type from devotee booking.'),
      },
    ],
  }
}

export function getAccommodationRoomTypeTableColumns(t: TFn): Array<CrudTableColumn<AccommodationRoomType>> {
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
      key: 'pricePerNight',
      header: t('Price / night'),
      field: 'pricePerNight',
      sortField: 'pricePerNight',
    },
    {
      key: 'totalRooms',
      header: t('Total rooms'),
      field: 'totalRooms',
      sortField: 'totalRooms',
    },
    {
      key: 'active',
      header: t('Active'),
      field: 'active',
      render: (roomType) => (roomType.active ? t('Active') : t('Inactive')),
    },
  ]
}

export function mapAccommodationRoomTypeToFormValues(
  roomType: AccommodationRoomType,
): AccommodationRoomTypeFormValues {
  return {
    _id: roomType._id,
    slug: roomType.slug,
    name: roomType.name,
    detail: roomType.detail ?? '',
    pricePerNight: roomType.pricePerNight,
    totalRooms: roomType.totalRooms,
    bookingOpensAt: roomType.bookingOpensAt ?? '',
    bookingClosesAt: roomType.bookingClosesAt ?? '',
    active: roomType.active,
  }
}

export function mapAccommodationRoomTypeFormToCreatePayload(
  values: AccommodationRoomTypeFormValues,
): AccommodationRoomTypePayload {
  return {
    slug: values.slug.trim(),
    name: values.name.trim(),
    detail: values.detail.trim() || undefined,
    pricePerNight: values.pricePerNight,
    totalRooms: values.totalRooms,
    bookingOpensAt: values.bookingOpensAt?.trim() || undefined,
    bookingClosesAt: values.bookingClosesAt?.trim() || undefined,
    active: values.active,
  }
}

export function mapAccommodationRoomTypeFormToUpdatePayload(
  values: AccommodationRoomTypeFormValues,
): Partial<AccommodationRoomTypePayload> {
  return mapAccommodationRoomTypeFormToCreatePayload(values)
}
