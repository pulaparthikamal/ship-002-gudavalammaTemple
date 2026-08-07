import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { DocumentationComplianceAlert } from '@/types/documentationComplianceAlert'

export interface DocumentationComplianceAlertFormValues {
  _id?: string
}

export type DocumentationComplianceAlertCreatePayload = Record<string, never>
export type DocumentationComplianceAlertUpdatePayload = Record<string, never>

export const documentationComplianceAlertFormSchema = z.object({
  _id: z.string().optional(),
}) as z.ZodType<DocumentationComplianceAlertFormValues>

export const documentationComplianceAlertDefaultValues: DocumentationComplianceAlertFormValues = {
  _id: '',
}

export function createDocumentationComplianceAlertFormConfig(): CrudFormConfig<DocumentationComplianceAlertFormValues> {
  return {
    schema: documentationComplianceAlertFormSchema,
    defaultValues: documentationComplianceAlertDefaultValues,
    columns: 1,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    ],
  }
}

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(dateValue.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function shortRef(value?: string) {
  if (!value) {
    return '-'
  }

  return value.length > 14 ? `...${value.slice(-10)}` : value
}

function statusClass(status?: string) {
  const value = status?.toUpperCase()
  if (value === 'FAIL') return 'border-red-200 bg-red-50 text-red-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function severityClass(severity?: string) {
  const value = severity?.toUpperCase()
  if (value === 'HIGH') return 'border-red-200 bg-red-50 text-red-700'
  if (value === 'MEDIUM') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-sky-200 bg-sky-50 text-sky-700'
}

function deliveryClass(status?: string) {
  const value = status?.toUpperCase()
  if (value === 'FAILED') return 'border-red-200 bg-red-50 text-red-700'
  if (value === 'DELIVERED') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  return 'border-neutral-200 bg-neutral-50 text-neutral-700'
}

function Badge({ value, className }: { value?: string; className: string }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-md border px-2 py-0.5 text-xs font-semibold ${className}`}>
      {value || '-'}
    </span>
  )
}

function RecordLabel({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-[var(--color-text-strong)]">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{subtitle}</div> : null}
    </div>
  )
}

function DocumentList({ documents }: { documents: string[] }) {
  if (!documents.length) {
    return <span className="text-xs text-[var(--color-text-muted)]">-</span>
  }

  return (
    <div className="flex max-w-md flex-wrap gap-1">
      {documents.slice(0, 3).map((document) => (
        <span
          key={document}
          className="inline-flex rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)]"
        >
          {document}
        </span>
      ))}
      {documents.length > 3 ? (
        <span className="inline-flex rounded-md border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
          +{documents.length - 3}
        </span>
      ) : null}
    </div>
  )
}

export function getDocumentationComplianceAlertLabel(item: DocumentationComplianceAlert) {
  return [shortRef(item.claimId), item.status, item.missingDocuments.join(', ')].filter(Boolean).join(' / ')
}

export function createDocumentationComplianceAlertTableColumns(): Array<CrudTableColumn<DocumentationComplianceAlert>> {
  return [
    {
      key: 'claim',
      header: 'Claim',
      sortField: 'claimId',
      filterable: true,
      filter: { key: 'claimId', type: 'contains', placeholder: 'Search claim' },
      exportValue: (item) => item.claimId,
      render: (item) => (
        <RecordLabel
          title={shortRef(item.claimId)}
          subtitle={`Alert ${shortRef(item.alertId || item._id)}`}
        />
      ),
    },
    {
      key: 'missingDocuments',
      header: 'Missing Documents',
      sortField: 'missingDocuments',
      filterable: true,
      filter: { key: 'missingDocuments', type: 'contains', placeholder: 'Search documents' },
      exportValue: (item) => item.missingDocuments.join(', '),
      render: (item) => <DocumentList documents={item.missingDocuments} />,
    },
    {
      key: 'requiredDocuments',
      header: 'Required Documents',
      exportValue: (item) => item.requiredDocuments.join(', '),
      render: (item) => <DocumentList documents={item.requiredDocuments} />,
    },
    {
      key: 'matchedDocuments',
      header: 'Matched',
      exportValue: (item) => item.matchedDocuments.join(', '),
      render: (item) => <DocumentList documents={item.matchedDocuments} />,
    },
    {
      key: 'status',
      header: 'Status',
      sortField: 'status',
      filterable: true,
      filter: {
        key: 'status',
        type: 'eq',
        input: 'select',
        options: [
          { label: 'Fail', value: 'FAIL' },
          { label: 'Pass', value: 'PASS' },
        ],
      },
      exportValue: (item) => item.status,
      render: (item) => <Badge value={item.status} className={statusClass(item.status)} />,
    },
    {
      key: 'severity',
      header: 'Severity',
      sortField: 'severity',
      filterable: true,
      filter: {
        key: 'severity',
        type: 'eq',
        input: 'select',
        options: [
          { label: 'Low', value: 'LOW' },
          { label: 'Medium', value: 'MEDIUM' },
          { label: 'High', value: 'HIGH' },
        ],
      },
      exportValue: (item) => item.severity,
      render: (item) => <Badge value={item.severity} className={severityClass(item.severity)} />,
    },
    {
      key: 'zapier',
      header: 'Zapier',
      sortField: 'zapierDeliveryStatus',
      filterable: true,
      filter: {
        key: 'zapierDeliveryStatus',
        type: 'eq',
        input: 'select',
        options: [
          { label: 'Delivered', value: 'DELIVERED' },
          { label: 'Failed', value: 'FAILED' },
        ],
      },
      exportValue: (item) => item.zapierDeliveryStatus ?? '',
      render: (item) => <Badge value={item.zapierDeliveryStatus} className={deliveryClass(item.zapierDeliveryStatus)} />,
    },
    {
      key: 'created',
      header: 'Created',
      sortField: 'created',
      sortable: true,
      exportValue: (item) => formatDateTime(item.createdAt),
      render: (item) => formatDateTime(item.createdAt),
    },
    {
      key: 'updated',
      header: 'Updated',
      sortField: 'updated',
      sortable: true,
      exportValue: (item) => formatDateTime(item.updatedAt),
      render: (item) => formatDateTime(item.updatedAt),
    },
  ]
}

function DetailFact({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-2 break-words text-sm font-medium text-[var(--color-text-strong)]">{value ?? '-'}</dd>
    </div>
  )
}

function DetailDocumentList({ label, documents }: { label: string; documents: string[] }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-3">
        <DocumentList documents={documents} />
      </dd>
    </div>
  )
}

export function renderDocumentationComplianceAlertDetails(item: DocumentationComplianceAlert) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DetailFact label="Claim ID" value={item.claimId} />
        <DetailFact label="Status" value={item.status} />
        <DetailFact label="Severity" value={item.severity} />
        <DetailFact label="Zapier Delivery" value={item.zapierDeliveryStatus} />
        <DetailFact label="Last Zapier Alert" value={formatDateTime(item.lastZapierTriggeredAt)} />
        <DetailFact label="Updated" value={formatDateTime(item.updatedAt)} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <DetailDocumentList label="Missing Documents" documents={item.missingDocuments} />
        <DetailDocumentList label="Required Documents" documents={item.requiredDocuments} />
        <DetailDocumentList label="Matched Documents" documents={item.matchedDocuments} />
      </div>

      {item.zapierDeliveryError ? (
        <div className="grid gap-4">
          <DetailFact label="Zapier Error" value={item.zapierDeliveryError} />
        </div>
      ) : null}
    </div>
  )
}

export function renderDocumentationComplianceAlertGridItem(item: DocumentationComplianceAlert) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <RecordLabel title={shortRef(item.claimId)} subtitle={`${item.missingDocuments.length} missing`} />
        <Badge value={item.status} className={statusClass(item.status)} />
      </div>
      <DocumentList documents={item.missingDocuments} />
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-muted)]">
        <span>Severity</span>
        <span className="text-right font-semibold text-[var(--color-text-strong)]">{item.severity}</span>
        <span>Zapier</span>
        <span className="text-right">{item.zapierDeliveryStatus ?? '-'}</span>
      </div>
    </div>
  )
}

export function mapDocumentationComplianceAlertToFormValues(
  item: DocumentationComplianceAlert,
): DocumentationComplianceAlertFormValues {
  return { _id: item._id }
}

export function mapDocumentationComplianceAlertFormToPayload(): DocumentationComplianceAlertCreatePayload {
  return {}
}
