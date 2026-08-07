import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { TimelyFilingAlert } from '@/types/timelyFilingAlert'

export interface TimelyFilingAlertFormValues {
  _id?: string
}

export type TimelyFilingAlertCreatePayload = Record<string, never>
export type TimelyFilingAlertUpdatePayload = Record<string, never>

export const timelyFilingAlertFormSchema = z.object({
  _id: z.string().optional(),
}) as z.ZodType<TimelyFilingAlertFormValues>

export const timelyFilingAlertDefaultValues: TimelyFilingAlertFormValues = {
  _id: '',
}

export function createTimelyFilingAlertFormConfig(): CrudFormConfig<TimelyFilingAlertFormValues> {
  return {
    schema: timelyFilingAlertFormSchema,
    defaultValues: timelyFilingAlertDefaultValues,
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

export function formatDate(value?: string | Date | null) {
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
  }).format(dateValue)
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
  if (value === 'EXPIRED') return 'border-red-200 bg-red-50 text-red-700'
  if (value === 'CRITICAL') return 'border-orange-200 bg-orange-50 text-orange-700'
  if (value === 'WARNING') return 'border-amber-200 bg-amber-50 text-amber-700'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
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

export function getTimelyFilingAlertLabel(item: TimelyFilingAlert) {
  return [shortRef(item.claimId), item.status, `${item.daysRemaining} days`].filter(Boolean).join(' / ')
}

export function createTimelyFilingAlertTableColumns(): Array<CrudTableColumn<TimelyFilingAlert>> {
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
      key: 'payer',
      header: 'Payer',
      field: 'payerId',
      sortField: 'payerId',
      filterable: true,
      filter: { key: 'payerId', type: 'contains', placeholder: 'Search payer' },
    },
    {
      key: 'serviceDate',
      header: 'Service Date',
      filterable: true,
      sortField: 'serviceDate',
      sortable: true,
      exportValue: (item) => formatDate(item.serviceDate),
      render: (item) => formatDate(item.serviceDate),
    },
    {
      key: 'filingDeadline',
      header: 'Deadline',
      filterable: true,
      sortField: 'filingDeadline',
      sortable: true,
      exportValue: (item) => formatDate(item.filingDeadline),
      render: (item) => formatDate(item.filingDeadline),
    },
    {
      key: 'daysRemaining',
      header: 'Days',
      filterable: true,
      field: 'daysRemaining',
      sortField: 'daysRemaining',
      sortable: true,
      className: 'text-right font-semibold',
      headerClassName: 'text-right',
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
          { label: 'Safe', value: 'SAFE' },
          { label: 'Warning', value: 'WARNING' },
          { label: 'Critical', value: 'CRITICAL' },
          { label: 'Expired', value: 'EXPIRED' },
        ],
      },
      exportValue: (item) => item.status,
      render: (item) => <Badge value={item.status} className={statusClass(item.status)} />,
    },
    {
      key: 'severity',
      header: 'Severity',
      field: 'severity',
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
          { label: 'Critical', value: 'CRITICAL' },
        ],
      },
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

export function renderTimelyFilingAlertDetails(item: TimelyFilingAlert) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <DetailFact label="Claim ID" value={item.claimId} />
        <DetailFact label="Payer ID" value={item.payerId} />
        <DetailFact label="Status" value={item.status} />
        <DetailFact label="Severity" value={item.severity} />
        <DetailFact label="Service Date" value={formatDate(item.serviceDate)} />
        <DetailFact label="Filing Deadline" value={formatDate(item.filingDeadline)} />
        <DetailFact label="Days Remaining" value={item.daysRemaining} />
        <DetailFact label="Zapier Delivery" value={item.zapierDeliveryStatus} />
        <DetailFact label="Last Zapier Alert" value={formatDateTime(item.lastZapierTriggeredAt)} />
        <DetailFact label="Updated" value={formatDateTime(item.updatedAt)} />
      </div>

      {item.zapierDeliveryError ? (
        <div className="grid gap-4">
          <DetailFact label="Zapier Error" value={item.zapierDeliveryError} />
        </div>
      ) : null}
    </div>
  )
}

export function renderTimelyFilingAlertGridItem(item: TimelyFilingAlert) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <RecordLabel title={shortRef(item.claimId)} subtitle={item.payerId} />
        <Badge value={item.status} className={statusClass(item.status)} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[var(--color-text-muted)]">
        <span>Deadline</span>
        <span className="text-right font-semibold text-[var(--color-text-strong)]">{formatDate(item.filingDeadline)}</span>
        <span>Days remaining</span>
        <span className="text-right font-semibold text-[var(--color-text-strong)]">{item.daysRemaining}</span>
        <span>Zapier</span>
        <span className="text-right">{item.zapierDeliveryStatus ?? '-'}</span>
      </div>
    </div>
  )
}

export function mapTimelyFilingAlertToFormValues(item: TimelyFilingAlert): TimelyFilingAlertFormValues {
  return { _id: item._id }
}

export function mapTimelyFilingAlertFormToPayload(): TimelyFilingAlertCreatePayload {
  return {}
}
