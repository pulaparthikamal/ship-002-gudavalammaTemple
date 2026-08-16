import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type {
  Announcement,
  AnnouncementAudience,
  AnnouncementPayload,
  AnnouncementType,
} from '@/services/api/endpoints/announcementApi'

type TFn = (key: string, params?: Record<string, string | number>) => string

export interface AnnouncementFormValues {
  _id?: string
  title: string
  body: string
  imageUrl: string
  linkedEventId: string
  type: AnnouncementType
  startAt: Date | string | null
  endAt: Date | string | null
  active: boolean
  targetAudience: AnnouncementAudience
  priority: number
}

export function getAnnouncementTypeOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('Info'), value: 'info' },
    { label: t('Urgent'), value: 'urgent' },
    { label: t('Festival'), value: 'festival' },
  ]
}

export function getAnnouncementAudienceOptions(t: TFn): CrudSelectOption[] {
  return [
    { label: t('All'), value: 'all' },
    { label: t('Devotee'), value: 'devotee' },
    { label: t('Staff'), value: 'staff' },
  ]
}

export const announcementFormSchema = z.object({
  _id: z.string().optional(),
  title: z.string().trim().min(2, 'Title must be at least 2 characters'),
  body: z.string().trim().min(2, 'Body is required'),
  imageUrl: z.string().optional(),
  linkedEventId: z.string().optional(),
  type: z.enum(['info', 'urgent', 'festival']),
  startAt: z.any(),
  endAt: z.any().optional().nullable(),
  active: z.boolean(),
  targetAudience: z.enum(['all', 'devotee', 'staff']),
  priority: z.number(),
}) as z.ZodType<AnnouncementFormValues>

export const announcementDefaultValues: AnnouncementFormValues = {
  _id: '',
  title: '',
  body: '',
  imageUrl: '',
  linkedEventId: '',
  type: 'info',
  startAt: null,
  endAt: null,
  active: true,
  targetAudience: 'all',
  priority: 0,
}

export function createAnnouncementFormConfig(
  eventOptions: CrudSelectOption[],
  t: TFn,
): CrudFormConfig<AnnouncementFormValues> {
  return {
    schema: announcementFormSchema,
    defaultValues: announcementDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: t('ID'),
        type: 'hidden',
      },
      {
        name: 'title',
        label: t('Title'),
        type: 'text',
        placeholder: t('Enter announcement title'),
        fullWidth: true,
      },
      {
        name: 'body',
        label: t('Body'),
        type: 'textarea',
        placeholder: t('Enter announcement body'),
        fullWidth: true,
        rows: 4,
      },
      {
        name: 'imageUrl',
        label: t('Image URL'),
        type: 'text',
        placeholder: 'https://…',
        helperText: t('Shown alongside the announcement popup, if provided.'),
        fullWidth: true,
      },
      {
        name: 'type',
        label: t('Type'),
        type: 'select',
        options: getAnnouncementTypeOptions(t),
      },
      {
        name: 'targetAudience',
        label: t('Target audience'),
        type: 'select',
        options: getAnnouncementAudienceOptions(t),
      },
      {
        name: 'linkedEventId',
        label: t('Linked event'),
        type: 'select',
        options: [{ label: t('None'), value: '' }, ...eventOptions],
        helperText: t("For festival announcements — links the popup's CTA to that event's registration page."),
      },
      {
        name: 'startAt',
        label: t('Start date'),
        type: 'date',
        date: {
          showIcon: true,
        },
      },
      {
        name: 'endAt',
        label: t('End date'),
        type: 'date',
        helperText: t('Leave empty for an announcement with no end date.'),
        date: {
          showIcon: true,
        },
      },
      {
        name: 'priority',
        label: t('Priority'),
        type: 'number',
        helperText: t('Higher priority announcements are shown first.'),
        step: 1,
      },
      {
        name: 'active',
        label: t('Active'),
        type: 'switch',
        helperText: t('Disable to stop showing this announcement.'),
      },
    ],
  }
}

function formatAnnouncementDate(value?: string | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function getAnnouncementTableColumns(t: TFn): Array<CrudTableColumn<Announcement>> {
  const typeOptions = getAnnouncementTypeOptions(t)
  const audienceOptions = getAnnouncementAudienceOptions(t)

  return [
    {
      key: 'title',
      header: t('Title'),
      field: 'title',
      sortField: 'title',
      filter: {
        key: 'title',
        type: 'regexOr',
        placeholder: t('Search title'),
        matchModes: ['contains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
      },
    },
    {
      key: 'type',
      header: t('Type'),
      field: 'type',
      filter: {
        key: 'type',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Type'),
        options: typeOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (announcement) => typeOptions.find((option) => option.value === announcement.type)?.label ?? announcement.type,
    },
    {
      key: 'targetAudience',
      header: t('Audience'),
      field: 'targetAudience',
      filter: {
        key: 'targetAudience',
        type: 'in',
        input: 'multiSelect',
        placeholder: t('Audience'),
        options: audienceOptions,
        matchModes: ['in', 'notIn'],
      },
      render: (announcement) =>
        audienceOptions.find((option) => option.value === announcement.targetAudience)?.label ??
        announcement.targetAudience,
    },
    {
      key: 'priority',
      header: t('Priority'),
      field: 'priority',
      sortField: 'priority',
    },
    {
      key: 'startAt',
      header: t('Start'),
      field: 'startAt',
      sortField: 'startAt',
      render: (announcement) => formatAnnouncementDate(announcement.startAt),
    },
    {
      key: 'endAt',
      header: t('End'),
      field: 'endAt',
      render: (announcement) => formatAnnouncementDate(announcement.endAt),
    },
    {
      key: 'active',
      header: t('Active'),
      field: 'active',
      render: (announcement) => (announcement.active ? t('Active') : t('Inactive')),
    },
  ]
}

function toIsoDate(value: Date | string | null | undefined) {
  if (!value) {
    return undefined
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? undefined : dateValue.toISOString()
}

export function mapAnnouncementToFormValues(announcement: Announcement): AnnouncementFormValues {
  return {
    _id: announcement._id,
    title: announcement.title,
    body: announcement.body,
    imageUrl: announcement.imageUrl ?? '',
    linkedEventId: announcement.linkedEventId ?? '',
    type: announcement.type,
    startAt: announcement.startAt,
    endAt: announcement.endAt,
    active: announcement.active,
    targetAudience: announcement.targetAudience,
    priority: announcement.priority,
  }
}

export function mapAnnouncementFormToCreatePayload(values: AnnouncementFormValues): AnnouncementPayload {
  return {
    title: values.title.trim(),
    body: values.body.trim(),
    imageUrl: values.imageUrl?.trim() || undefined,
    linkedEventId: values.linkedEventId || undefined,
    type: values.type,
    startAt: toIsoDate(values.startAt) ?? new Date().toISOString(),
    endAt: toIsoDate(values.endAt) ?? null,
    active: values.active,
    targetAudience: values.targetAudience,
    priority: values.priority,
  }
}

export function mapAnnouncementFormToUpdatePayload(
  values: AnnouncementFormValues,
): Partial<AnnouncementPayload> {
  return mapAnnouncementFormToCreatePayload(values)
}
