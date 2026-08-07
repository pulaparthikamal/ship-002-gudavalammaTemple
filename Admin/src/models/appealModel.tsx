import { z } from 'zod'
import { useState, type ReactNode } from 'react'
import { RcmAiInsightSection } from '@/components/rcm/RcmAiInsightSection'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Appeal, AppealCreatePayload, AppealFormValues } from '@/types/appeal'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'

export const appealApiDetails = {
  endpoint: '/rcm/appeals',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const appealStatusOptions = ['DRAFT', 'PACKET_GENERATED', 'READY', 'SUBMITTED', 'PAYER_RECEIVED', 'PAYER_REVIEW', 'IN_REVIEW', 'MORE_INFO_REQUIRED', 'EVIDENCE_SUBMITTED', 'OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD', 'WITHDRAWN', 'CLOSED']
  .map((value) => ({ label: value, value }))

export const appealFormSchema = z.object({
  _id: z.string().optional(),
  denialId: z.string().trim(),
  claimId: z.string().trim(),
  arWorkItemId: z.string().trim(),
  payerId: z.string().trim(),
  denialCode: z.string().trim(),
  appealCategory: z.string().trim(),
  dueDate: z.date().nullable(),
  owner: z.string().trim(),
  appealLevel: z.string().trim(),
  appealReason: z.string().trim(),
  appealDescription: z.string().trim(),
  supportingDocuments: z.string().trim(),
  appealStatus: z.string().trim(),
  submissionDate: z.date().nullable(),
  appealDeadline: z.date().nullable(),
  submissionMethod: z.string().trim(),
  payerResponse: z.string().trim(),
  resolution: z.string().trim(),
  outcome: z.string().trim(),
  outcomeDate: z.date().nullable(),
  appealOutcomeReason: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<AppealFormValues>

export const appealDefaultValues: AppealFormValues = {
  _id: '',
  denialId: '',
  claimId: '',
  arWorkItemId: '',
  payerId: '',
  denialCode: '',
  appealCategory: '',
  dueDate: null,
  owner: '',
  appealLevel: '',
  appealReason: '',
  appealDescription: '',
  supportingDocuments: '',
  appealStatus: '',
  submissionDate: null,
  appealDeadline: null,
  submissionMethod: '',
  payerResponse: '',
  resolution: '',
  outcome: '',
  outcomeDate: null,
  appealOutcomeReason: '',
  active: true,
}

export function createAppealFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<AppealFormValues> {
  void referenceOptions
  return {
    schema: appealFormSchema,
    defaultValues: appealDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'denialId',
      label: 'denial ID',
      type: 'text',
      placeholder: 'denial ID',
    },
    {
      name: 'claimId',
      label: 'claim ID',
      type: 'autocomplete',
      placeholder: 'claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'arWorkItemId',
      label: 'ar Work Item ID',
      type: 'autocomplete',
      placeholder: 'ar Work Item ID',
      options: referenceOptions.arWorkItems ?? [],
    },
    {
      name: 'payerId',
      label: 'payer ID',
      type: 'autocomplete',
      placeholder: 'payer ID',
      options: referenceOptions.payers ?? [],
    },
    {
      name: 'denialCode',
      label: 'denial Code',
      type: 'text',
      placeholder: 'denial Code',
    },
    {
      name: 'appealCategory',
      label: 'appeal Category',
      type: 'text',
      placeholder: 'appeal Category',
    },
    {
      name: 'owner',
      label: 'owner',
      type: 'text',
      placeholder: 'owner',
    },
    {
      name: 'dueDate',
      label: 'due Date',
      type: 'date',
      date: { showButtonBar: true },
    },
    {
      name: 'appealLevel',
      label: 'appeal Level',
      type: 'text',
      placeholder: 'appeal Level',
    },
    {
      name: 'appealReason',
      label: 'appeal Reason',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'appealDescription',
      label: 'appeal Description',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'supportingDocuments',
      label: 'supporting Documents',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'appealStatus',
      label: 'appeal Status',
      type: 'select',
      placeholder: 'appeal Status',
      options: appealStatusOptions,
    },
    {
      name: 'submissionDate',
      label: 'submission Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'appealDeadline',
      label: 'appeal Deadline',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'submissionMethod',
      label: 'submission Method',
      type: 'text',
      placeholder: 'submission Method',
    },
    {
      name: 'payerResponse',
      label: 'payer Response',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'resolution',
      label: 'resolution',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'outcome',
      label: 'outcome',
      type: 'text',
      placeholder: 'outcome',
    },
    {
      name: 'outcomeDate',
      label: 'outcome Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'appealOutcomeReason',
      label: 'appeal Outcome Reason',
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

export function mapAppealToFormValues(item: Appeal): AppealFormValues {
  return {
    _id: item._id,
    denialId: item.denialId ?? '',
    claimId: item.claimId ?? '',
    arWorkItemId: item.arWorkItemId ?? '',
    payerId: item.payerId ?? '',
    denialCode: item.denialCode ?? '',
    appealCategory: item.appealCategory ?? '',
    dueDate: toFormDate(item.dueDate),
    owner: item.owner ?? '',
    appealLevel: item.appealLevel ?? '',
    appealReason: item.appealReason ?? '',
    appealDescription: item.appealDescription ?? '',
    supportingDocuments: formatStringList(item.supportingDocuments),
    appealStatus: item.appealStatus ?? '',
    submissionDate: toFormDate(item.submissionDate),
    appealDeadline: toFormDate(item.appealDeadline),
    submissionMethod: item.submissionMethod ?? '',
    payerResponse: item.payerResponse ?? '',
    resolution: item.resolution ?? '',
    outcome: item.outcome ?? '',
    outcomeDate: toFormDate(item.outcomeDate),
    appealOutcomeReason: item.appealOutcomeReason ?? '',
    active: item.active,
  }
}

export function mapAppealFormToPayload(values: AppealFormValues): AppealCreatePayload {
  return {
    denialId: optionalText(values.denialId),
    claimId: optionalText(values.claimId),
    arWorkItemId: optionalText(values.arWorkItemId),
    payerId: optionalText(values.payerId),
    denialCode: optionalText(values.denialCode),
    appealCategory: optionalText(values.appealCategory),
    dueDate: optionalDate(values.dueDate),
    owner: optionalText(values.owner),
    appealLevel: optionalText(values.appealLevel),
    appealReason: optionalText(values.appealReason),
    appealDescription: optionalText(values.appealDescription),
    supportingDocuments: parseStringList(values.supportingDocuments),
    appealStatus: optionalText(values.appealStatus),
    submissionDate: optionalDate(values.submissionDate),
    appealDeadline: optionalDate(values.appealDeadline),
    submissionMethod: optionalText(values.submissionMethod),
    payerResponse: optionalText(values.payerResponse),
    resolution: optionalText(values.resolution),
    outcome: optionalText(values.outcome),
    outcomeDate: optionalDate(values.outcomeDate),
    appealOutcomeReason: optionalText(values.appealOutcomeReason),
    active: values.active,
  }
}

function getAppealLabel(item: Appeal, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.appealLevel, item.appealStatus, formatDate(item.appealDeadline)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createAppealTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Appeal>> {
  return [
    {
      key: 'record',
      header: 'Appeal',
      sortField: 'appealLevel',
      exportValue: (item) => getAppealLabel(item, referenceOptions),
      render: (item) => getAppealLabel(item, referenceOptions),
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
      key: 'appealCategory',
      header: 'Category',
      filterable: true,
      field: 'appealCategory',
      sortField: 'appealCategory',
      exportValue: (item) => item.appealCategory ?? '-',
      render: (item) => item.appealCategory ?? '-',
    },
    {
      key: 'appealStatus',
      header: 'Appeal Status',
      filterable: true,
      field: 'appealStatus',
      sortField: 'appealStatus',
      exportValue: (item) => item.appealStatus ?? '-',
      render: (item) => item.appealStatus ?? '-',
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

function renderDisplayValue(value: ReactNode) {
  return typeof value === 'string' && !value.trim() ? '-' : value ?? '-'
}

function renderSection(items: Array<[string, ReactNode]>) {
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
            {renderDisplayValue(value)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function renderAppealDetails(item: Appeal, referenceOptions: RcmReferenceOptions = {}) {
  return <AppealDetailsPanel item={item} referenceOptions={referenceOptions} />
}

function safeEntries(value?: Array<Record<string, unknown>>) {
  return Array.isArray(value) ? value : []
}

function textValue(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  if (value instanceof Date) return formatDate(value)
  if (typeof value === 'object') return JSON.stringify(value, null, 2)
  return String(value)
}

function FileReferenceLink({ reference, label }: { reference?: unknown; label?: unknown }) {
  const referenceText = typeof reference === 'string' ? reference.trim() : ''
  const labelText = typeof label === 'string' && label.trim() ? label.trim() : referenceText.split('/').pop() || 'View file'

  if (!referenceText) {
    return <span>-</span>
  }

  return (
    <a
      href={resolveApiAssetUrl(referenceText)}
      target="_blank"
      rel="noreferrer"
      className="inline-flex max-w-full items-center justify-end break-all text-sm font-semibold text-[var(--color-primary)] underline-offset-2 hover:underline"
    >
      {labelText}
    </a>
  )
}

function StatusPill({ children }: { children: string }) {
  return (
    <span className="inline-flex rounded-full border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-strong)]">
      {children || '-'}
    </span>
  )
}

function MiniTable({ rows, columns, empty }: { rows: Array<Record<string, unknown>>; columns: string[]; empty: string }) {
  if (!rows.length) {
    return <div className="rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-sm font-medium text-[var(--color-text-muted)]">{empty}</div>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      <div className="max-w-full overflow-x-auto">
      <table className="divide-y divide-[var(--color-border)] text-sm" style={{ minWidth: Math.max(760, columns.length * 170) }}>
        <thead className="bg-[var(--color-surface-muted)]">
          <tr>
            {columns.map((column) => (
              <th key={column} className="whitespace-nowrap px-3 py-2 text-left text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
                {column.replace(/([A-Z])/g, ' $1')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)]">
          {rows.map((row, index) => (
            <tr key={`${columns.map((column) => textValue(row[column])).join('-')}-${index}`}>
              {columns.map((column) => (
                <td key={column} className="max-w-[20rem] px-3 py-2 align-top text-[var(--color-text-strong)]">
                  {column === 'fileReference' || column === 'proofDocumentReference' ? (
                    <FileReferenceLink reference={row[column]} label={row.fileName ?? row.documentType} />
                  ) : (
                    <span className="line-clamp-3 whitespace-pre-wrap break-words">{textValue(row[column])}</span>
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  )
}

function AppealDetailsPanel({ item, referenceOptions }: { item: Appeal; referenceOptions: RcmReferenceOptions }) {
  const tabs = ['Overview', 'Readiness', 'Packet', 'Documents', 'Correspondence', 'Timeline', 'Decision', 'Audit History'] as const
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>('Overview')
  const activeDocuments = safeEntries(item.supportingDocumentsMetadata).filter((entry) => String(entry.status ?? 'ACTIVE') === 'ACTIVE')
  const packetSnapshot = item.packetSnapshot ?? {}
  const aiHistory = safeEntries(item.aiPacketHistory)
  const statusHistory = safeEntries(item.statusHistory)
  const correspondence = safeEntries(item.correspondenceHistory)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`rounded-md border px-3 py-2 text-sm font-semibold ${
              activeTab === tab
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-strong)]'
            }`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Overview' && (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <StatusPill>{item.appealStatus ?? 'DRAFT'}</StatusPill>
            <StatusPill>{item.packetStatus ?? 'DRAFT'}</StatusPill>
            <StatusPill>{item.readinessStatus ?? 'Not reviewed'}</StatusPill>
            <StatusPill>{item.deadlineStatus ?? 'Deadline unknown'}</StatusPill>
            <StatusPill>{item.outcome ?? 'No decision'}</StatusPill>
          </div>
          {renderSection([
            ['appeal ID', item.appealId],
            ['denial ID', item.denialId ?? '-'],
            ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
            ['ar Work Item ID', formatReferenceLabel(referenceOptions.arWorkItems, item.arWorkItemId)],
            ['payer', formatReferenceLabel(referenceOptions.payers, item.payerId)],
            ['denial Code', item.denialCode ?? '-'],
            ['appeal Category', item.appealCategory ?? '-'],
            ['owner', item.owner ?? '-'],
            ['appeal Level', item.appealLevel ?? '-'],
            ['appeal Reason', item.appealReason ?? '-'],
            ['appeal Description', item.appealDescription ?? '-'],
            ['due Date', formatDate(item.dueDate)],
            ['days Remaining', formatNumber(item.daysRemaining)],
            ['recovered Amount', formatNumber(item.recoveredAmount)],
            ['recovery Percent', formatNumber(item.recoveryPercent)],
            ['active', formatBoolean(item.active)],
          ])}
        </section>
      )}

      {activeTab === 'Readiness' && (
        <section className="space-y-3">
          {renderSection([
            ['readiness Status', item.readinessStatus ?? '-'],
            ['deadline Status', item.deadlineStatus ?? '-'],
            ['days Remaining', formatNumber(item.daysRemaining)],
            ['readiness Review', item.readinessReview ? JSON.stringify(item.readinessReview, null, 2) : '-'],
          ])}
        </section>
      )}

      {activeTab === 'Packet' && (
        <section className="space-y-3">
          {renderSection([
            ['packet Status', item.packetStatus ?? '-'],
            ['packet Generated', formatBoolean(item.packetGenerated)],
            ['packet Generated At', formatDate(item.packetGeneratedAt)],
            ['packet Version', formatNumber(item.packetVersion)],
            ['packet File', <FileReferenceLink reference={item.packetFileReference} label={item.packetFileName ?? 'Generated appeal packet'} />],
            ['final Packet Generated At', formatDate(item.finalPacketGeneratedAt)],
            ['final Packet Version', formatNumber(item.finalPacketVersion)],
            ['final Packet File', <FileReferenceLink reference={item.finalPacketFileReference} label={item.finalPacketFileName ?? 'Final appeal packet'} />],
            ['diagnosis Codes', (item.diagnosisCodes ?? []).join(', ') || '-'],
            ['procedure Codes', (item.procedureCodes ?? []).join(', ') || '-'],
            ['medical Necessity Notes', item.medicalNecessityNotes ?? '-'],
            ['authorization Evidence', item.authorizationEvidence ?? '-'],
            ['eligibility Evidence', item.eligibilityEvidence ?? '-'],
            ['evidence Summary', item.evidenceSummary ?? '-'],
            ['appeal Letter', item.generatedAppealLetterText ?? '-'],
            ['packet Snapshot', Object.keys(packetSnapshot).length ? JSON.stringify(packetSnapshot, null, 2) : '-'],
          ])}
          <RcmAiInsightSection title="AI Appeal Packet Draft" variant="appeal" insight={item.aiPacketDraft} history={aiHistory} />
        </section>
      )}

      {activeTab === 'Documents' && (
        <MiniTable
          rows={activeDocuments}
          columns={['documentType', 'fileName', 'status', 'version', 'uploadedAt', 'uploadedBy', 'fileReference']}
          empty="No active appeal documents recorded."
        />
      )}

      {activeTab === 'Correspondence' && (
        <MiniTable
          rows={correspondence}
          columns={['correspondenceType', 'timestamp', 'status', 'channel', 'trackingNumber', 'confirmationNumber', 'destination', 'notes']}
          empty="No payer correspondence recorded."
        />
      )}

      {activeTab === 'Timeline' && (
        <MiniTable
          rows={statusHistory}
          columns={['timestamp', 'previousStatus', 'newStatus', 'source', 'reason', 'relatedPaymentPostingId', 'relatedEraId']}
          empty="No appeal status timeline recorded."
        />
      )}

      {activeTab === 'Decision' && (
        <section className="space-y-3">
          {renderSection([
            ['outcome', item.outcome ?? '-'],
            ['outcome Date', formatDate(item.outcomeDate)],
            ['decision At', formatDate(item.decisionAt)],
            ['decision Notes', item.decisionNotes ?? '-'],
            ['submission Channel', item.submissionChannel ?? item.submissionMethod ?? '-'],
            ['submission Proof', item.submissionProof ? JSON.stringify(item.submissionProof, null, 2) : '-'],
            ['proof Document', <FileReferenceLink reference={item.submissionProof?.proofDocumentReference} label="Submission proof document" />],
            ['payer Response', item.payerResponse ?? '-'],
            ['resolution', item.resolution ?? '-'],
            ['expected Reprocess By', formatDate(item.expectedReprocessBy)],
            ['related Payment Posting', item.relatedPaymentPostingId ?? '-'],
            ['related ERA', item.relatedEraId ?? '-'],
            ['appeal Outcome Reason', item.appealOutcomeReason ?? '-'],
          ])}
        </section>
      )}

      {activeTab === 'Audit History' && (
        <section className="space-y-3">
          <MiniTable
            rows={[...statusHistory, ...correspondence, ...safeEntries(item.supportingDocumentsMetadata)].sort((left, right) =>
              new Date(String(left.timestamp ?? left.uploadedAt ?? left.recordedAt ?? 0)).getTime()
              - new Date(String(right.timestamp ?? right.uploadedAt ?? right.recordedAt ?? 0)).getTime()
            )}
            columns={['timestamp', 'uploadedAt', 'source', 'status', 'newStatus', 'documentType', 'fileName', 'reason', 'notes']}
            empty="No appeal audit timeline details recorded on this record."
          />
        </section>
      )}
    </div>
  )
}

export function renderAppealGridItem(item: Appeal, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getAppealLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">appeal Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.appealStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
