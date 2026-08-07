import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Adjustment, AdjustmentCreatePayload, AdjustmentFormValues } from '@/types/adjustment'

export const adjustmentApiDetails = {
  endpoint: '/rcm/adjustments',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const adjustmentFormSchema = z.object({
  _id: z.string().optional(),
  claimId: z.string().trim(),
  claimLineId: z.string().trim(),
  adjustmentType: z.string().trim(),
  adjustmentGroupCode: z.string().trim(),
  adjustmentReasonCode: z.string().trim(),
  adjustmentAmount: z.number().nullable(),
  writeOffFlag: z.boolean(),
  approvedBy: z.string().trim(),
  adjustmentDate: z.date().nullable(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<AdjustmentFormValues>

export const adjustmentDefaultValues: AdjustmentFormValues = {
  _id: '',
  claimId: '',
  claimLineId: '',
  adjustmentType: '',
  adjustmentGroupCode: '',
  adjustmentReasonCode: '',
  adjustmentAmount: null,
  writeOffFlag: false,
  approvedBy: '',
  adjustmentDate: null,
  notes: '',
  active: true,
}

export function createAdjustmentFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<AdjustmentFormValues> {
  void referenceOptions
  return {
    schema: adjustmentFormSchema,
    defaultValues: adjustmentDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'claimId',
      label: 'claim ID',
      type: 'autocomplete',
      placeholder: 'claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'claimLineId',
      label: 'claim Line ID',
      type: 'text',
      placeholder: 'claim Line ID',
    },
    {
      name: 'adjustmentType',
      label: 'adjustment Type',
      type: 'text',
      placeholder: 'adjustment Type',
    },
    {
      name: 'adjustmentGroupCode',
      label: 'adjustment Group Code',
      type: 'text',
      placeholder: 'adjustment Group Code',
    },
    {
      name: 'adjustmentReasonCode',
      label: 'adjustment Reason Code',
      type: 'text',
      placeholder: 'adjustment Reason Code',
    },
    {
      name: 'adjustmentAmount',
      label: 'adjustment Amount',
      type: 'number',
    },
    {
      name: 'writeOffFlag',
      label: 'write Off Flag',
      type: 'switch',
    },
    {
      name: 'approvedBy',
      label: 'approved By',
      type: 'text',
      placeholder: 'approved By',
    },
    {
      name: 'adjustmentDate',
      label: 'adjustment Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'notes',
      label: 'notes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
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

export function mapAdjustmentToFormValues(item: Adjustment): AdjustmentFormValues {
  return {
    _id: item._id,
    claimId: item.claimId ?? '',
    claimLineId: item.claimLineId ?? '',
    adjustmentType: item.adjustmentType ?? '',
    adjustmentGroupCode: item.adjustmentGroupCode ?? '',
    adjustmentReasonCode: item.adjustmentReasonCode ?? '',
    adjustmentAmount: item.adjustmentAmount ?? null,
    writeOffFlag: item.writeOffFlag,
    approvedBy: item.approvedBy ?? '',
    adjustmentDate: toFormDate(item.adjustmentDate),
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapAdjustmentFormToPayload(values: AdjustmentFormValues): AdjustmentCreatePayload {
  return {
    claimId: optionalText(values.claimId),
    claimLineId: optionalText(values.claimLineId),
    adjustmentType: optionalText(values.adjustmentType),
    adjustmentGroupCode: optionalText(values.adjustmentGroupCode),
    adjustmentReasonCode: optionalText(values.adjustmentReasonCode),
    adjustmentAmount: optionalNumber(values.adjustmentAmount),
    writeOffFlag: values.writeOffFlag,
    approvedBy: optionalText(values.approvedBy),
    adjustmentDate: optionalDate(values.adjustmentDate),
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getAdjustmentLabel(item: Adjustment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [formatDate(item.adjustmentDate), item.adjustmentType, formatNumber(item.adjustmentAmount)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createAdjustmentTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Adjustment>> {
  return [
    {
      key: 'record',
      header: 'Adjustment',
      sortField: 'adjustmentDate',
      exportValue: (item) => getAdjustmentLabel(item, referenceOptions),
      render: (item) => getAdjustmentLabel(item, referenceOptions),
    },
    {
      key: 'claimId',
      header: 'Claim',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.claims, item.claimId),
      render: (item) => formatReferenceLabel(referenceOptions.claims, item.claimId),
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

export function renderAdjustmentDetails(item: Adjustment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Adjustment</h3>
        {renderSection([
          ['adjustment ID', item.adjustmentId],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['claim Line ID', item.claimLineId ?? '-'],
          ['adjustment Type', item.adjustmentType ?? '-'],
          ['adjustment Group Code', item.adjustmentGroupCode ?? '-'],
          ['adjustment Reason Code', item.adjustmentReasonCode ?? '-'],
          ['adjustment Amount', formatNumber(item.adjustmentAmount)],
          ['write Off Flag', formatBoolean(item.writeOffFlag)],
          ['approved By', item.approvedBy ?? '-'],
          ['adjustment Date', formatDate(item.adjustmentDate)],
          ['notes', item.notes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderAdjustmentGridItem(item: Adjustment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getAdjustmentLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">adjustment Type</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.adjustmentType ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
