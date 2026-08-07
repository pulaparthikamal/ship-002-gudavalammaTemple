import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PatientPayment, PatientPaymentCreatePayload, PatientPaymentFormValues } from '@/types/patientPayment'

export const patientPaymentApiDetails = {
  endpoint: '/rcm/patient-payments',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const patientPaymentFormSchema = z.object({
  _id: z.string().optional(),
  patientId: z.string().trim(),
  patientBillingId: z.string().trim(),
  claimId: z.string().trim(),
  claimLineId: z.string().trim(),
  paymentDate: z.date().nullable(),
  paymentMethod: z.string().trim(),
  amount: z.number().nullable(),
  appliedAmount: z.number().nullable(),
  overpaymentAmount: z.number().nullable(),
  referenceNumber: z.string().trim(),
  receiptNumber: z.string().trim(),
  paymentStatus: z.string().trim(),
  collectedAtFrontDesk: z.boolean(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<PatientPaymentFormValues>

export const patientPaymentDefaultValues: PatientPaymentFormValues = {
  _id: '',
  patientId: '',
  patientBillingId: '',
  claimId: '',
  claimLineId: '',
  paymentDate: null,
  paymentMethod: '',
  amount: null,
  appliedAmount: null,
  overpaymentAmount: null,
  referenceNumber: '',
  receiptNumber: '',
  paymentStatus: '',
  collectedAtFrontDesk: false,
  notes: '',
  active: true,
}

const paymentMethodOptions = [
  { label: 'Cash', value: 'CASH' },
  { label: 'Card', value: 'CARD' },
  { label: 'ACH', value: 'ACH' },
  { label: 'Check', value: 'CHECK' },
  { label: 'Online', value: 'ONLINE' },
]

export function createPatientPaymentFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<PatientPaymentFormValues> {
  void referenceOptions
  return {
    schema: patientPaymentFormSchema,
    defaultValues: patientPaymentDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'patientId',
      label: 'Patient',
      type: 'autocomplete',
      placeholder: 'Select patient',
      options: referenceOptions.patients ?? [],
    },
    {
      name: 'patientBillingId',
      label: 'Patient billing',
      type: 'autocomplete',
      placeholder: 'Select patient billing',
      options: referenceOptions.patientBillings ?? [],
    },
    {
      name: 'paymentDate',
      label: 'Payment date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'paymentMethod',
      label: 'Payment method',
      type: 'select',
      placeholder: 'Select payment method',
      options: paymentMethodOptions,
    },
    {
      name: 'amount',
      label: 'Amount',
      type: 'number',
    },
    {
      name: 'referenceNumber',
      label: 'Reference number',
      type: 'text',
      placeholder: 'Reference number',
    },
    {
      name: 'paymentStatus',
      label: 'Payment status',
      type: 'text',
      placeholder: 'Payment status',
    },
    {
      name: 'collectedAtFrontDesk',
      label: 'Collected at front desk',
      type: 'switch',
    },
    {
      name: 'notes',
      label: 'Notes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'active',
      label: 'Active',
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

export function mapPatientPaymentToFormValues(item: PatientPayment): PatientPaymentFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    patientBillingId: item.patientBillingId ?? '',
    claimId: item.claimId ?? '',
    claimLineId: item.claimLineId ?? '',
    paymentDate: toFormDate(item.paymentDate),
    paymentMethod: item.paymentMethod ?? '',
    amount: item.amount ?? null,
    appliedAmount: item.appliedAmount ?? null,
    overpaymentAmount: item.overpaymentAmount ?? null,
    referenceNumber: item.referenceNumber ?? '',
    receiptNumber: item.receiptNumber ?? '',
    paymentStatus: item.paymentStatus ?? '',
    collectedAtFrontDesk: item.collectedAtFrontDesk,
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapPatientPaymentFormToPayload(values: PatientPaymentFormValues): PatientPaymentCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    patientBillingId: optionalText(values.patientBillingId),
    claimId: optionalText(values.claimId),
    claimLineId: optionalText(values.claimLineId),
    paymentDate: optionalDate(values.paymentDate),
    paymentMethod: optionalText(values.paymentMethod),
    amount: optionalNumber(values.amount),
    appliedAmount: optionalNumber(values.appliedAmount),
    overpaymentAmount: optionalNumber(values.overpaymentAmount),
    referenceNumber: optionalText(values.referenceNumber),
    receiptNumber: optionalText(values.receiptNumber),
    paymentStatus: optionalText(values.paymentStatus),
    collectedAtFrontDesk: values.collectedAtFrontDesk,
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getPatientPaymentLabel(item: PatientPayment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.receiptNumber, formatDate(item.paymentDate), item.paymentStatus, formatNumber(item.appliedAmount ?? item.amount)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createPatientPaymentTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<PatientPayment>> {
  return [
    {
      key: 'record',
      header: 'Patient Payment',
      sortField: 'paymentDate',
      exportValue: (item) => getPatientPaymentLabel(item, referenceOptions),
      render: (item) => getPatientPaymentLabel(item, referenceOptions),
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
      key: 'paymentStatus',
      header: 'Payment Status',
      filterable: true,
      field: 'paymentStatus',
      sortField: 'paymentStatus',
      exportValue: (item) => item.paymentStatus ?? '-',
      render: (item) => item.paymentStatus ?? '-',
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

export function renderPatientPaymentDetails(item: PatientPayment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Patient payment</h3>
        {renderSection([
          ['Patient payment ID', item.patientPaymentId],
          ['Patient', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['Patient billing', formatReferenceLabel(referenceOptions.patientBillings, item.patientBillingId)],
          ['Claim', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['Claim line', item.claimLineId ?? '-'],
          ['Payment date', formatDate(item.paymentDate)],
          ['Payment method', item.paymentMethod ?? '-'],
          ['Amount', formatNumber(item.amount)],
          ['Applied amount', formatNumber(item.appliedAmount)],
          ['Overpayment amount', formatNumber(item.overpaymentAmount)],
          ['Reference number', item.referenceNumber ?? '-'],
          ['Receipt number', item.receiptNumber ?? '-'],
          ['Payment status', item.paymentStatus ?? '-'],
          ['Collected at front desk', formatBoolean(item.collectedAtFrontDesk)],
          ['Notes', item.notes ?? '-'],
          ['Active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderPatientPaymentGridItem(item: PatientPayment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getPatientPaymentLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Payment status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.paymentStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
