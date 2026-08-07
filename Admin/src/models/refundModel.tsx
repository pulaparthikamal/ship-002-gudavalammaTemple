import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Refund, RefundCreatePayload, RefundFormValues } from '@/types/refund'

export const refundApiDetails = {
  endpoint: '/rcm/refunds',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const refundFormSchema = z.object({
  _id: z.string().optional(),
  patientId: z.string().trim(),
  claimId: z.string().trim(),
  patientBillingId: z.string().trim(),
  patientPaymentId: z.string().trim(),
  refundType: z.string().trim(),
  refundReason: z.string().trim().min(1, 'Refund reason is required.'),
  refundAmount: z.number().positive('Refund amount must be greater than zero.').nullable().refine((value) => value !== null, {
    message: 'Refund amount is required.',
  }),
  refundMethod: z.string().trim(),
  requestedDate: z.date().nullable(),
  approvedDate: z.date().nullable(),
  processedDate: z.date().nullable(),
  refundStatus: z.string().trim(),
  approvedBy: z.string().trim(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<RefundFormValues>

export const refundDefaultValues: RefundFormValues = {
  _id: '',
  patientId: '',
  claimId: '',
  patientBillingId: '',
  patientPaymentId: '',
  refundType: '',
  refundReason: '',
  refundAmount: null,
  refundMethod: '',
  requestedDate: null,
  approvedDate: null,
  processedDate: null,
  refundStatus: '',
  approvedBy: '',
  notes: '',
  active: true,
}

export function createRefundFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<RefundFormValues> {
  void referenceOptions
  return {
    schema: refundFormSchema,
    defaultValues: refundDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'patientId',
      label: 'patient ID',
      type: 'autocomplete',
      placeholder: 'patient ID',
      options: referenceOptions.patients ?? [],
    },
    {
      name: 'claimId',
      label: 'claim ID',
      type: 'autocomplete',
      placeholder: 'claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'refundType',
      label: 'refund Type',
      type: 'text',
      placeholder: 'refund Type',
    },
    {
      name: 'refundReason',
      label: 'refund Reason',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'refundAmount',
      label: 'refund Amount',
      type: 'number',
    },
    {
      name: 'refundMethod',
      label: 'refund Method',
      type: 'text',
      placeholder: 'refund Method',
    },
    {
      name: 'requestedDate',
      label: 'requested Date',
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

export function mapRefundToFormValues(item: Refund): RefundFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    claimId: item.claimId ?? '',
    patientBillingId: item.patientBillingId ?? '',
    patientPaymentId: item.patientPaymentId ?? '',
    refundType: item.refundType ?? '',
    refundReason: item.refundReason ?? '',
    refundAmount: item.refundAmount ?? null,
    refundMethod: item.refundMethod ?? '',
    requestedDate: toFormDate(item.requestedDate),
    approvedDate: toFormDate(item.approvedDate),
    processedDate: toFormDate(item.processedDate),
    refundStatus: item.refundStatus ?? '',
    approvedBy: item.approvedBy ?? '',
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapRefundFormToPayload(values: RefundFormValues): RefundCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    claimId: optionalText(values.claimId),
    patientBillingId: optionalText(values.patientBillingId),
    patientPaymentId: optionalText(values.patientPaymentId),
    refundType: optionalText(values.refundType),
    refundReason: optionalText(values.refundReason),
    refundAmount: optionalNumber(values.refundAmount),
    refundMethod: optionalText(values.refundMethod),
    requestedDate: optionalDate(values.requestedDate),
    approvedDate: optionalDate(values.approvedDate),
    processedDate: optionalDate(values.processedDate),
    refundStatus: optionalText(values.refundStatus),
    approvedBy: optionalText(values.approvedBy),
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getRefundLabel(item: Refund, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.refundType, item.refundStatus, formatNumber(item.refundAmount)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createRefundTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Refund>> {
  return [
    {
      key: 'record',
      header: 'Refund',
      sortField: 'refundType',
      exportValue: (item) => getRefundLabel(item, referenceOptions),
      render: (item) => getRefundLabel(item, referenceOptions),
    },
    {
      key: 'patientId',
      header: 'Patient',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.patients, item.patientId),
      render: (item) => formatReferenceLabel(referenceOptions.patients, item.patientId),
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
      key: 'refundStatus',
      header: 'Refund Status',
      filterable: true,
      field: 'refundStatus',
      sortField: 'refundStatus',
      exportValue: (item) => item.refundStatus ?? '-',
      render: (item) => item.refundStatus ?? '-',
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

export function renderRefundDetails(item: Refund, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Refund</h3>
        {renderSection([
          ['refund ID', item.refundId],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['patient Billing ID', formatReferenceLabel(referenceOptions.patientBillings, item.patientBillingId)],
          ['patient Payment ID', item.patientPaymentId ?? '-'],
          ['refund Type', item.refundType ?? '-'],
          ['refund Reason', item.refundReason ?? '-'],
          ['refund Amount', formatNumber(item.refundAmount)],
          ['refund Method', item.refundMethod ?? '-'],
          ['requested Date', formatDate(item.requestedDate)],
          ['approved Date', formatDate(item.approvedDate)],
          ['processed Date', formatDate(item.processedDate)],
          ['refund Status', item.refundStatus ?? '-'],
          ['approved By', item.approvedBy ?? '-'],
          ['notes', item.notes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderRefundGridItem(item: Refund, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getRefundLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">refund Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.refundStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
