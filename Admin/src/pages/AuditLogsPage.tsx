import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ChevronDown, ChevronRight, Download, Eye, History, Maximize2, RefreshCw, Search, X } from 'lucide-react'
import { CommonTable } from '@/components/crud/CommonTable'
import { apiClient } from '@/services/api/axiosInstance'
import { auditLogApiDetails } from '@/models/auditLogModel'
import {
  useGetRcmAuditAppointmentSummariesQuery,
  useGetRcmAuditLogAppointmentTimelineQuery,
  useGetRcmAuditLogsQuery,
  type RcmAuditAppointmentSummary,
  type RcmAuditLogQuery,
  type RcmAuditSummaryQuery,
} from '@/services/api/endpoints/auditLogsApi'
import type { AuditLog } from '@/types/auditLog'
import type { CrudListQuery, CrudTableColumn } from '@/types/crud'

type AuditTab = 'appointments' | 'raw'
type DetailMode =
  | { type: 'appointment'; id: string; summary?: RcmAuditAppointmentSummary }
  | { type: 'event'; event: AuditLog }
  | null

const filterKeys: Array<keyof RcmAuditSummaryQuery> = [
  'search',
  'entityType',
  'action',
  'severity',
  'category',
  'source',
  'user',
  'claimId',
  'appointmentId',
  'correlationId',
  'financialEventId',
  'submissionId',
  'payerId',
  'patientId',
  'providerId',
  'facilityId',
  'status',
  'currentStage',
  'hasOpenRisks',
  'dateFrom',
  'dateTo',
  'defaultDateRange',
]

const tabs: Array<{ key: AuditTab; label: string }> = [
  { key: 'appointments', label: 'Appointment History' },
  { key: 'raw', label: 'Raw Audit Events' },
]

const quickFilters: Array<{ label: string; patch: Partial<RcmAuditSummaryQuery> }> = [
  { label: 'Open Risks', patch: { hasOpenRisks: 'true' } },
  { label: 'Claim Events', patch: { category: 'CLAIM' } },
  { label: 'Financial Events', patch: { category: 'PAYMENT' } },
  { label: 'Denial/Appeal', patch: { category: 'DENIAL' } },
  { label: 'Webhook Errors', patch: { category: 'CLEARINGHOUSE', severity: 'ERROR' } },
  { label: 'Queue Failures', patch: { category: 'QUEUE', severity: 'ERROR' } },
  { label: 'Closure Events', patch: { category: 'CLOSURE' } },
]

function formatDate(value?: string | Date) {
  if (!value) return '-'
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? date.toLocaleString() : '-'
}

function compact(value: unknown, fallback = '-') {
  if (value === undefined || value === null || value === '') return fallback
  return String(value)
}

function shortRef(value: unknown, fallback = '-') {
  const text = compact(value, '')
  if (!text) return fallback
  return text.length > 10 ? `...${text.slice(-8)}` : text
}

function referenceLine(label: string, value: unknown) {
  return value ? `${label} ${shortRef(value)}` : '-'
}

