import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Collection, CollectionCreatePayload, CollectionFormValues } from '@/types/collection'

export const collectionApiDetails = {
  endpoint: '/rcm/collections',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const collectionFormSchema = z.object({
  _id: z.string().optional(),
  patientId: z.string().trim(),
  patientBillingId: z.string().trim(),
  claimId: z.string().trim(),
  originalBalance: z.number().nullable(),
  currentBalance: z.number().nullable(),
  daysPastDue: z.number().nullable(),
  collectionStage: z.string().trim(),
  status: z.string().trim(),
  owner: z.string().trim(),
  lastContactDate: z.date().nullable(),
  nextContactDate: z.date().nullable(),
  contactAttempts: z.number().nullable(),
  resolution: z.string().trim(),
  writeOffAmount: z.number().nullable(),
  settlementAmount: z.number().nullable(),
  balanceAmount: z.number().nullable(),
  agencyName: z.string().trim(),
  referredDate: z.date().nullable(),
  collectionStatus: z.string().trim(),
  recoveredAmount: z.number().nullable(),
  closeDate: z.date().nullable(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<CollectionFormValues>

export const collectionDefaultValues: CollectionFormValues = {
  _id: '',
  patientId: '',
  patientBillingId: '',
  claimId: '',
  originalBalance: null,
  currentBalance: null,
  daysPastDue: null,
  collectionStage: '',
  status: '',
  owner: '',
  lastContactDate: null,
  nextContactDate: null,
  contactAttempts: null,
  resolution: '',
  writeOffAmount: null,
  settlementAmount: null,
  balanceAmount: null,
  agencyName: '',
  referredDate: null,
  collectionStatus: '',
  recoveredAmount: null,
  closeDate: null,
  notes: '',
  active: true,
}

export function createCollectionFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<CollectionFormValues> {
  void referenceOptions
  return {
    schema: collectionFormSchema,
    defaultValues: collectionDefaultValues,
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
      name: 'patientBillingId',
      label: 'patient Billing ID',
      type: 'autocomplete',
      placeholder: 'patient Billing ID',
      options: referenceOptions.patientBillings ?? [],
    },
    {
      name: 'balanceAmount',
      label: 'balance Amount',
      type: 'number',
    },
    {
      name: 'agencyName',
      label: 'agency Name',
      type: 'text',
      placeholder: 'agency Name',
    },
    {
      name: 'referredDate',
      label: 'referred Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'collectionStatus',
      label: 'collection Status',
      type: 'text',
      placeholder: 'collection Status',
    },
    {
      name: 'recoveredAmount',
      label: 'recovered Amount',
      type: 'number',
    },
    {
      name: 'closeDate',
      label: 'close Date',
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

export function mapCollectionToFormValues(item: Collection): CollectionFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    patientBillingId: item.patientBillingId ?? '',
    claimId: item.claimId ?? '',
    originalBalance: item.originalBalance ?? null,
    currentBalance: item.currentBalance ?? null,
    daysPastDue: item.daysPastDue ?? null,
    collectionStage: item.collectionStage ?? '',
    status: item.status ?? '',
    owner: item.owner ?? '',
    lastContactDate: toFormDate(item.lastContactDate),
    nextContactDate: toFormDate(item.nextContactDate),
    contactAttempts: item.contactAttempts ?? null,
    resolution: item.resolution ?? '',
    writeOffAmount: item.writeOffAmount ?? null,
    settlementAmount: item.settlementAmount ?? null,
    balanceAmount: item.balanceAmount ?? null,
    agencyName: item.agencyName ?? '',
    referredDate: toFormDate(item.referredDate),
    collectionStatus: item.collectionStatus ?? '',
    recoveredAmount: item.recoveredAmount ?? null,
    closeDate: toFormDate(item.closeDate),
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapCollectionFormToPayload(values: CollectionFormValues): CollectionCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    patientBillingId: optionalText(values.patientBillingId),
    claimId: optionalText(values.claimId),
    originalBalance: optionalNumber(values.originalBalance),
    currentBalance: optionalNumber(values.currentBalance),
    daysPastDue: optionalNumber(values.daysPastDue),
    collectionStage: optionalText(values.collectionStage),
    status: optionalText(values.status),
    owner: optionalText(values.owner),
    lastContactDate: optionalDate(values.lastContactDate),
    nextContactDate: optionalDate(values.nextContactDate),
    contactAttempts: optionalNumber(values.contactAttempts),
    resolution: optionalText(values.resolution),
    writeOffAmount: optionalNumber(values.writeOffAmount),
    settlementAmount: optionalNumber(values.settlementAmount),
    balanceAmount: optionalNumber(values.balanceAmount),
    agencyName: optionalText(values.agencyName),
    referredDate: optionalDate(values.referredDate),
    collectionStatus: optionalText(values.collectionStatus),
    recoveredAmount: optionalNumber(values.recoveredAmount),
    closeDate: optionalDate(values.closeDate),
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getCollectionLabel(item: Collection, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.status ?? item.collectionStatus, item.collectionStage, formatNumber(item.currentBalance ?? item.balanceAmount)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createCollectionTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Collection>> {
  return [
    {
      key: 'record',
      header: 'Collection',
      sortField: 'agencyName',
      exportValue: (item) => getCollectionLabel(item, referenceOptions),
      render: (item) => getCollectionLabel(item, referenceOptions),
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
      key: 'status',
      header: 'Status',
      filterable: true,
      field: 'status',
      sortField: 'status',
      exportValue: (item) => item.status ?? item.collectionStatus ?? '-',
      render: (item) => item.status ?? item.collectionStatus ?? '-',
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

export function renderCollectionDetails(item: Collection, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Collection</h3>
        {renderSection([
          ['collection ID', item.collectionId],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['patient Billing ID', formatReferenceLabel(referenceOptions.patientBillings, item.patientBillingId)],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['status', item.status ?? item.collectionStatus ?? '-'],
          ['stage', item.collectionStage ?? '-'],
          ['owner', item.owner ?? '-'],
          ['original Balance', formatNumber(item.originalBalance)],
          ['current Balance', formatNumber(item.currentBalance)],
          ['days Past Due', formatNumber(item.daysPastDue)],
          ['contact Attempts', formatNumber(item.contactAttempts)],
          ['last Contact Date', formatDate(item.lastContactDate)],
          ['next Contact Date', formatDate(item.nextContactDate)],
          ['resolution', item.resolution ?? '-'],
          ['write Off Amount', formatNumber(item.writeOffAmount)],
          ['settlement Amount', formatNumber(item.settlementAmount)],
          ['balance Amount', formatNumber(item.balanceAmount)],
          ['agency Name', item.agencyName ?? '-'],
          ['referred Date', formatDate(item.referredDate)],
          ['collection Status', item.collectionStatus ?? '-'],
          ['recovered Amount', formatNumber(item.recoveredAmount)],
          ['close Date', formatDate(item.closeDate)],
          ['notes', item.notes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      {item.actionAudit?.length ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Action Audit</h3>
          {renderSection(item.actionAudit.slice(-5).map((entry, index) => [
            `action ${index + 1}`,
            formatMixed(entry),
          ]))}
        </section>
      ) : null}
    </div>
  )
}

export function renderCollectionGridItem(item: Collection, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getCollectionLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.status ?? item.collectionStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
