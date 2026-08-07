import { z } from 'zod'
import { RcmAiInsightSection } from '@/components/rcm/RcmAiInsightSection'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ArWorkItem, ArWorkItemCreatePayload, ArWorkItemFormValues, ArWorkItemFollowUpHistory, ArWorkItemFollowUpHistoryFormValues } from '@/types/arWorkItem'

export const arWorkItemApiDetails = {
  endpoint: '/rcm/ar-work-items',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const arWorkItemFollowUpHistoryFormSchema = z.object({
  followUpDate: z.date().nullable(),
  followUpType: z.string().trim(),
  notes: z.string().trim(),
  performedBy: z.string().trim(),
})

export const arWorkItemFormSchema = z.object({
  _id: z.string().optional(),
  claimId: z.string().trim(),
  claimLineId: z.string().trim(),
  denialId: z.string().trim(),
  appealId: z.string().trim(),
  correctedClaimId: z.string().trim(),
  paymentPostingId: z.string().trim(),
  patientId: z.string().trim(),
  payerId: z.string().trim(),
  category: z.string().trim(),
  balanceAmount: z.number().nullable(),
  expectedAmount: z.number().nullable(),
  paidAmount: z.number().nullable(),
  varianceAmount: z.number().nullable(),
  agingBucket: z.string().trim(),
  denialCode: z.string().trim(),
  denialCategory: z.string().trim(),
  priority: z.string().trim(),
  status: z.string().trim(),
  owner: z.string().trim(),
  followUpDate: z.date().nullable(),
  dueDate: z.date().nullable(),
  reason: z.string().trim(),
  nextAction: z.string().trim(),
  notes: z.string().trim(),
  assignedTo: z.string().trim(),
  team: z.string().trim(),
  rootCauseAnalysis: z.string().trim(),
  suggestedFix: z.string().trim(),
  nextFollowUpDate: z.date().nullable(),
  appealRequired: z.boolean(),
  correctedClaimRequired: z.boolean(),
  escalationFlag: z.boolean(),
  followUpHistory: z.array(arWorkItemFollowUpHistoryFormSchema).length(2),
  contactHistory: z.array(z.any()),
  active: z.boolean(),
}) as z.ZodType<ArWorkItemFormValues>

function createEmptyArWorkItemFollowUpHistory(): ArWorkItemFollowUpHistoryFormValues {
  return {
    followUpDate: null,
    followUpType: '',
    notes: '',
    performedBy: '',
  }
}

export const arWorkItemDefaultValues: ArWorkItemFormValues = {
  _id: '',
  claimId: '',
  claimLineId: '',
  denialId: '',
  appealId: '',
  correctedClaimId: '',
  paymentPostingId: '',
  patientId: '',
  payerId: '',
  category: '',
  balanceAmount: null,
  expectedAmount: null,
  paidAmount: null,
  varianceAmount: null,
  agingBucket: '',
  denialCode: '',
  denialCategory: '',
  priority: '',
  status: '',
  owner: '',
  followUpDate: null,
  dueDate: null,
  reason: '',
  nextAction: '',
  notes: '',
  assignedTo: '',
  team: '',
  rootCauseAnalysis: '',
  suggestedFix: '',
  nextFollowUpDate: null,
  appealRequired: false,
  correctedClaimRequired: false,
  escalationFlag: false,
  followUpHistory: [createEmptyArWorkItemFollowUpHistory(), createEmptyArWorkItemFollowUpHistory()],
  contactHistory: [],
  active: true,
}

export function createArWorkItemFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ArWorkItemFormValues> {
  void referenceOptions
  return {
    schema: arWorkItemFormSchema,
    defaultValues: arWorkItemDefaultValues,
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
      name: 'patientId',
      label: 'patient ID',
      type: 'autocomplete',
      placeholder: 'patient ID',
      options: referenceOptions.patients ?? [],
    },
    {
      name: 'payerId',
      label: 'payer ID',
      type: 'autocomplete',
      placeholder: 'payer ID',
      options: referenceOptions.payers ?? [],
    },
    {
      name: 'balanceAmount',
      label: 'balance Amount',
      type: 'number',
    },
    {
      name: 'agingBucket',
      label: 'aging Bucket',
      type: 'text',
      placeholder: 'aging Bucket',
    },
    {
      name: 'denialCode',
      label: 'denial Code',
      type: 'text',
      placeholder: 'denial Code',
    },
    {
      name: 'denialCategory',
      label: 'denial Category',
      type: 'text',
      placeholder: 'denial Category',
    },
    {
      name: 'priority',
      label: 'priority',
      type: 'text',
      placeholder: 'priority',
    },
    {
      name: 'status',
      label: 'status',
      type: 'text',
      placeholder: 'status',
    },
    {
      name: 'assignedTo',
      label: 'assigned To',
      type: 'text',
      placeholder: 'assigned To',
    },
    {
      name: 'team',
      label: 'team',
      type: 'text',
      placeholder: 'team',
    },
    {
      name: 'rootCauseAnalysis',
      label: 'root Cause Analysis',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'suggestedFix',
      label: 'suggested Fix',
      type: 'text',
      placeholder: 'suggested Fix',
    },
    {
      name: 'nextFollowUpDate',
      label: 'next Follow Up Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'appealRequired',
      label: 'appeal Required',
      type: 'switch',
    },
    {
      name: 'correctedClaimRequired',
      label: 'corrected Claim Required',
      type: 'switch',
    },
    {
      name: 'escalationFlag',
      label: 'escalation Flag',
      type: 'switch',
    },
    {
      name: 'followUpHistory.0.followUpDate',
      label: 'follow Up History 0 follow Up Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'followUpHistory.0.followUpType',
      label: 'follow Up History 0 follow Up Type',
      type: 'text',
      placeholder: 'follow Up History 0 follow Up Type',
    },
    {
      name: 'followUpHistory.0.notes',
      label: 'follow Up History 0 notes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'followUpHistory.0.performedBy',
      label: 'follow Up History 0 performed By',
      type: 'text',
      placeholder: 'follow Up History 0 performed By',
    },
    {
      name: 'followUpHistory.1.followUpDate',
      label: 'follow Up History 1 follow Up Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'followUpHistory.1.followUpType',
      label: 'follow Up History 1 follow Up Type',
      type: 'text',
      placeholder: 'follow Up History 1 follow Up Type',
    },
    {
      name: 'followUpHistory.1.notes',
      label: 'follow Up History 1 notes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'followUpHistory.1.performedBy',
      label: 'follow Up History 1 performed By',
      type: 'text',
      placeholder: 'follow Up History 1 performed By',
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

function buildArWorkItemFollowUpHistorys(followUpHistory: ArWorkItemFollowUpHistory[] = []): ArWorkItemFollowUpHistoryFormValues[] {
  return Array.from({ length: 2 }, (_, index) => {
    const item = (followUpHistory && followUpHistory[index]) || ({} as ArWorkItemFollowUpHistory)

    return {
      followUpDate: toFormDate((item as ArWorkItemFollowUpHistory).followUpDate ?? null),
      followUpType: (item as ArWorkItemFollowUpHistory).followUpType ?? '',
      notes: (item as ArWorkItemFollowUpHistory).notes ?? '',
      performedBy: (item as ArWorkItemFollowUpHistory).performedBy ?? '',
    }
  })
}

function isArWorkItemFollowUpHistoryEmpty(item: ArWorkItemFollowUpHistoryFormValues) {
  return item.followUpDate === null && !item.followUpType.trim() && !item.notes.trim() && !item.performedBy.trim()
}

function compactArWorkItemFollowUpHistorys(followUpHistory: ArWorkItemFollowUpHistoryFormValues[]): ArWorkItemFollowUpHistory[] | undefined {
  const nextItems = followUpHistory
    .filter((item) => !isArWorkItemFollowUpHistoryEmpty(item))
    .map((item) => ({
      followUpDate: optionalDate(item.followUpDate),
      followUpType: optionalText(item.followUpType),
      notes: optionalText(item.notes),
      performedBy: optionalText(item.performedBy),
    }))

  return nextItems.length ? nextItems : undefined
}

export function mapArWorkItemToFormValues(item: ArWorkItem): ArWorkItemFormValues {
  return {
    _id: item._id,
    claimId: item.claimId ?? '',
    claimLineId: item.claimLineId ?? '',
    denialId: item.denialId ?? '',
    appealId: item.appealId ?? '',
    correctedClaimId: item.correctedClaimId ?? '',
    paymentPostingId: item.paymentPostingId ?? '',
    patientId: item.patientId ?? '',
    payerId: item.payerId ?? '',
    category: item.category ?? '',
    balanceAmount: item.balanceAmount ?? null,
    expectedAmount: item.expectedAmount ?? null,
    paidAmount: item.paidAmount ?? null,
    varianceAmount: item.varianceAmount ?? null,
    agingBucket: item.agingBucket ?? '',
    denialCode: item.denialCode ?? '',
    denialCategory: item.denialCategory ?? '',
    priority: item.priority ?? '',
    status: item.status ?? '',
    owner: item.owner ?? '',
    followUpDate: toFormDate(item.followUpDate),
    dueDate: toFormDate(item.dueDate),
    reason: item.reason ?? '',
    nextAction: item.nextAction ?? '',
    notes: item.notes ?? '',
    assignedTo: item.assignedTo ?? '',
    team: item.team ?? '',
    rootCauseAnalysis: item.rootCauseAnalysis ?? '',
    suggestedFix: item.suggestedFix ?? '',
    nextFollowUpDate: toFormDate(item.nextFollowUpDate),
    appealRequired: item.appealRequired,
    correctedClaimRequired: item.correctedClaimRequired,
    escalationFlag: item.escalationFlag,
    followUpHistory: buildArWorkItemFollowUpHistorys(item.followUpHistory),
    contactHistory: item.contactHistory ?? [],
    active: item.active,
  }
}

export function mapArWorkItemFormToPayload(values: ArWorkItemFormValues): ArWorkItemCreatePayload {
  return {
    claimId: optionalText(values.claimId),
    claimLineId: optionalText(values.claimLineId),
    denialId: optionalText(values.denialId),
    appealId: optionalText(values.appealId),
    correctedClaimId: optionalText(values.correctedClaimId),
    paymentPostingId: optionalText(values.paymentPostingId),
    patientId: optionalText(values.patientId),
    payerId: optionalText(values.payerId),
    category: optionalText(values.category),
    balanceAmount: optionalNumber(values.balanceAmount),
    expectedAmount: optionalNumber(values.expectedAmount),
    paidAmount: optionalNumber(values.paidAmount),
    varianceAmount: optionalNumber(values.varianceAmount),
    agingBucket: optionalText(values.agingBucket),
    denialCode: optionalText(values.denialCode),
    denialCategory: optionalText(values.denialCategory),
    priority: optionalText(values.priority),
    status: optionalText(values.status),
    owner: optionalText(values.owner),
    followUpDate: optionalDate(values.followUpDate),
    dueDate: optionalDate(values.dueDate),
    reason: optionalText(values.reason),
    nextAction: optionalText(values.nextAction),
    notes: optionalText(values.notes),
    assignedTo: optionalText(values.assignedTo),
    team: optionalText(values.team),
    rootCauseAnalysis: optionalText(values.rootCauseAnalysis),
    suggestedFix: optionalText(values.suggestedFix),
    nextFollowUpDate: optionalDate(values.nextFollowUpDate),
    appealRequired: values.appealRequired,
    correctedClaimRequired: values.correctedClaimRequired,
    escalationFlag: values.escalationFlag,
    followUpHistory: compactArWorkItemFollowUpHistorys(values.followUpHistory),
    contactHistory: values.contactHistory,
    active: values.active,
  }
}

function getArWorkItemLabel(item: ArWorkItem, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.category, item.agingBucket, item.status, item.priority].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createArWorkItemTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<ArWorkItem>> {
  return [
    {
      key: 'record',
      header: 'AR Work Item',
      sortField: 'agingBucket',
      exportValue: (item) => getArWorkItemLabel(item, referenceOptions),
      render: (item) => getArWorkItemLabel(item, referenceOptions),
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
      key: 'payerId',
      header: 'Payer',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
      render: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
    },
    {
      key: 'category',
      header: 'Category',
      filterable: true,
      field: 'category',
      sortField: 'category',
      exportValue: (item) => item.category ?? '-',
      render: (item) => item.category ?? '-',
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      field: 'status',
      sortField: 'status',
      exportValue: (item) => item.status ?? '-',
      render: (item) => item.status ?? '-',
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

export function renderArWorkItemDetails(item: ArWorkItem, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">AR Work Item</h3>
        {renderSection([
          ['ar Work Item ID', item.arWorkItemId],
          ['category', item.category ?? '-'],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['claim Line ID', item.claimLineId ?? '-'],
          ['payment Posting ID', item.paymentPostingId ?? '-'],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['balance Amount', formatNumber(item.balanceAmount)],
          ['expected Amount', formatNumber(item.expectedAmount)],
          ['paid Amount', formatNumber(item.paidAmount)],
          ['variance Amount', formatNumber(item.varianceAmount)],
          ['aging Bucket', item.agingBucket ?? '-'],
          ['denial Code', item.denialCode ?? '-'],
          ['denial Category', item.denialCategory ?? '-'],
          ['priority', item.priority ?? '-'],
          ['status', item.status ?? '-'],
          ['owner', item.owner ?? '-'],
          ['follow Up Date', formatDate(item.followUpDate)],
          ['due Date', formatDate(item.dueDate)],
          ['reason', item.reason ?? '-'],
          ['next Action', item.nextAction ?? '-'],
          ['assigned To', item.assignedTo ?? '-'],
          ['team', item.team ?? '-'],
          ['root Cause Analysis', item.rootCauseAnalysis ?? '-'],
          ['suggested Fix', item.suggestedFix ?? '-'],
          ['next Follow Up Date', formatDate(item.nextFollowUpDate)],
          ['appeal Required', formatBoolean(item.appealRequired)],
          ['corrected Claim Required', formatBoolean(item.correctedClaimRequired)],
          ['escalation Flag', formatBoolean(item.escalationFlag)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      <RcmAiInsightSection title="AI Priority Analysis" variant="ar-priority" insight={item.aiPriorityAnalysis} history={item.aiRecommendationHistory} />
      {item.followUpHistory.map((child, index) => (
        <section key={index} className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">follow Up History {index + 1}</h3>
          {renderSection([
            ['follow Up Date', formatDate(child.followUpDate)],
            ['follow Up Type', child.followUpType ?? '-'],
            ['notes', child.notes ?? '-'],
            ['performed By', child.performedBy ?? '-'],
          ])}
        </section>
      ))}
    </div>
  )
}

export function renderArWorkItemGridItem(item: ArWorkItem, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getArWorkItemLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.status ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
