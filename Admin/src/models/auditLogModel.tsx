import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { AuditLog, AuditLogCreatePayload, AuditLogFormValues } from '@/types/auditLog'

export const auditLogApiDetails = {
  endpoint: '/rcm/audit-logs',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const auditLogFormSchema = z.object({
  _id: z.string().optional(),
  entityType: z.string().trim(),
  entityId: z.string().trim(),
  action: z.string().trim(),
  fieldName: z.string().trim(),
  oldValue: z.string().trim(),
  newValue: z.string().trim(),
  changedBy: z.string().trim(),
  timestamp: z.date().nullable(),
  sourceModule: z.string().trim(),
  ipAddress: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<AuditLogFormValues>

export const auditLogDefaultValues: AuditLogFormValues = {
  _id: '',
  entityType: '',
  entityId: '',
  action: '',
  fieldName: '',
  oldValue: '',
  newValue: '',
  changedBy: '',
  timestamp: null,
  sourceModule: '',
  ipAddress: '',
  active: true,
}

export function createAuditLogFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<AuditLogFormValues> {
  void referenceOptions
  return {
    schema: auditLogFormSchema,
    defaultValues: auditLogDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'entityType',
      label: 'entity Type',
      type: 'text',
      placeholder: 'entity Type',
    },
    {
      name: 'entityId',
      label: 'entity ID',
      type: 'text',
      placeholder: 'entity ID',
    },
    {
      name: 'action',
      label: 'action',
      type: 'text',
      placeholder: 'action',
    },
    {
      name: 'fieldName',
      label: 'field Name',
      type: 'text',
      placeholder: 'field Name',
    },
    {
      name: 'oldValue',
      label: 'old Value',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'newValue',
      label: 'new Value',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'changedBy',
      label: 'changed By',
      type: 'text',
      placeholder: 'changed By',
    },
    {
      name: 'timestamp',
      label: 'timestamp',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'sourceModule',
      label: 'source Module',
      type: 'text',
      placeholder: 'source Module',
    },
    {
      name: 'ipAddress',
      label: 'ip Address',
      type: 'text',
      placeholder: 'ip Address',
    },
    {
      name: 'active',
      label: 'active',
      type: 'switch',
    },
    ],
  }
}


export function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function optionalNumber(value: number | null) {
  return typeof value === 'number' ? value : undefined
}

export function optionalDate(value: Date | null) {
  return value ?? undefined
}

export function toFormDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

export function formatDate(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatBoolean(value?: boolean) {
  return value ? 'Yes' : 'No'
}

export function formatNumber(value?: number | null) {
  return typeof value === 'number' ? String(value) : '-'
}

export function parseStringList(value: string) {
  const values = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return values.length ? values : undefined
}

export function formatStringList(value: string[] = []) {
  return value.join('\n')
}

export function formatMixed(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function mapAuditLogToFormValues(item: AuditLog): AuditLogFormValues {
  return {
    _id: item._id,
    entityType: item.entityType ?? '',
    entityId: item.entityId ?? '',
    action: item.action ?? '',
    fieldName: item.fieldName ?? '',
    oldValue: formatMixed(item.oldValue),
    newValue: formatMixed(item.newValue),
    changedBy: item.changedBy ?? '',
    timestamp: toFormDate(item.timestamp),
    sourceModule: item.sourceModule ?? '',
    ipAddress: item.ipAddress ?? '',
    active: item.active,
  }
}

export function mapAuditLogFormToPayload(values: AuditLogFormValues): AuditLogCreatePayload {
  return {
    entityType: optionalText(values.entityType),
    entityId: optionalText(values.entityId),
    action: optionalText(values.action),
    fieldName: optionalText(values.fieldName),
    oldValue: optionalText(values.oldValue),
    newValue: optionalText(values.newValue),
    changedBy: optionalText(values.changedBy),
    timestamp: optionalDate(values.timestamp),
    sourceModule: optionalText(values.sourceModule),
    ipAddress: optionalText(values.ipAddress),
    active: values.active,
  }
}

function getAuditLogLabel(item: AuditLog, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.entityType, item.action, formatDate(item.timestamp)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createAuditLogTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<AuditLog>> {
  return [
    {
      key: 'record',
      header: 'Audit Log',
      sortField: 'entityType',
      exportValue: (item) => getAuditLogLabel(item, referenceOptions),
      render: (item) => getAuditLogLabel(item, referenceOptions),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortField: 'updated',
      field: 'updatedAt',
      exportValue: (item) => formatDate(item.updatedAt),
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: 'Updated date',
      },
      render: (item) => formatDate(item.updatedAt),
    },
  ]
}

function renderSection(items: Array<[string, string]>) {
  return (
    <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
        >
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            {label}
          </dt>
          <dd className="whitespace-pre-line break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">
            {value || '-'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function renderAuditLogDetails(item: AuditLog, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Audit Log</h3>
        {renderSection([
          ['audit ID', item.auditId],
          ['entity Type', item.entityType ?? '-'],
          ['entity ID', item.entityId ?? '-'],
          ['action', item.action ?? '-'],
          ['field Name', item.fieldName ?? '-'],
          ['old Value', formatMixed(item.oldValue)],
          ['new Value', formatMixed(item.newValue)],
          ['changed By', item.changedBy ?? '-'],
          ['timestamp', formatDate(item.timestamp)],
          ['source Module', item.sourceModule ?? '-'],
          ['ip Address', item.ipAddress ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderAuditLogGridItem(item: AuditLog, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getAuditLogLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">action</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.action ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
