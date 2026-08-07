import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PatientBilling, PatientBillingCreatePayload, PatientBillingFormValues } from '@/types/patientBilling'

export const patientBillingApiDetails = {
  endpoint: '/rcm/patient-billings',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const patientBillingFormSchema = z.object({
  _id: z.string().optional(),
  patientId: z.string().trim(),
  claimId: z.string().trim(),
  paymentPostingId: z.string().trim(),
  statementNumber: z.string().trim(),
  statementDate: z.date().nullable(),
  statementCycle: z.string().trim(),
  billingCycle: z.string().trim(),
  originalBalance: z.number().nullable(),
  currentBalance: z.number().nullable(),
  insurancePaid: z.number().nullable(),
  adjustments: z.number().nullable(),
  patientPayments: z.number().nullable(),
  patientBalance: z.number().nullable(),
  amountPaid: z.number().nullable(),
  amountDue: z.number().nullable(),
  dueDate: z.date().nullable(),
  lastStatementSent: z.date().nullable(),
  collectionsFlag: z.boolean(),
  writeOffFlag: z.boolean(),
  refundFlag: z.boolean(),
  refundAmount: z.number().nullable(),
  creditBalanceAmount: z.number().nullable(),
  paymentPlanId: z.string().trim(),
  statementStatus: z.string().trim(),
  status: z.string().trim(),
  agingBucket: z.string().trim(),
  lineItems: z.array(z.any()),
  active: z.boolean(),
}) as z.ZodType<PatientBillingFormValues>

export const patientBillingDefaultValues: PatientBillingFormValues = {
  _id: '',
  patientId: '',
  claimId: '',
  paymentPostingId: '',
  statementNumber: '',
  statementDate: null,
  statementCycle: '',
  billingCycle: '',
  originalBalance: null,
  currentBalance: null,
  insurancePaid: null,
  adjustments: null,
  patientPayments: null,
  patientBalance: null,
  amountPaid: null,
  amountDue: null,
  dueDate: null,
  lastStatementSent: null,
  collectionsFlag: false,
  writeOffFlag: false,
  refundFlag: false,
  refundAmount: null,
  creditBalanceAmount: null,
  paymentPlanId: '',
  statementStatus: '',
  status: '',
  agingBucket: '',
  lineItems: [],
  active: true,
}

export function createPatientBillingFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<PatientBillingFormValues> {
  void referenceOptions
  return {
    schema: patientBillingFormSchema,
    defaultValues: patientBillingDefaultValues,
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
      name: 'statementDate',
      label: 'statement Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'statementCycle',
      label: 'statement Cycle',
      type: 'text',
      placeholder: 'statement Cycle',
    },
    {
      name: 'patientBalance',
      label: 'patient Balance',
      type: 'number',
    },
    {
      name: 'amountPaid',
      label: 'amount Paid',
      type: 'number',
    },
    {
      name: 'amountDue',
      label: 'amount Due',
      type: 'number',
    },
    {
      name: 'dueDate',
      label: 'due Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'lastStatementSent',
      label: 'last Statement Sent',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'collectionsFlag',
      label: 'collections Flag',
      type: 'switch',
    },
    {
      name: 'writeOffFlag',
      label: 'write Off Flag',
      type: 'switch',
    },
    {
      name: 'refundFlag',
      label: 'refund Flag',
      type: 'switch',
    },
    {
      name: 'refundAmount',
      label: 'refund Amount',
      type: 'number',
    },
    {
      name: 'creditBalanceAmount',
      label: 'credit Balance Amount',
      type: 'number',
    },
    {
      name: 'paymentPlanId',
      label: 'payment Plan ID',
      type: 'text',
      placeholder: 'payment Plan ID',
    },
    {
      name: 'statementStatus',
      label: 'statement Status',
      type: 'text',
      placeholder: 'statement Status',
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

export function mapPatientBillingToFormValues(item: PatientBilling): PatientBillingFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    claimId: item.claimId ?? '',
    paymentPostingId: item.paymentPostingId ?? '',
    statementNumber: item.statementNumber ?? '',
    statementDate: toFormDate(item.statementDate),
    statementCycle: item.statementCycle ?? '',
    billingCycle: item.billingCycle ?? '',
    originalBalance: item.originalBalance ?? null,
    currentBalance: item.currentBalance ?? null,
    insurancePaid: item.insurancePaid ?? null,
    adjustments: item.adjustments ?? null,
    patientPayments: item.patientPayments ?? null,
    patientBalance: item.patientBalance ?? null,
    amountPaid: item.amountPaid ?? null,
    amountDue: item.amountDue ?? null,
    dueDate: toFormDate(item.dueDate),
    lastStatementSent: toFormDate(item.lastStatementSent),
    collectionsFlag: item.collectionsFlag,
    writeOffFlag: item.writeOffFlag,
    refundFlag: item.refundFlag,
    refundAmount: item.refundAmount ?? null,
    creditBalanceAmount: item.creditBalanceAmount ?? null,
    paymentPlanId: item.paymentPlanId ?? '',
    statementStatus: item.statementStatus ?? '',
    status: item.status ?? '',
    agingBucket: item.agingBucket ?? '',
    lineItems: item.lineItems ?? [],
    active: item.active,
  }
}

export function mapPatientBillingFormToPayload(values: PatientBillingFormValues): PatientBillingCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    claimId: optionalText(values.claimId),
    paymentPostingId: optionalText(values.paymentPostingId),
    statementNumber: optionalText(values.statementNumber),
    statementDate: optionalDate(values.statementDate),
    statementCycle: optionalText(values.statementCycle),
    billingCycle: optionalText(values.billingCycle),
    originalBalance: optionalNumber(values.originalBalance),
    currentBalance: optionalNumber(values.currentBalance),
    insurancePaid: optionalNumber(values.insurancePaid),
    adjustments: optionalNumber(values.adjustments),
    patientPayments: optionalNumber(values.patientPayments),
    patientBalance: optionalNumber(values.patientBalance),
    amountPaid: optionalNumber(values.amountPaid),
    amountDue: optionalNumber(values.amountDue),
    dueDate: optionalDate(values.dueDate),
    lastStatementSent: optionalDate(values.lastStatementSent),
    collectionsFlag: values.collectionsFlag,
    writeOffFlag: values.writeOffFlag,
    refundFlag: values.refundFlag,
    refundAmount: optionalNumber(values.refundAmount),
    creditBalanceAmount: optionalNumber(values.creditBalanceAmount),
    paymentPlanId: optionalText(values.paymentPlanId),
    statementStatus: optionalText(values.statementStatus),
    status: optionalText(values.status),
    agingBucket: optionalText(values.agingBucket),
    lineItems: values.lineItems,
    active: values.active,
  }
}

