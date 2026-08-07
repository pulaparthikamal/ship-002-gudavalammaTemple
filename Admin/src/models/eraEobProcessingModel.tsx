import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { EraEobProcessing, EraEobProcessingCreatePayload, EraEobProcessingFormValues } from '@/types/eraEobProcessing'

export const eraEobProcessingApiDetails = {
  endpoint: '/rcm/era-eob-processings',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const eraEobProcessingFormSchema = z.object({
  _id: z.string().optional(),
  payerId: z.string().trim(),
  payerName: z.string().trim(),
  paymentId: z.string().trim(),
  eraReceived: z.boolean(),
  eraFileReference: z.string().trim(),
  eraBatchId: z.string().trim(),
  depositId: z.string().trim(),
  raw835FileReference: z.string().trim(),
  rawPayloadRedacted: z.string().trim(),
  checkNumber: z.string().trim(),
  paymentTraceNumber: z.string().trim(),
  paymentMethod: z.string().trim(),
  paymentDate: z.date().nullable(),
  totalAmount: z.number().nullable(),
  totalPaymentAmount: z.number().nullable(),
  depositAmount: z.number().nullable(),
  postedAmount: z.number().nullable(),
  claimPaidAmount: z.number().nullable(),
  serviceLinePaidAmount: z.number().nullable(),
  adjustmentTotal: z.number().nullable(),
  patientResponsibilityTotal: z.number().nullable(),
  unmatchedAmount: z.number().nullable(),
  reconciliationStatus: z.string().trim(),
  accountingLocked: z.boolean(),
  accountingLockedAt: z.date().nullable(),
  accountingLockedBy: z.string().trim(),
  accountingLockReason: z.string().trim(),
  exceptionReason: z.string().trim(),
  receivedDate: z.date().nullable(),
  importStatus: z.string().trim(),
  parsedStatus: z.string().trim(),
  parseErrors: z.string().trim(),
  importErrors: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<EraEobProcessingFormValues>

export const eraEobProcessingDefaultValues: EraEobProcessingFormValues = {
  _id: '',
  payerId: '',
  payerName: '',
  paymentId: '',
  eraReceived: false,
  eraFileReference: '',
  eraBatchId: '',
  depositId: '',
  raw835FileReference: '',
  rawPayloadRedacted: '',
  checkNumber: '',
  paymentTraceNumber: '',
  paymentMethod: '',
  paymentDate: null,
  totalAmount: null,
  totalPaymentAmount: null,
  depositAmount: null,
  postedAmount: null,
  claimPaidAmount: null,
  serviceLinePaidAmount: null,
  adjustmentTotal: null,
  patientResponsibilityTotal: null,
  unmatchedAmount: null,
  reconciliationStatus: '',
  accountingLocked: false,
  accountingLockedAt: null,
  accountingLockedBy: '',
  accountingLockReason: '',
  exceptionReason: '',
  receivedDate: null,
  importStatus: '',
  parsedStatus: '',
  parseErrors: '',
  importErrors: '',
  active: true,
}

export function createEraEobProcessingFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<EraEobProcessingFormValues> {
  void referenceOptions
  return {
    schema: eraEobProcessingFormSchema,
    defaultValues: eraEobProcessingDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'payerId',
      label: 'payer ID',
      type: 'autocomplete',
      placeholder: 'payer ID',
      options: referenceOptions.payers ?? [],
    },
    {
      name: 'payerName',
      label: 'payer Name',
      type: 'text',
      placeholder: 'payer Name',
    },
    {
      name: 'paymentId',
      label: 'payment ID',
      type: 'autocomplete',
      placeholder: 'payment ID',
      options: referenceOptions.paymentPostings ?? [],
    },
    {
      name: 'eraReceived',
      label: 'era Received',
      type: 'switch',
    },
    {
      name: 'eraFileReference',
      label: 'era File Reference',
      type: 'text',
      placeholder: 'era File Reference',
    },
    {
      name: 'eraBatchId',
      label: 'ERA Batch ID',
      type: 'text',
      disabled: true,
    },
    {
      name: 'depositId',
      label: 'Deposit ID',
      type: 'text',
      disabled: true,
    },
    {
      name: 'raw835FileReference',
      label: 'raw835 File Reference',
      type: 'text',
      placeholder: 'raw835 File Reference',
    },
    {
      name: 'checkNumber',
      label: 'check Number',
      type: 'text',
      placeholder: 'check Number',
    },
    {
      name: 'paymentTraceNumber',
      label: 'payment Trace Number',
      type: 'text',
      placeholder: 'payment Trace Number',
    },
    {
      name: 'paymentMethod',
      label: 'payment Method',
      type: 'text',
      placeholder: 'ACH, CHK, EFT',
      disabled: true,
    },
    {
      name: 'paymentDate',
      label: 'payment Date',
      type: 'date',
      disabled: true,
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'totalAmount',
      label: 'total Amount',
      type: 'number',
    },
    {
      name: 'totalPaymentAmount',
      label: 'total Payment Amount',
      type: 'number',
    },
    {
      name: 'depositAmount',
      label: 'deposit Amount',
      type: 'number',
      disabled: true,
    },
    {
      name: 'postedAmount',
      label: 'posted Amount',
      type: 'number',
      disabled: true,
    },
    {
      name: 'claimPaidAmount',
      label: 'claim Paid Amount',
      type: 'number',
      disabled: true,
    },
    {
      name: 'serviceLinePaidAmount',
      label: 'service Line Paid Amount',
      type: 'number',
      disabled: true,
    },
    {
      name: 'adjustmentTotal',
      label: 'adjustment Total',
      type: 'number',
      disabled: true,
    },
    {
      name: 'patientResponsibilityTotal',
      label: 'patient Responsibility Total',
      type: 'number',
      disabled: true,
    },
    {
      name: 'unmatchedAmount',
      label: 'unmatched Amount',
      type: 'number',
      disabled: true,
    },
    {
      name: 'reconciliationStatus',
      label: 'reconciliation Status',
      type: 'text',
      disabled: true,
    },
    {
      name: 'accountingLocked',
      label: 'accounting Locked',
      type: 'switch',
      disabled: true,
    },
    {
      name: 'accountingLockedBy',
      label: 'accounting Locked By',
      type: 'text',
      disabled: true,
    },
    {
      name: 'accountingLockReason',
      label: 'accounting Lock Reason',
      type: 'textarea',
      rows: 2,
      fullWidth: true,
      disabled: true,
    },
    {
      name: 'exceptionReason',
      label: 'exception Reason',
      type: 'textarea',
      rows: 2,
      fullWidth: true,
      disabled: true,
    },
    {
      name: 'receivedDate',
      label: 'received Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'importStatus',
      label: 'import Status',
      type: 'text',
      placeholder: 'import Status',
    },
    {
      name: 'parsedStatus',
      label: 'parsed Status',
      type: 'text',
      placeholder: 'parsed Status',
    },
    {
      name: 'parseErrors',
      label: 'parse Errors',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'importErrors',
      label: 'import Errors',
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

export function mapEraEobProcessingToFormValues(item: EraEobProcessing): EraEobProcessingFormValues {
  return {
    _id: item._id,
    payerId: item.payerId ?? '',
    payerName: item.payerName ?? '',
    paymentId: item.paymentId ?? '',
    eraReceived: item.eraReceived,
    eraFileReference: item.eraFileReference ?? '',
    eraBatchId: item.eraBatchId ?? '',
    depositId: item.depositId ?? '',
    raw835FileReference: item.raw835FileReference ?? '',
    rawPayloadRedacted: item.rawPayloadRedacted ?? '',
    checkNumber: item.checkNumber ?? '',
    paymentTraceNumber: item.paymentTraceNumber ?? '',
    paymentMethod: item.paymentMethod ?? '',
    paymentDate: toFormDate(item.paymentDate),
    totalAmount: item.totalAmount ?? null,
    totalPaymentAmount: item.totalPaymentAmount ?? null,
    depositAmount: item.depositAmount ?? null,
    postedAmount: item.postedAmount ?? null,
    claimPaidAmount: item.claimPaidAmount ?? null,
    serviceLinePaidAmount: item.serviceLinePaidAmount ?? null,
    adjustmentTotal: item.adjustmentTotal ?? null,
    patientResponsibilityTotal: item.patientResponsibilityTotal ?? null,
    unmatchedAmount: item.unmatchedAmount ?? null,
    reconciliationStatus: item.reconciliationStatus ?? '',
    accountingLocked: item.accountingLocked ?? false,
    accountingLockedAt: toFormDate(item.accountingLockedAt),
    accountingLockedBy: item.accountingLockedBy ?? '',
    accountingLockReason: item.accountingLockReason ?? '',
    exceptionReason: item.exceptionReason ?? '',
    receivedDate: toFormDate(item.receivedDate),
    importStatus: item.importStatus ?? '',
    parsedStatus: item.parsedStatus ?? '',
    parseErrors: formatStringList(item.parseErrors),
    importErrors: formatStringList(item.importErrors),
    active: item.active,
  }
}

export function mapEraEobProcessingFormToPayload(values: EraEobProcessingFormValues): EraEobProcessingCreatePayload {
  return {
    payerId: optionalText(values.payerId),
    payerName: optionalText(values.payerName),
    paymentId: optionalText(values.paymentId),
    eraReceived: values.eraReceived,
    eraFileReference: optionalText(values.eraFileReference),
    eraBatchId: optionalText(values.eraBatchId),
    depositId: optionalText(values.depositId),
    raw835FileReference: optionalText(values.raw835FileReference),
    rawPayloadRedacted: optionalText(values.rawPayloadRedacted),
    checkNumber: optionalText(values.checkNumber),
    paymentTraceNumber: optionalText(values.paymentTraceNumber),
    paymentMethod: optionalText(values.paymentMethod),
    paymentDate: optionalDate(values.paymentDate),
    totalAmount: optionalNumber(values.totalAmount),
    totalPaymentAmount: optionalNumber(values.totalPaymentAmount),
    depositAmount: optionalNumber(values.depositAmount),
    postedAmount: optionalNumber(values.postedAmount),
    claimPaidAmount: optionalNumber(values.claimPaidAmount),
    serviceLinePaidAmount: optionalNumber(values.serviceLinePaidAmount),
    adjustmentTotal: optionalNumber(values.adjustmentTotal),
    patientResponsibilityTotal: optionalNumber(values.patientResponsibilityTotal),
    unmatchedAmount: optionalNumber(values.unmatchedAmount),
    reconciliationStatus: optionalText(values.reconciliationStatus),
    accountingLocked: values.accountingLocked,
    accountingLockedAt: optionalDate(values.accountingLockedAt),
    accountingLockedBy: optionalText(values.accountingLockedBy),
    accountingLockReason: optionalText(values.accountingLockReason),
    exceptionReason: optionalText(values.exceptionReason),
    receivedDate: optionalDate(values.receivedDate),
    importStatus: optionalText(values.importStatus),
    parsedStatus: optionalText(values.parsedStatus),
    parseErrors: parseStringList(values.parseErrors),
    importErrors: parseStringList(values.importErrors),
    active: values.active,
  }
}

function getEraEobProcessingLabel(item: EraEobProcessing, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.checkNumber, formatDate(item.receivedDate), item.parsedStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createEraEobProcessingTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<EraEobProcessing>> {
  return [
    {
      key: 'record',
      header: 'ERA / EOB Processing',
      sortField: 'checkNumber',
      exportValue: (item) => getEraEobProcessingLabel(item, referenceOptions),
      render: (item) => getEraEobProcessingLabel(item, referenceOptions),
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
      key: 'importStatus',
      header: 'Import Status',
      filterable: true,
      field: 'importStatus',
      sortField: 'importStatus',
      exportValue: (item) => item.importStatus ?? '-',
      render: (item) => item.importStatus ?? '-',
    },
    {
      key: 'parsedStatus',
      header: 'Parsed Status',
      filterable: true,
      field: 'parsedStatus',
      sortField: 'parsedStatus',
      exportValue: (item) => item.parsedStatus ?? '-',
      render: (item) => item.parsedStatus ?? '-',
    },
    {
      key: 'reconciliationStatus',
      header: 'Reconciliation',
      filterable: true,
      field: 'reconciliationStatus',
      sortField: 'reconciliationStatus',
      exportValue: (item) => item.reconciliationStatus ?? '-',
      render: (item) => item.reconciliationStatus ?? '-',
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

export function renderEraEobProcessingDetails(item: EraEobProcessing, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">ERA / EOB Processing</h3>
        {renderSection([
          ['era ID', item.eraId],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['payer Name', item.payerName ?? '-'],
          ['payment ID', formatReferenceLabel(referenceOptions.paymentPostings, item.paymentId)],
          ['era Received', formatBoolean(item.eraReceived)],
          ['era File Reference', item.eraFileReference ?? '-'],
          ['ERA Batch ID', item.eraBatchId ?? '-'],
          ['Deposit ID', item.depositId ?? '-'],
          ['raw835 File Reference', item.raw835FileReference ?? '-'],
          ['raw Payload Stored', formatBoolean(item.rawPayloadStored)],
          ['check Number', item.checkNumber ?? '-'],
          ['payment Trace Number', item.paymentTraceNumber ?? '-'],
          ['payment Method', item.paymentMethod ?? '-'],
          ['payment Date', formatDate(item.paymentDate)],
          ['total Amount', formatNumber(item.totalAmount)],
          ['total Payment Amount', formatNumber(item.totalPaymentAmount)],
          ['deposit Amount', formatNumber(item.depositAmount)],
          ['posted Amount', formatNumber(item.postedAmount)],
          ['claim Paid Amount', formatNumber(item.claimPaidAmount)],
          ['service Line Paid Amount', formatNumber(item.serviceLinePaidAmount)],
          ['adjustment Total', formatNumber(item.adjustmentTotal)],
          ['patient Responsibility Total', formatNumber(item.patientResponsibilityTotal)],
          ['unmatched Amount', formatNumber(item.unmatchedAmount)],
          ['reconciliation Status', item.reconciliationStatus ?? '-'],
          ['accounting Locked', formatBoolean(item.accountingLocked)],
          ['accounting Locked At', formatDate(item.accountingLockedAt)],
          ['accounting Locked By', item.accountingLockedBy ?? '-'],
          ['accounting Lock Reason', item.accountingLockReason ?? '-'],
          ['exception Reason', item.exceptionReason ?? '-'],
          ['received Date', formatDate(item.receivedDate)],
          ['import Status', item.importStatus ?? '-'],
          ['parsed Status', item.parsedStatus ?? '-'],
          ['matched Claims', String(item.matchedClaims?.length ?? 0)],
          ['unmatched Claims', String(item.unmatchedClaims?.length ?? 0)],
          ['parse Errors', (item.parseErrors ?? []).join(', ') || '-'],
          ['import Errors', (item.importErrors ?? []).join(', ') || '-'],
          ['redacted Payload', item.rawPayloadRedacted ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderEraEobProcessingGridItem(item: EraEobProcessing, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getEraEobProcessingLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">parsed Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.parsedStatus ?? '-'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">reconciliation</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.reconciliationStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