function jsonText(value: unknown) {
  if (value === undefined || value === null || value === '') return '-'
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function badgeClass(kind?: string) {
  const value = String(kind ?? '').toUpperCase()
  if (value === 'CRITICAL' || value === 'ERROR') return 'border-red-200 bg-red-50 text-red-700'
  if (value === 'WARNING' || value === 'NEEDS REVIEW') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (value === 'CLOSED' || value === 'COMPLIANCE_VISIBLE') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (value === 'TECHNICAL_DEBUG_ONLY') return 'border-slate-200 bg-slate-50 text-slate-600'
  return 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

function Badge({ value }: { value?: string }) {
  return <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${badgeClass(value)}`}>{compact(value)}</span>
}

function TablePrimaryText({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-[var(--color-text-strong)]">{title}</div>
      {subtitle ? <div className="mt-0.5 truncate text-xs text-[var(--color-text-muted)]">{subtitle}</div> : null}
    </div>
  )
}

function toCommonQuery(filters: RcmAuditSummaryQuery): CrudListQuery {
  return {
    page: Number(filters.page ?? 1) || 1,
    limit: Number(filters.limit ?? 25) || 25,
    sortfield: undefined,
    direction: 'desc',
    criteria: [],
  }
}

function applyCommonQueryToFilters(
  current: RcmAuditSummaryQuery,
  nextQuery: CrudListQuery,
): RcmAuditSummaryQuery {
  const next: RcmAuditSummaryQuery = {
    ...current,
    page: nextQuery.page,
    limit: nextQuery.limit,
  }

  for (const criterion of nextQuery.criteria) {
    if (filterKeys.includes(criterion.key as keyof RcmAuditSummaryQuery)) {
      next[criterion.key as keyof RcmAuditSummaryQuery] = String(criterion.value) as never
    }
  }

  return next
}

function actionLabel(value?: string) {
  return compact(value).replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function isDerivedEvent(event: AuditLog) {
  return event.source === 'derivedLifecycle' || Boolean((event.newState as { derivedLifecycleMarker?: boolean } | undefined)?.derivedLifecycleMarker)
}

function isRiskEvent(event: AuditLog) {
  const severity = String(event.severity ?? '').toUpperCase()
  const action = String(event.action ?? '').toUpperCase()
  return ['WARNING', 'ERROR', 'CRITICAL'].includes(severity)
    || action.includes('DENIAL')
    || action.includes('REJECTED')
    || action.includes('FAILED')
    || action.includes('EXCEPTION')
    || action.includes('IMBALANCE')
}

function timelineStats(sections: Array<{ section: string; events: AuditLog[] }>) {
  const events = sections.flatMap((section) => section.events)
  return {
    total: events.length,
    persisted: events.filter((event) => !isDerivedEvent(event)).length,
    derived: events.filter(isDerivedEvent).length,
    risks: events.filter(isRiskEvent).length,
    completedSections: sections.length,
  }
}

function rowsFromTimeline(data: unknown) {
  if (!data || typeof data !== 'object') return []
  const timeline = data as { sections?: Array<{ section: string; events: AuditLog[] }>; groups?: Record<string, AuditLog[]> }
  if (Array.isArray(timeline.sections)) return timeline.sections
  const fallbackLabels: Record<string, string> = {
    appointment: 'Appointment',
    encounter: 'Encounter',
    charge: 'Charge / Coding',
    codingReview: 'Charge / Coding',
    readiness: 'Charge / Coding',
    claim: 'Claim',
    submission: 'Submission / ACK',
    acknowledgementTracking: 'Submission / ACK',
    era: 'ERA / Payment',
    payment: 'ERA / Payment',
    denial: 'Denial / Appeal',
    appeal: 'Denial / Appeal',
    correctedClaim: 'Denial / Appeal',
    ar: 'Denial / Appeal',
    patientBilling: 'Patient Balance',
    refund: 'Patient Balance',
    collection: 'Patient Balance',
    closure: 'Closure',
    other: 'Other',
  }
  const grouped = Object.entries(timeline.groups ?? {}).reduce<Record<string, AuditLog[]>>((next, [key, events]) => {
    if (!events.length) return next
    const label = fallbackLabels[key] ?? key
    next[label] = [...(next[label] ?? []), ...events]
    return next
  }, {})
  return Object.entries(grouped)
    .filter(([, events]) => events.length)
    .map(([section, events]) => ({ section, events }))
}

const lifecycleSteps = [
  'Appointment',
  'Encounter',
  'Charge / Coding',
  'Claim',
  'Submission / ACK',
  'ERA / Payment',
  'Denial / Appeal',
  'Patient Balance',
  'Closure',
]

function LifecycleProgress({ sections }: { sections: Array<{ section: string; events: AuditLog[] }> }) {
  const sectionByName = new Map(sections.map((section) => [section.section, section]))
  return (
    <div className="mb-5 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
      <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-9">
        {lifecycleSteps.map((step) => {
          const section = sectionByName.get(step)
          const count = section?.events.length ?? 0
          const risks = section?.events.filter(isRiskEvent).length ?? 0
          const done = count > 0
          return (
            <div key={step} className={`rounded-md border p-3 ${done ? 'border-emerald-200 bg-emerald-50/70' : 'border-[var(--color-border)] bg-[var(--color-surface)]'}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-xs font-semibold ${done ? 'text-emerald-800' : 'text-[var(--color-text-muted)]'}`}>{step}</span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${risks ? 'bg-amber-100 text-amber-800' : done ? 'bg-emerald-100 text-emerald-800' : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'}`}>
                  {count}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                <div className={`h-full ${done ? risks ? 'bg-amber-500' : 'bg-emerald-500' : 'bg-transparent'}`} style={{ width: done ? '100%' : '0%' }} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EventDetail({ item }: { item: AuditLog }) {
  const isDerived = isDerivedEvent(item)
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Selected Event</p>
        <h3 className="mt-1 break-words text-base font-semibold text-[var(--color-text-strong)]">{actionLabel(item.action)}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge value={item.severity ?? 'INFO'} />
        <Badge value={item.category ?? 'CLAIM'} />
        <Badge value={item.visibility ?? 'OPERATIONAL_VISIBLE'} />
        {isDerived && <span className="inline-flex rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-semibold text-sky-700">Derived lifecycle marker</span>}
      </div>
      <dl className="grid min-w-0 gap-3 text-sm">
        {[
          ['Timestamp', formatDate(item.timestamp ?? item.createdAt)],
          ['Entity', `${compact(item.entityType)} ${compact(item.entityId)}`],
          ['Claim ID', item.claimId],
          ['Appointment ID', item.appointmentId],
          ['Patient Ref', item.patientId],
          ['Payer', item.payerId],
          ['Submission', item.submissionId],
          ['Financial Event', item.financialEventId],
          ['Source', item.source ?? item.sourceModule],
          ['User/System', item.userName ?? item.changedBy ?? item.userId ?? 'system'],
          ['Reason', item.reason],
          ['Correlation', item.correlationId],
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-3">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
            <dd className="mt-1 break-words text-[var(--color-text)]">{compact(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="grid min-w-0 gap-4">
        <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-strong)]">Before</h3>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-[var(--color-text)]">{jsonText(item.previousState ?? item.oldValue)}</pre>
        </section>
        <section className="min-w-0 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4">
          <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-strong)]">After</h3>
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap text-xs text-[var(--color-text)]">{jsonText(item.newState ?? item.newValue)}</pre>
        </section>
      </div>
    </div>
  )
}

function TimelineSection({
  section,
  events,
  selectedId,
  onSelect,
}: {
  section: string
  events: AuditLog[]
  selectedId?: string
  onSelect: (event: AuditLog) => void
}) {
  const [open, setOpen] = useState(true)
  const risks = events.filter(isRiskEvent).length
  const derived = events.filter(isDerivedEvent).length
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left" onClick={() => setOpen((value) => !value)}>
        <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-strong)]">
          {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          {section}
        </span>
        <span className="flex items-center gap-2 text-xs font-semibold text-[var(--color-text-muted)]">
          {risks > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-amber-800">{risks} risk</span>}
          {derived > 0 && <span className="rounded-md bg-sky-100 px-2 py-0.5 text-sky-800">{derived} derived</span>}
          <span>{events.length}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-2 border-t border-[var(--color-border)] px-4 py-3">
          {events.map((event, index) => (
            <button
              key={event._id}
              type="button"
              className={`relative grid w-full min-w-0 gap-3 rounded-md border px-3 py-3 text-left text-sm hover:bg-[var(--color-surface-muted)] md:grid-cols-[42px_minmax(130px,170px)_minmax(0,1fr)_auto] ${selectedId === event._id ? 'border-[var(--color-primary)] bg-[var(--color-surface-muted)]' : 'border-[var(--color-border)]'}`}
              onClick={() => onSelect(event)}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-xs font-semibold text-[var(--color-text-muted)]">{index + 1}</span>
              <span className="min-w-0 text-xs text-[var(--color-text-muted)]">{formatDate(event.timestamp ?? event.createdAt)}</span>
              <span className="min-w-0 overflow-hidden">
                <span className="block truncate font-semibold text-[var(--color-text-strong)]">{actionLabel(event.action)}</span>
                <span className="block truncate text-xs text-[var(--color-text-muted)]">{event.reason ?? event.source ?? '-'}</span>
              </span>
              <span className="justify-self-start md:justify-self-end"><Badge value={event.severity ?? 'INFO'} /></span>
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

function AuditWorkspaceStats({ sections }: { sections: Array<{ section: string; events: AuditLog[] }> }) {
  const stats = timelineStats(sections)
  return (
    <div className="mb-5 grid gap-3 md:grid-cols-5">
      {[
        ['Total events', stats.total],
        ['Persisted logs', stats.persisted],
        ['Derived markers', stats.derived],
        ['Risk events', stats.risks],
        ['Sections', `${stats.completedSections}/${lifecycleSteps.length}`],
      ].map(([label, value]) => (
        <div key={label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{value}</dd>
        </div>
      ))}
    </div>
  )
}

function HistoryPanel({
  detail,
  appointmentTimeline,
  onClose,
}: {
  detail: DetailMode
  appointmentTimeline: ReturnType<typeof rowsFromTimeline>
  onClose: () => void
}) {
  const [selectedEvent, setSelectedEvent] = useState<AuditLog | null>(detail?.type === 'event' ? detail.event : null)
  useEffect(() => {
    setSelectedEvent(detail?.type === 'event' ? detail.event : null)
  }, [detail])
  const isAppointment = detail?.type === 'appointment'
  const sections = isAppointment ? appointmentTimeline : []
  const firstTimelineEvent = sections.find((section) => section.events.length)?.events[0]
  useEffect(() => {
    if (detail?.type === 'appointment' && !selectedEvent && firstTimelineEvent) {
      setSelectedEvent(firstTimelineEvent)
    }
  }, [detail, firstTimelineEvent, selectedEvent])
  if (!detail) return null

  const title = isAppointment ? 'Appointment Audit History' : 'Audit Event Details'
  const subtitle = isAppointment
    ? detail.id
    : `${compact(detail.event.entityType)} ${compact(detail.event.entityId)}`

  return (
    <div className="fixed inset-0 z-40 bg-black/35 p-3 sm:p-5">
      <section className="mx-auto flex h-full max-w-[1500px] flex-col overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-primary)] text-white">
              {isAppointment ? <History className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{subtitle}</p>
              <h2 className="truncate text-lg font-semibold text-[var(--color-text-strong)]">{title}</h2>
            </div>
          </div>
          <button type="button" className="rounded-md p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]" onClick={onClose}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-5">
          {isAppointment && detail.summary && (
            <SummaryHeader items={[
              ['Patient Ref', detail.summary.patientReference],
              ['Appointment Date', formatDate(detail.summary.appointmentDate)],
              ['Current Stage', detail.summary.currentStage],
              ['Claim ID', detail.summary.claimId],
              ['Status', detail.summary.status],
              ['Events', detail.summary.eventCount],
            ]} />
          )}

          {detail.type === 'event' && <EventDetail item={detail.event} />}

          {detail.type !== 'event' && (
            <>
              <AuditWorkspaceStats sections={sections} />
              <LifecycleProgress sections={sections} />
              <div className="grid min-w-0 gap-5 xl:grid-cols-[220px_minmax(0,1fr)] 2xl:grid-cols-[220px_minmax(0,1fr)_500px]">
                <nav className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-3">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Lifecycle Sections</p>
                  <div className="space-y-1">
                    {sections.map((group) => (
                      <button
                        key={group.section}
                        type="button"
                        className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-[var(--color-surface-muted)]"
                        onClick={() => group.events[0] && setSelectedEvent(group.events[0])}
                      >
                        <span className="font-semibold text-[var(--color-text)]">{group.section}</span>
                        <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">{group.events.length}</span>
                      </button>
                    ))}
                  </div>
                </nav>
                <div className="min-w-0 space-y-3">
                  {sections.length ? sections.map((group) => (
                    <TimelineSection key={group.section} section={group.section} events={group.events} selectedId={selectedEvent?._id} onSelect={setSelectedEvent} />
                  )) : (
                    <div className="rounded-lg border border-[var(--color-border)] p-6 text-sm text-[var(--color-text-muted)]">No visible audit history found for this record.</div>
                  )}
                </div>
                <div className="min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] p-4 2xl:sticky 2xl:top-0 2xl:max-h-[calc(100vh-170px)] 2xl:overflow-auto">
                  {selectedEvent ? <EventDetail item={selectedEvent} /> : <p className="text-sm text-[var(--color-text-muted)]">Select a timeline event to inspect previous and new state details.</p>}
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  )
}

function SummaryHeader({ items }: { items: Array<[string, unknown]> }) {
  return (
    <dl className="mb-5 grid gap-3 text-sm md:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-background)] p-3">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
          <dd className="mt-1 break-words text-[var(--color-text)]">{compact(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

const appointmentSummaryColumns: Array<CrudTableColumn<RcmAuditAppointmentSummary>> = [
  {
    key: 'visit',
    header: 'Visit',
    sortable: false,
    render: (row) => (
      <TablePrimaryText
        title={formatDate(row.appointmentDate)}
        subtitle={referenceLine('Appt', row.appointmentId)}
      />
    ),
    className: 'min-w-[220px]',
  },
  {
    key: 'patient',
    header: 'Patient',
    sortable: false,
    render: (row) => <TablePrimaryText title={shortRef(row.patientReference)} subtitle="Patient reference" />,
    className: 'min-w-[150px]',
  },
  {
    key: 'stage',
    header: 'Stage',
    sortable: false,
    render: (row) => <Badge value={row.currentStage} />,
  },
  {
    key: 'claim',
    header: 'Claim',
    sortable: false,
    render: (row) => (
      <TablePrimaryText
        title={row.claimId ? shortRef(row.claimId) : '-'}
        subtitle={row.currentClaimStatus ? `Status ${row.currentClaimStatus}` : undefined}
      />
    ),
    className: 'min-w-[160px]',
  },
  {
    key: 'links',
    header: 'Linked Records',
    sortable: false,
    render: (row) => (
      <div className="flex min-w-[220px] flex-wrap gap-1">
        {row.encounterId && <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">Enc {shortRef(row.encounterId)}</span>}
        {row.chargeId && <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs text-[var(--color-text-muted)]">Chg {shortRef(row.chargeId)}</span>}
        {!row.encounterId && !row.chargeId && <span className="text-xs text-[var(--color-text-muted)]">-</span>}
      </div>
    ),
  },
  {
    key: 'lastAuditAction',
    header: 'Last Action',
    sortable: false,
    render: (row) => <TablePrimaryText title={actionLabel(row.lastAuditAction)} subtitle={formatDate(row.lastUpdatedAt)} />,
    className: 'min-w-[210px]',
  },
  {
    key: 'eventCount',
    header: 'Events',
    sortable: false,
    render: (row) => (
      <div className="flex items-center gap-2">
        <span className="font-semibold text-[var(--color-text-strong)]">{row.eventCount}</span>
        {row.openRiskCount > 0 && <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">{row.openRiskCount} risk</span>}
      </div>
    ),
  },
  {
    key: 'status',
    header: 'Status',
    sortable: false,
    render: (row) => <Badge value={row.status ?? row.severity} />,
  },
]

const rawAuditColumns: Array<CrudTableColumn<AuditLog>> = [
  {
    key: 'timestamp',
    header: 'Timestamp',
    render: (row) => <TablePrimaryText title={formatDate(row.timestamp ?? row.createdAt)} subtitle={row.source ?? row.sourceModule} />,
    className: 'min-w-[190px]',
  },
  {
    key: 'event',
    header: 'Event',
    render: (row) => <TablePrimaryText title={actionLabel(row.action)} subtitle={compact(row.entityType)} />,
    className: 'min-w-[220px]',
  },
  {
    key: 'claim',
    header: 'Claim / Appointment',
    render: (row) => (
      <TablePrimaryText
        title={row.claimId ? `Claim ${shortRef(row.claimId)}` : '-'}
        subtitle={row.appointmentId ? `Appt ${shortRef(row.appointmentId)}` : undefined}
      />
    ),
    className: 'min-w-[180px]',
  },
  {
    key: 'patient',
    header: 'Patient Ref',
    render: (row) => shortRef(row.patientId),
  },
  {
    key: 'reason',
    header: 'Reason',
    render: (row) => <span className="block max-w-[280px] truncate text-[var(--color-text-muted)]">{compact(row.reason)}</span>,
  },
  {
    key: 'severity',
    header: 'Severity',
    render: (row) => <Badge value={row.severity ?? 'INFO'} />,
  },
]

function AppointmentSummaryTable({
  rows,
  query,
  totalRecords,
  isLoading,
  onQueryChange,
  onSelect,
}: {
  rows: RcmAuditAppointmentSummary[]
  query: CrudListQuery
  totalRecords: number
  isLoading?: boolean
  onQueryChange: (query: CrudListQuery) => void
  onSelect: (row: RcmAuditAppointmentSummary) => void
}) {
  if (!rows.length) return <EmptyState message="No appointment audit records match the current filters." />
  return (
    <CommonTable
      data={rows}
      query={query}
      totalRecords={totalRecords}
      columns={appointmentSummaryColumns}
      getRowId={(row) => row.appointmentId}
      onQueryChange={onQueryChange}
      actions={[{
        label: 'View History',
        icon: <Eye className="h-4 w-4" />,
        onClick: onSelect,
      }]}
      emptyMessage="No appointment audit records match the current filters."
      isLoading={isLoading}
    />
  )
}

function RawAuditTable({
  rows,
  query,
  totalRecords,
  isLoading,
  onQueryChange,
  onSelect,
}: {
  rows: AuditLog[]
  query: CrudListQuery
  totalRecords: number
  isLoading?: boolean
  onQueryChange: (query: CrudListQuery) => void
  onSelect: (item: AuditLog) => void
}) {
  if (!rows.length) return <EmptyState message="No raw audit events match the current filters." />
  return (
    <CommonTable
      data={rows}
      query={query}
      totalRecords={totalRecords}
      columns={rawAuditColumns}
      getRowId={(row) => row._id}
      onQueryChange={onQueryChange}
      actions={[{
        label: 'View Details',
        icon: <Eye className="h-4 w-4" />,
        onClick: onSelect,
      }]}
      emptyMessage="No raw audit events match the current filters."
      isLoading={isLoading}
    />
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">{message}</div>
}

export function AuditLogsPage() {
  const [searchParams] = useSearchParams()
  const initialFilters = useMemo<RcmAuditSummaryQuery>(() => {
    const next: RcmAuditSummaryQuery = { page: 1, limit: 25 }
    filterKeys.forEach((key) => {
      const value = searchParams.get(key)
      if (value) next[key] = value as never
    })
    return next
  }, [searchParams])
  const [filters, setFilters] = useState<RcmAuditSummaryQuery>(initialFilters)
  const [tab, setTab] = useState<AuditTab>('appointments')
  const [detail, setDetail] = useState<DetailMode>(null)
  const [hasNewEvents, setHasNewEvents] = useState(false)
  const firstEventIdRef = useRef<string | null>(null)

  const appointmentSummaryQuery = useGetRcmAuditAppointmentSummariesQuery(filters)
  const rawQueryParams: RcmAuditLogQuery = filters
  const rawAuditQuery = useGetRcmAuditLogsQuery(rawQueryParams)
  const selectedAppointmentId = detail?.type === 'appointment' ? detail.id : ''
  const appointmentTimelineQuery = useGetRcmAuditLogAppointmentTimelineQuery(
    { appointmentId: selectedAppointmentId, query: { limit: 5000, defaultDateRange: 'none' } },
    { skip: !selectedAppointmentId },
  )

  const rawEvents = rawAuditQuery.data?.data ?? []
  const activePagination = tab === 'appointments'
    ? appointmentSummaryQuery.data?.pagination
    : rawAuditQuery.data?.pagination
  const commonQuery = useMemo(() => toCommonQuery(filters), [filters])
  const handleCommonQueryChange = (nextQuery: CrudListQuery) => {
    setFilters((current) => applyCommonQueryToFilters(current, nextQuery))
  }

  useEffect(() => {
    const firstId = rawEvents[0]?._id
    if (!firstId) return
    if (firstEventIdRef.current && firstEventIdRef.current !== firstId) setHasNewEvents(true)
    firstEventIdRef.current = firstId
  }, [rawEvents])

  function updateFilter(key: keyof RcmAuditSummaryQuery, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined, page: 1 }))
  }

  async function exportAuditLogs() {
    const response = await apiClient.get(`${auditLogApiDetails.endpoint}/export`, {
      params: filters,
      responseType: 'blob',
    })
    const href = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = href
    link.download = 'rcm-audit-logs.csv'
    link.click()
    URL.revokeObjectURL(href)
  }

  function refetchActive() {
    setHasNewEvents(false)
    appointmentSummaryQuery.refetch()
    rawAuditQuery.refetch()
    if (selectedAppointmentId) appointmentTimelineQuery.refetch()
  }

  return (
    <main className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">RCM Audit Logs</h1>
        </div>
        <div className="flex items-center gap-2">
          {hasNewEvents && <span className="rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800">New events</span>}
          <button type="button" className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" onClick={refetchActive}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button type="button" className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white" onClick={exportAuditLogs}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
          <label className="md:col-span-2 text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            Search
            <div className="mt-1 flex items-center rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-2">
              <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
              <input className="w-full bg-transparent px-2 py-2 text-sm normal-case text-[var(--color-text)] outline-none" value={filters.search ?? ''} onChange={(event) => updateFilter('search', event.target.value)} />
            </div>
          </label>
          {[
            ['appointmentId', 'Appointment ID'],
            ['claimId', 'Claim ID'],
            ['patientId', 'Patient Ref'],
            ['payerId', 'Payer'],
            ['providerId', 'Provider'],
            ['facilityId', 'Facility'],
            ['status', 'Status'],
            ['currentStage', 'Stage'],
            ['severity', 'Severity'],
            ['category', 'Category'],
            ['source', 'Source'],
            ['user', 'User'],
            ['correlationId', 'Correlation'],
            ['financialEventId', 'Financial Event'],
            ['submissionId', 'Submission'],
            ['dateFrom', 'From'],
            ['dateTo', 'To'],
          ].map(([key, label]) => (
            <label key={key} className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              {label}
              <input
                type={key.startsWith('date') ? 'date' : 'text'}
                className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm normal-case text-[var(--color-text)]"
                value={String(filters[key as keyof RcmAuditSummaryQuery] ?? '')}
                onChange={(event) => updateFilter(key as keyof RcmAuditSummaryQuery, event.target.value)}
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {quickFilters.map((item) => (
            <button key={item.label} type="button" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:border-[var(--color-primary)]" onClick={() => setFilters((current) => ({ ...current, ...item.patch, page: 1 }))}>
              {item.label}
            </button>
          ))}
          {tab === 'raw' && (
            <label className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)]">
              <input type="checkbox" checked={filters.includeTechnical === 'true'} onChange={(event) => updateFilter('includeTechnical', event.target.checked ? 'true' : '')} />
              Include technical
            </label>
          )}
          <button type="button" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text-muted)]" onClick={() => setFilters({ page: 1, limit: 25 })}>
            Clear
          </button>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`rounded-md px-3 py-2 text-sm font-semibold ${tab === item.key ? 'bg-[var(--color-primary)] text-white' : 'border border-[var(--color-border)]'}`}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'appointments' && (
        <AppointmentSummaryTable
          rows={appointmentSummaryQuery.data?.data ?? []}
          query={commonQuery}
          totalRecords={appointmentSummaryQuery.data?.pagination.totalCount ?? 0}
          isLoading={appointmentSummaryQuery.isFetching}
          onQueryChange={handleCommonQueryChange}
          onSelect={(row) => setDetail({ type: 'appointment', id: row.appointmentId, summary: row })}
        />
      )}
      {tab === 'raw' && (
        <RawAuditTable
          rows={rawEvents}
          query={commonQuery}
          totalRecords={rawAuditQuery.data?.pagination.totalCount ?? 0}
          isLoading={rawAuditQuery.isFetching}
          onQueryChange={handleCommonQueryChange}
          onSelect={(event) => setDetail({ type: 'event', event })}
        />
      )}

      <div className="flex items-center justify-between text-sm text-[var(--color-text-muted)]">
        <span>{activePagination?.totalCount ?? 0} records</span>
        <div className="flex items-center gap-2">
          <button type="button" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 disabled:opacity-50" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))}>Previous</button>
          <span>Page {filters.page ?? 1}</span>
          <button type="button" className="rounded-md border border-[var(--color-border)] px-3 py-1.5 disabled:opacity-50" disabled={(filters.page ?? 1) >= (activePagination?.totalPages ?? 1)} onClick={() => setFilters((current) => ({ ...current, page: (current.page ?? 1) + 1 }))}>Next</button>
        </div>
      </div>

      <HistoryPanel
        detail={detail}
        appointmentTimeline={rowsFromTimeline(appointmentTimelineQuery.data)}
        onClose={() => setDetail(null)}
      />
    </main>
  )
}
