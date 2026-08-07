import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PaymentPosting, PaymentPostingCreatePayload, PaymentPostingFormValues, PaymentPostingPaymentLine, PaymentPostingPaymentLineFormValues } from '@/types/paymentPosting'

export const paymentPostingApiDetails = {
  endpoint: '/rcm/payment-postings',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const paymentPostingPaymentLinesFormSchema = z.object({
  claimLineId: z.string().trim(),
  serviceLineControlNumber: z.string().trim(),
  procedureCode: z.string().trim(),
  serviceDate: z.date().nullable(),
  billedAmount: z.number().nullable(),
  paidAmount: z.number().nullable(),
  allowedAmount: z.number().nullable(),
  adjustmentAmount: z.number().nullable(),
  patientRespAmount: z.number().nullable(),
  deniedAmount: z.number().nullable(),
  adjustmentCodes: z.string().trim(),
  remarkCodes: z.string().trim(),
})

export const paymentPostingFormSchema = z.object({
  _id: z.string().optional(),
  eraEobProcessingId: z.string().trim(),
  claimId: z.string().trim(),
  payerId: z.string().trim(),
  payerClaimNumber: z.string().trim(),
  claimControlNumber: z.string().trim(),
  paymentDate: z.date().nullable(),
  checkNumber: z.string().trim(),
  eftTraceNumber: z.string().trim(),
  paymentMethod: z.string().trim(),
  receivedAmount: z.number().nullable(),
  postedAmount: z.number().nullable(),
  patientResponsibilityAmount: z.number().nullable(),
  remainingBalance: z.number().nullable(),
  postingStatus: z.string().trim(),
  postedBy: z.string().trim(),
  postedAt: z.date().nullable(),
  paymentLines: z.array(paymentPostingPaymentLinesFormSchema).length(2),
  active: z.boolean(),
}) as z.ZodType<PaymentPostingFormValues>

function createEmptyPaymentPostingPaymentLine(): PaymentPostingPaymentLineFormValues {
  return {
    claimLineId: '',
    serviceLineControlNumber: '',
    procedureCode: '',
    serviceDate: null,
    billedAmount: null,
    paidAmount: null,
    allowedAmount: null,
    adjustmentAmount: null,
    patientRespAmount: null,
    deniedAmount: null,
    adjustmentCodes: '',
    remarkCodes: '',
  }
}

export const paymentPostingDefaultValues: PaymentPostingFormValues = {
  _id: '',
  eraEobProcessingId: '',
  claimId: '',
  payerId: '',
  payerClaimNumber: '',
  claimControlNumber: '',
  paymentDate: null,
  checkNumber: '',
  eftTraceNumber: '',
  paymentMethod: '',
  receivedAmount: null,
  postedAmount: null,
  patientResponsibilityAmount: null,
  remainingBalance: null,
  postingStatus: '',
  postedBy: '',
  postedAt: null,
  paymentLines: [createEmptyPaymentPostingPaymentLine(), createEmptyPaymentPostingPaymentLine()],
  active: true,
}

export function createPaymentPostingFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<PaymentPostingFormValues> {
  void referenceOptions
  return {
    schema: paymentPostingFormSchema,
    defaultValues: paymentPostingDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'eraEobProcessingId',
      label: 'ERA processing ID',
      type: 'text',
      placeholder: 'ERA processing ID',
    },
    {
      name: 'claimId',
      label: 'claim ID',
      type: 'autocomplete',
      placeholder: 'claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'payerId',
      label: 'payer ID',
      type: 'autocomplete',
      placeholder: 'payer ID',
      options: referenceOptions.payers ?? [],
    },
    {
      name: 'payerClaimNumber',
      label: 'Payer claim number',
      type: 'text',
      placeholder: 'Payer claim number',
    },
    {
      name: 'claimControlNumber',
      label: 'Claim control number',
      type: 'text',
      placeholder: 'Claim control number',
    },
    {
      name: 'paymentDate',
      label: 'payment Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'checkNumber',
      label: 'check Number',
      type: 'text',
      placeholder: 'check Number',
    },
    {
      name: 'eftTraceNumber',
      label: 'EFT trace number',
      type: 'text',
      placeholder: 'EFT trace number',
    },
    {
      name: 'paymentMethod',
      label: 'payment Method',
      type: 'text',
      placeholder: 'payment Method',
    },
    {
      name: 'receivedAmount',
      label: 'received Amount',
      type: 'number',
    },
    {
      name: 'postedAmount',
      label: 'posted Amount',
      type: 'number',
    },
    {
      name: 'patientResponsibilityAmount',
      label: 'patient Responsibility Amount',
      type: 'number',
    },
    {
      name: 'remainingBalance',
      label: 'remaining Balance',
      type: 'number',
    },
    {
      name: 'postingStatus',
      label: 'posting Status',
      type: 'text',
      placeholder: 'posting Status',
    },
    {
      name: 'postedBy',
      label: 'posted By',
      type: 'text',
      placeholder: 'posted By',
    },
    {
      name: 'postedAt',
      label: 'posted At',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'paymentLines.0.claimLineId',
      label: 'payment Lines 0 claim Line ID',
      type: 'text',
      placeholder: 'payment Lines 0 claim Line ID',
    },
    {
      name: 'paymentLines.0.paidAmount',
      label: 'payment Lines 0 paid Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.0.allowedAmount',
      label: 'payment Lines 0 allowed Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.0.adjustmentAmount',
      label: 'payment Lines 0 adjustment Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.0.patientRespAmount',
      label: 'payment Lines 0 patient Resp Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.0.deniedAmount',
      label: 'payment Lines 0 denied Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.0.adjustmentCodes',
      label: 'payment Lines 0 adjustment Codes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'paymentLines.0.remarkCodes',
      label: 'payment Lines 0 remark Codes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'paymentLines.1.claimLineId',
      label: 'payment Lines 1 claim Line ID',
      type: 'text',
      placeholder: 'payment Lines 1 claim Line ID',
    },
    {
      name: 'paymentLines.1.paidAmount',
      label: 'payment Lines 1 paid Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.1.allowedAmount',
      label: 'payment Lines 1 allowed Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.1.adjustmentAmount',
      label: 'payment Lines 1 adjustment Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.1.patientRespAmount',
      label: 'payment Lines 1 patient Resp Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.1.deniedAmount',
      label: 'payment Lines 1 denied Amount',
      type: 'number',
    },
    {
      name: 'paymentLines.1.adjustmentCodes',
      label: 'payment Lines 1 adjustment Codes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'paymentLines.1.remarkCodes',
      label: 'payment Lines 1 remark Codes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
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

function buildPaymentPostingPaymentLines(paymentLines: PaymentPostingPaymentLine[] = []): PaymentPostingPaymentLineFormValues[] {
  return Array.from({ length: Math.max(paymentLines.length, 2) }, (_, index) => {
    const item = paymentLines[index] ?? {}

    return {
      claimLineId: item.claimLineId ?? '',
      serviceLineControlNumber: item.serviceLineControlNumber ?? '',
      procedureCode: item.procedureCode ?? '',
      serviceDate: toFormDate(item.serviceDate),
      billedAmount: item.billedAmount ?? null,
      paidAmount: item.paidAmount ?? null,
      allowedAmount: item.allowedAmount ?? null,
      adjustmentAmount: item.adjustmentAmount ?? null,
      patientRespAmount: item.patientRespAmount ?? null,
      deniedAmount: item.deniedAmount ?? null,
      adjustmentCodes: formatStringList(item.adjustmentCodes),
      remarkCodes: formatStringList(item.remarkCodes),
    }
  })
}

function isPaymentPostingPaymentLineEmpty(item: PaymentPostingPaymentLineFormValues) {
  return !item.claimLineId.trim() && !item.serviceLineControlNumber.trim() && !item.procedureCode.trim() && item.serviceDate === null && item.billedAmount === null && item.paidAmount === null && item.allowedAmount === null && item.adjustmentAmount === null && item.patientRespAmount === null && item.deniedAmount === null && !item.adjustmentCodes.trim() && !item.remarkCodes.trim()
}

function compactPaymentPostingPaymentLines(paymentLines: PaymentPostingPaymentLineFormValues[]): PaymentPostingPaymentLine[] | undefined {
  const nextItems = paymentLines
    .filter((item) => !isPaymentPostingPaymentLineEmpty(item))
    .map((item) => ({
      claimLineId: optionalText(item.claimLineId),
      serviceLineControlNumber: optionalText(item.serviceLineControlNumber),
      procedureCode: optionalText(item.procedureCode),
      serviceDate: optionalDate(item.serviceDate),
      billedAmount: optionalNumber(item.billedAmount),
      paidAmount: optionalNumber(item.paidAmount),
      allowedAmount: optionalNumber(item.allowedAmount),
      adjustmentAmount: optionalNumber(item.adjustmentAmount),
      patientRespAmount: optionalNumber(item.patientRespAmount),
      deniedAmount: optionalNumber(item.deniedAmount),
      adjustmentCodes: parseStringList(item.adjustmentCodes),
      remarkCodes: parseStringList(item.remarkCodes),
    }))

  return nextItems.length ? nextItems : undefined
}

export function mapPaymentPostingToFormValues(item: PaymentPosting): PaymentPostingFormValues {
  return {
    _id: item._id,
    eraEobProcessingId: item.eraEobProcessingId ?? '',
    claimId: item.claimId ?? '',
    payerId: item.payerId ?? '',
    payerClaimNumber: item.payerClaimNumber ?? '',
    claimControlNumber: item.claimControlNumber ?? '',
    paymentDate: toFormDate(item.paymentDate),
    checkNumber: item.checkNumber ?? '',
    eftTraceNumber: item.eftTraceNumber ?? '',
    paymentMethod: item.paymentMethod ?? '',
    receivedAmount: item.receivedAmount ?? null,
    postedAmount: item.postedAmount ?? null,
    patientResponsibilityAmount: item.patientResponsibilityAmount ?? null,
    remainingBalance: item.remainingBalance ?? null,
    postingStatus: item.postingStatus ?? '',
    postedBy: item.postedBy ?? '',
    postedAt: toFormDate(item.postedAt),
    paymentLines: buildPaymentPostingPaymentLines(item.paymentLines),
    active: item.active,
  }
}

export function mapPaymentPostingFormToPayload(values: PaymentPostingFormValues): PaymentPostingCreatePayload {
  return {
    eraEobProcessingId: optionalText(values.eraEobProcessingId),
    claimId: optionalText(values.claimId),
    payerId: optionalText(values.payerId),
    payerClaimNumber: optionalText(values.payerClaimNumber),
    claimControlNumber: optionalText(values.claimControlNumber),
    paymentDate: optionalDate(values.paymentDate),
    checkNumber: optionalText(values.checkNumber),
    eftTraceNumber: optionalText(values.eftTraceNumber),
    paymentMethod: optionalText(values.paymentMethod),
    receivedAmount: optionalNumber(values.receivedAmount),
    postedAmount: optionalNumber(values.postedAmount),
    patientResponsibilityAmount: optionalNumber(values.patientResponsibilityAmount),
    remainingBalance: optionalNumber(values.remainingBalance),
    postingStatus: optionalText(values.postingStatus),
    postedBy: optionalText(values.postedBy),
    postedAt: optionalDate(values.postedAt),
    paymentLines: compactPaymentPostingPaymentLines(values.paymentLines),
    active: values.active,
  }
}

function getPaymentPostingLabel(item: PaymentPosting, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [formatDate(item.paymentDate), item.checkNumber, item.postingStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createPaymentPostingTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<PaymentPosting>> {
  return [
    {
      key: 'record',
      header: 'Payment Posting',
      sortField: 'paymentDate',
      exportValue: (item) => getPaymentPostingLabel(item, referenceOptions),
      render: (item) => getPaymentPostingLabel(item, referenceOptions),
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
      key: 'payerId',
      header: 'Payer',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
      render: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
    },
    {
      key: 'postingStatus',
      header: 'Posting Status',
      filterable: true,
      field: 'postingStatus',
      sortField: 'postingStatus',
      exportValue: (item) => item.postingStatus ?? '-',
      render: (item) => (
        <div className="flex flex-col gap-1">
          <span>{item.postingStatus ?? '-'}</span>
          {(item.eraEobProcessingId || item.sourceType) && (
            <span className="text-xs font-medium text-[var(--color-text-muted)]">
              {item.sourceType ?? '835_ERA'}
            </span>
          )}
        </div>
      ),
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

export function renderPaymentPostingDetails(item: PaymentPosting, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  const totalBilledAmount = item.paymentLines?.reduce((sum, line) => sum + (line.billedAmount ?? 0), 0) ?? 0

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Payment Posting</h3>
        {renderSection([
          ['payment ID', item.paymentId],
          ['ERA processing ID', item.eraEobProcessingId ?? '-'],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['payer Claim Number', item.payerClaimNumber ?? '-'],
          ['claim Control Number', item.claimControlNumber ?? '-'],
          ['payment Date', formatDate(item.paymentDate)],
          ['check Number', item.checkNumber ?? '-'],
          ['EFT trace Number', item.eftTraceNumber ?? '-'],
          ['payment Method', item.paymentMethod ?? '-'],
          ['source', item.sourceType ?? (item.eraEobProcessingId ? '835_ERA' : '-')],
          ['idempotency Key', item.idempotencyKey ?? '-'],
          ['received Amount', formatNumber(item.receivedAmount)],
          ['posted Amount', formatNumber(item.postedAmount)],
          ['patient Responsibility Amount', formatNumber(item.patientResponsibilityAmount)],
          ['remaining Balance', formatNumber(item.remainingBalance)],
          ['posting Status', item.postingStatus ?? '-'],
          ['posted By', item.postedBy ?? '-'],
          ['posted At', formatDate(item.postedAt)],
          ['reversed At', formatDate(item.reversedAt)],
          ['reversed By', item.reversedBy ?? '-'],
          ['reversal Reason', item.reversalReason ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      {item.paymentLines.map((child, index) => (
        <section key={index} className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">payment Lines {index + 1}</h3>
          {renderSection([
            ['claim Line ID', child.claimLineId ?? '-'],
            ['service Line Control Number', child.serviceLineControlNumber ?? '-'],
            ['procedure Code', child.procedureCode ?? '-'],
            ['service Date', formatDate(child.serviceDate)],
            ['billed Amount', formatNumber(child.billedAmount)],
            ['paid Amount', formatNumber(child.paidAmount)],
            ['allowed Amount', formatNumber(child.allowedAmount)],
            ['adjustment Amount', formatNumber(child.adjustmentAmount)],
            ['patient Resp Amount', formatNumber(child.patientRespAmount)],
            ['denied Amount', formatNumber(child.deniedAmount)],
            ['adjustment Codes', (child.adjustmentCodes ?? []).join(', ') || '-'],
            ['remark Codes', (child.remarkCodes ?? []).join(', ') || '-'],
          ])}
        </section>
      ))}
      {item.paymentLines && item.paymentLines.length > 0 && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Payment Lines Summary</h3>
          {renderSection([
            ['Total Billed Amount', formatNumber(totalBilledAmount)],
          ])}
        </section>
      )}
    </div>
  )
}

export function renderPaymentPostingGridItem(item: PaymentPosting, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getPaymentPostingLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">posting Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.postingStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