function getPatientBillingLabel(item: PatientBilling, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.statementNumber, formatDate(item.statementDate), item.status ?? item.statementStatus, formatNumber(item.currentBalance ?? item.amountDue)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createPatientBillingTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<PatientBilling>> {
  return [
    {
      key: 'record',
      header: 'Patient Billing',
      sortField: 'statementDate',
      exportValue: (item) => getPatientBillingLabel(item, referenceOptions),
      render: (item) => getPatientBillingLabel(item, referenceOptions),
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
      key: 'status',
      header: 'Status',
      filterable: true,
      field: 'status',
      sortField: 'status',
      exportValue: (item) => item.status ?? item.statementStatus ?? '-',
      render: (item) => item.status ?? item.statementStatus ?? '-',
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

export function renderPatientBillingDetails(item: PatientBilling, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Patient Billing</h3>
        {renderSection([
          ['patient Billing ID', item.patientBillingId],
          ['statement Number', item.statementNumber ?? '-'],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['payment Posting ID', item.paymentPostingId ?? '-'],
          ['statement Date', formatDate(item.statementDate)],
          ['statement Cycle', item.statementCycle ?? '-'],
          ['billing Cycle', item.billingCycle ?? '-'],
          ['original Balance', formatNumber(item.originalBalance)],
          ['current Balance', formatNumber(item.currentBalance)],
          ['insurance Paid', formatNumber(item.insurancePaid)],
          ['adjustments', formatNumber(item.adjustments)],
          ['patient Payments', formatNumber(item.patientPayments)],
          ['patient Balance', formatNumber(item.patientBalance)],
          ['amount Paid', formatNumber(item.amountPaid)],
          ['amount Due', formatNumber(item.amountDue)],
          ['due Date', formatDate(item.dueDate)],
          ['last Statement Sent', formatDate(item.lastStatementSent)],
          ['collections Flag', formatBoolean(item.collectionsFlag)],
          ['write Off Flag', formatBoolean(item.writeOffFlag)],
          ['refund Flag', formatBoolean(item.refundFlag)],
          ['refund Amount', formatNumber(item.refundAmount)],
          ['credit Balance Amount', formatNumber(item.creditBalanceAmount)],
          ['payment Plan ID', item.paymentPlanId ?? '-'],
          ['status', item.status ?? item.statementStatus ?? '-'],
          ['aging Bucket', item.agingBucket ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderPatientBillingGridItem(item: PatientBilling, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getPatientBillingLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">statement Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.statementStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
