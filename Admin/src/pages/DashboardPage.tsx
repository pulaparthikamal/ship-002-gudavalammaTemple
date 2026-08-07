import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  DollarSign,
  FileWarning,
  ListFilter,
  PhoneCall,
  RefreshCcw,
  Search,
  SearchCheck,
  Send,
  ShieldCheck,
  ShieldX,
  SlidersHorizontal,
  Wallet,
  XCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/ui/PageHeader'
import { useGetRcmCommandCenterQuery } from '@/services/api/endpoints/rcmCommandCenterApi'
import type {
  RcmCommandCenterClaimReadinessRow,
  RcmCommandCenterInsight,
  RcmCommandCenterMetric,
  RcmCommandCenterQueueItem,
  RcmCommandCenterStage,
  RcmMetricTone,
  RcmQueuePriority,
  RcmWorkflowStageKey,
} from '@/types/rcmCommandCenter'
import { cn } from '@/utils/classNames'

type WorklistFilter =
  | 'all'
  | 'ready'
  | 'blocked'
  | 'missingFeeSchedule'
  | 'eligibility'
  | 'coverageRule'
  | 'authorizationReferral'
  | 'submitted'
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'failed'
  | 'rejectedFailed'

type WorklistSort = 'ageDesc' | 'amountDesc' | 'allowedDesc' | 'statusAsc'
type DashboardInsight = RcmCommandCenterInsight & {
  worklistFilter?: WorklistFilter
}

const activeStageKeys = new Set<RcmWorkflowStageKey>([
  'patientAccess',
  'authorization',
  'coding',
  'claims',
  'claimSubmission',
  'claimTracking',
])

const stageIconMap: Record<RcmWorkflowStageKey, LucideIcon> = {
  patientAccess: SearchCheck,
  authorization: ShieldCheck,
  coding: ClipboardCheck,
  claims: FileWarning,
  claimSubmission: ArrowRight,
  claimTracking: Search,
  denials: ShieldX,
  ar: PhoneCall,
  patientBalance: Wallet,
}

const metricIconMap: Record<string, LucideIcon> = {
  'total-claims': FileWarning,
  'claims-ready': CheckCircle2,
  'claims-blocked': AlertTriangle,
  'submitted-claims': ArrowRight,
  'accepted-claims': CheckCircle2,
  'rejected-claims': XCircle,
  'pending-claims': Clock3,
  'failed-claims': XCircle,
  'claim-rejection-events': XCircle,
  'claims-needing-follow-up': PhoneCall,
  'missing-contract-rates': DollarSign,
  'eligibility-failures': SearchCheck,
  'coverage-rule-failures': ShieldX,
  'auth-missing': ShieldCheck,
  'referral-missing': PhoneCall,
  'total-billed': Wallet,
  'expected-allowed': DollarSign,
  'expected-insurance': ShieldCheck,
  'expected-patient': Wallet,
  'era-received': FileWarning,
  'payments-posted': DollarSign,
  'unmatched-eras': AlertTriangle,
  'total-paid': DollarSign,
  'total-adjustments': Wallet,
  'underpaid-claims': AlertTriangle,
  'ar-total-balance': Wallet,
  'open-ar-work-items': PhoneCall,
  'underpayment-amount': AlertTriangle,
  'patient-balance-total': Wallet,
  'patient-statements-ready': Wallet,
  'overdue-patient-balances': Clock3,
  'refund-pending-review': DollarSign,
  'collections-active': PhoneCall,
  'collections-recovered': DollarSign,
  'collection-write-offs': Wallet,
  'open-denials': ShieldX,
  'denial-amount': ShieldX,
  'preventable-denials': AlertTriangle,
  'corrected-claim-ready': FileWarning,
  'appeal-ready': ShieldCheck,
  'corrected-claims-pending': FileWarning,
  'corrected-claims-submitted': Send,
  'appeals-pending': Clock3,
  'appeals-overturned': CheckCircle2,
  'appeals-upheld': ShieldX,
  'denial-recovery-rate': Activity,
  'preventable-denial-recovery': Activity,
  'reopened-claims': RefreshCcw,
  'patient-access': SearchCheck,
  authorization: ShieldCheck,
  coding: ClipboardCheck,
  claims: FileWarning,
  denials: ShieldX,
  ar: PhoneCall,
  'patient-balance': Wallet,
}

const metricToneClassNames: Record<RcmMetricTone, string> = {
  critical: 'border-[var(--color-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  warning: 'border-[var(--color-border)] bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  neutral: 'border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]',
  positive: 'border-[var(--color-border)] bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
}

const priorityClassNames: Record<RcmQueuePriority, string> = {
  critical: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  high: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  medium: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  low: 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
}

const blockerLabels: Record<string, { label: string; className: string }> = {
  missingFeeSchedule: {
    label: 'Fee schedule',
    className: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  },
  eligibility: {
    label: 'Eligibility',
    className: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  },
  coverageRule: {
    label: 'Coverage rule',
    className: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  },
  authorizationReferral: {
    label: 'Auth/referral',
    className: 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  },
  claimData: {
    label: 'Claim data',
    className: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  },
  submitted: {
    label: 'Submitted',
    className: 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]',
  },
  rejectedFailed: {
    label: 'Rejected/failed',
    className: 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  },
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

function formatMetric(value: number, format: 'count' | 'currency') {
  return format === 'currency' ? formatCurrency(value) : formatCount(value)
}

function formatDashboardMetric(metric: RcmCommandCenterMetric) {
  return metric.key.endsWith('recovery-rate') ? `${formatCount(metric.value)}%` : formatMetric(metric.value, metric.format)
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'No timestamp'
  }

  const dateValue = new Date(value)

  if (Number.isNaN(dateValue.getTime())) {
    return 'No timestamp'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function priorityLabel(priority: RcmQueuePriority) {
  switch (priority) {
    case 'critical':
      return 'Critical'
    case 'high':
      return 'High'
    case 'medium':
      return 'Medium'
    default:
      return 'Low'
  }
}

function activityStatusTone(status: string): RcmMetricTone {
  if (status === 'REJECTED' || status === 'FAILED') {
    return 'critical'
  }

  if (status === 'PENDING') {
    return 'warning'
  }

  if (status === 'ACCEPTED' || status === 'READY') {
    return 'positive'
  }

  return 'neutral'
}

function getMetric(metricMap: Map<string, RcmCommandCenterMetric>, key: string) {
  return metricMap.get(key) ?? {
    key,
    label: key,
    value: 0,
    format: 'count' as const,
    tone: 'neutral' as const,
    helperText: '',
  }
}

function getRatio(numerator: number, denominator: number) {
  return denominator > 0 ? numerator / denominator : 0
}

function itemMatchesSearch(item: RcmCommandCenterQueueItem, searchTerm: string) {
  if (!searchTerm) {
    return true
  }

  const haystack = [
    item.title,
    item.subtitle,
    item.status,
    item.summary,
    item.nextBestAction,
    item.aiBriefing,
    ...item.badges,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(searchTerm.toLowerCase())
}

function rowMatchesFilter(row: RcmCommandCenterClaimReadinessRow, filter: WorklistFilter) {
  switch (filter) {
    case 'ready':
      return row.canSubmit
    case 'blocked':
      return !row.canSubmit
    case 'missingFeeSchedule':
    case 'eligibility':
    case 'coverageRule':
    case 'authorizationReferral':
      return row.blockerTypes.includes(filter)
    case 'submitted':
      return row.blockerTypes.includes('submitted') && row.lifecycleStatus === 'SUBMITTED'
    case 'pending':
      return row.blockerTypes.includes('submitted') && row.lifecycleStatus === 'PENDING'
    case 'accepted':
      return row.blockerTypes.includes('submitted') && row.lifecycleStatus === 'ACCEPTED'
    case 'rejected':
      return row.blockerTypes.includes('rejectedFailed') && row.lifecycleStatus === 'REJECTED'
    case 'failed':
      return row.blockerTypes.includes('rejectedFailed') && row.lifecycleStatus === 'FAILED'
    case 'rejectedFailed':
      return row.blockerTypes.includes('rejectedFailed') && ['REJECTED', 'FAILED'].includes(row.lifecycleStatus)
    default:
      return true
  }
}

function rowMatchesSearch(row: RcmCommandCenterClaimReadinessRow, searchTerm: string) {
  if (!searchTerm) {
    return true
  }

  const haystack = [
    row.displayClaimId,
    row.patient,
    row.payerId,
    row.facility,
    row.state,
    row.claimStatus,
    row.submissionStatus,
    row.lifecycleStatus,
    ...row.blockingReasons,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return haystack.includes(searchTerm.toLowerCase())
}

function sortRows(rows: RcmCommandCenterClaimReadinessRow[], sortBy: WorklistSort) {
  return [...rows].sort((firstRow, secondRow) => {
    switch (sortBy) {
      case 'amountDesc':
        return secondRow.totalBilledAmount - firstRow.totalBilledAmount
      case 'allowedDesc':
        return secondRow.totalExpectedAllowedAmount - firstRow.totalExpectedAllowedAmount
      case 'statusAsc':
        return firstRow.status.localeCompare(secondRow.status)
      default:
        return secondRow.claimAgeDays - firstRow.claimAgeDays
    }
  })
}

function sortQueueItems(items: Array<RcmCommandCenterQueueItem & { stageLabel: string }>) {
  const priorityWeight: Record<RcmQueuePriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  }

  return [...items].sort((firstItem, secondItem) => {
    const weightDifference =
      priorityWeight[firstItem.priority] - priorityWeight[secondItem.priority]

    if (weightDifference !== 0) {
      return weightDifference
    }

    const firstDueDate = firstItem.dueAt ? new Date(firstItem.dueAt).getTime() : Number.MAX_SAFE_INTEGER
    const secondDueDate = secondItem.dueAt ? new Date(secondItem.dueAt).getTime() : Number.MAX_SAFE_INTEGER

    if (firstDueDate !== secondDueDate) {
      return firstDueDate - secondDueDate
    }

    return firstItem.title.localeCompare(secondItem.title)
  })
}

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{title}</h2>
        {description ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

function DashboardPlaceholder() {
  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 pb-6">
      <PageHeader
        eyebrow="RCM Command Center"
        title="Revenue cycle command center"
        description="Loading claim readiness, submission, blocker, and financial telemetry."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]"
          />
        ))}
      </section>

      <section className="h-96 animate-pulse rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]" />
    </div>
  )
}

function SummaryStat({
  metric,
  onClick,
}: {
  metric: RcmCommandCenterMetric
  onClick?: () => void
}) {
  const Icon = metricIconMap[metric.key] ?? Activity
  const content = (
    <div className="flex min-h-[5.25rem] items-center justify-between gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3 text-left shadow-sm transition-colors hover:bg-[var(--color-hover)]">
      <div className="min-w-0">
        <p className="truncate text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
          {metric.label}
        </p>
        <p className="mt-1 text-[1.55rem] font-semibold leading-8 text-[var(--color-text-strong)]">
          {formatDashboardMetric(metric)}
        </p>
      </div>
      <span
        className={cn(
          'grid h-9 w-9 shrink-0 place-items-center rounded-md border',
          metricToneClassNames[metric.tone],
        )}
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
    </div>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="block w-full">
        {content}
      </button>
    )
  }

  return (
    <Link to={metric.route || '/rcm/dashboard'} className="block">
      {content}
    </Link>
  )
}

function StatusBadge({ children, tone }: { children: ReactNode; tone: RcmMetricTone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold',
        metricToneClassNames[tone],
      )}
    >
      {children}
    </span>
  )
}

function PipelineStep({
  label,
  value,
  tone,
  onClick,
}: {
  label: string
  value: number
  tone: RcmMetricTone
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-[5.25rem] w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3.5 text-left shadow-sm transition-colors hover:bg-[var(--color-hover)]"
    >
      <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold', metricToneClassNames[tone])}>
        {label}
      </span>
      <p className="mt-2 text-[1.55rem] font-semibold leading-8 text-[var(--color-text-strong)]">{formatCount(value)}</p>
    </button>
  )
}

function QueueStageSection({ stage }: { stage: RcmCommandCenterStage }) {
  const Icon = stageIconMap[stage.key]

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-strong)]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-semibold text-[var(--color-text-strong)]">{stage.label}</h3>
              <span className="text-sm font-semibold text-[var(--color-text)]">{formatCount(stage.count)}</span>
              {stage.criticalCount ? (
                <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-danger-text)]">
                  {formatCount(stage.criticalCount)} critical
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-sm text-[var(--color-text-muted)]">{stage.description}</p>
          </div>
        </div>

        <Link to={stage.route} className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--color-primary)]">
          Open queue
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {stage.items.length ? (
        <div className="mt-3 max-h-[24rem] overflow-y-auto overscroll-contain rounded-lg border border-[var(--color-border)]">
          <div className="divide-y divide-[var(--color-border)]">
          {stage.items.map((item) => (
            <Link
              key={item.id}
              to={item.route}
              className="grid gap-3 px-3.5 py-3 transition-colors hover:bg-[var(--color-hover)] md:grid-cols-[minmax(0,1fr)_13rem]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{item.title}</p>
                  {item.badges.slice(0, 3).map((badge, index) => (
                    <span
                      key={`${item.id}-${badge}-${index}`}
                      className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
                {item.subtitle ? <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">{item.subtitle}</p> : null}
                <p className="mt-2 text-sm text-[var(--color-text)]">{item.summary}</p>
                <p className="mt-2 text-xs font-medium text-[var(--color-text-strong)]">
                  Next: <span className="font-normal text-[var(--color-text)]">{item.nextBestAction}</span>
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', priorityClassNames[item.priority])}>
                  {priorityLabel(item.priority)}
                </span>
                <p className="text-sm font-medium text-[var(--color-text-strong)]">{item.status}</p>
                {item.dueAt ? <p className="text-xs text-[var(--color-text-muted)]">Due {formatDateTime(item.dueAt)}</p> : null}
              </div>
            </Link>
          ))}
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
          No active workflow items in this stage right now.
        </div>
      )}
    </section>
  )
}

function ClaimReadinessTable({
  rows,
  filter,
  onFilterChange,
  searchTerm,
  onSearchChange,
  sortBy,
  onSortChange,
}: {
  rows: RcmCommandCenterClaimReadinessRow[]
  filter: WorklistFilter
  onFilterChange: (filter: WorklistFilter) => void
  searchTerm: string
  onSearchChange: (value: string) => void
  sortBy: WorklistSort
  onSortChange: (value: WorklistSort) => void
}) {
  const filterOptions: Array<{ value: WorklistFilter; label: string }> = [
    { value: 'all', label: 'All claims' },
    { value: 'ready', label: 'Ready' },
    { value: 'blocked', label: 'Blocked' },
    { value: 'missingFeeSchedule', label: 'Missing Fee Schedule' },
    { value: 'eligibility', label: 'Eligibility Issue' },
    { value: 'coverageRule', label: 'Coverage Rule' },
    { value: 'authorizationReferral', label: 'Auth/Referral Issue' },
    { value: 'submitted', label: 'Submitted' },
    { value: 'pending', label: 'Pending' },
    { value: 'accepted', label: 'Accepted' },
    { value: 'rejected', label: 'Rejected' },
    { value: 'failed', label: 'Failed' },
    { value: 'rejectedFailed', label: 'Rejected/Failed' },
  ]

  return (
    <section className="space-y-3">
      <SectionHeader
        title="Claims Ready vs Blocked Worklist"
        description="Operational worklist tied to claim-line pricing, eligibility, coverage rules, authorization, referral, and submission state."
      />

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
          <label className="flex min-h-10 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3">
            <Search className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
            <span className="sr-only">Search claims</span>
            <input
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search patient, payer, claim ID, facility, or blocker"
              className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-muted)]"
            />
          </label>

          <label className="flex min-h-10 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3">
            <SlidersHorizontal className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
            <span className="sr-only">Sort claims</span>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as WorklistSort)}
              className="bg-transparent text-sm font-medium text-[var(--color-text-strong)] outline-none"
            >
              <option value="ageDesc">Oldest first</option>
              <option value="amountDesc">Billed amount</option>
              <option value="allowedDesc">Expected allowed</option>
              <option value="statusAsc">Status</option>
            </select>
          </label>
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onFilterChange(option.value)}
              className={cn(
                'shrink-0 rounded-md border px-3 py-2 text-xs font-semibold transition-colors',
                filter === option.value
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]',
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-h-[32rem] max-w-full overflow-auto overscroll-contain rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <table className="w-full min-w-[1280px] text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">Claim ID</th>
              <th className="px-4 py-3">Patient</th>
              <th className="px-4 py-3">Payer</th>
              <th className="px-4 py-3">Facility/State</th>
              <th className="px-4 py-3">Claim Status</th>
              <th className="px-4 py-3">Submission</th>
              <th className="px-4 py-3">Readiness</th>
              <th className="px-4 py-3">Blocking Reasons</th>
              <th className="px-4 py-3 text-right">Billed</th>
              <th className="px-4 py-3 text-right">Expected Allowed</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.length ? rows.map((row) => (
              <tr key={row.claimId} className="align-top">
                <td className="px-4 py-3">
                  <div className="font-semibold text-[var(--color-text-strong)]">{row.displayClaimId}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{row.claimAgeDays}d old</div>
                </td>
                <td className="px-4 py-3">{row.patient}</td>
                <td className="px-4 py-3">{row.payerId || '-'}</td>
                <td className="px-4 py-3">
                  <div>{row.facility || '-'}</div>
                  {row.state ? <div className="text-xs text-[var(--color-text-muted)]">{row.state}</div> : null}
                </td>
                <td className="px-4 py-3">{row.claimStatus}</td>
                <td className="px-4 py-3">
                  <div>{row.submissionStatus}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">{row.lifecycleStatus}</div>
                </td>
                <td className="px-4 py-3">
                  {row.canSubmit ? (
                    <StatusBadge tone="positive">Ready</StatusBadge>
                  ) : (
                    <StatusBadge tone={row.blockerTypes.includes('rejectedFailed') ? 'critical' : 'warning'}>Blocked</StatusBadge>
                  )}
                </td>
                <td className="max-w-[28rem] px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {row.blockerTypes.length ? row.blockerTypes.map((blockerType) => {
                      const config = blockerLabels[blockerType] ?? blockerLabels.claimData

                      return (
                        <span key={`${row.claimId}-${blockerType}`} className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', config.className)}>
                          {config.label}
                        </span>
                      )
                    }) : (
                      <span className="rounded-full bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-semibold text-[var(--color-success-text)]">
                        No blockers
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-[var(--color-text-muted)]">
                    {row.blockingReasons.length ? row.blockingReasons.join('; ') : 'Ready for deterministic submission validation.'}
                  </p>
                </td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.totalBilledAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(row.totalExpectedAllowedAmount)}</td>
                <td className="px-4 py-3">
                  <Link
                    to={row.route}
                    className="inline-flex min-h-8 items-center gap-1 whitespace-nowrap rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:border-[var(--color-primary-hover)] hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-ring)]"
                  >
                    Open Readiness
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </td>
              </tr>
            )) : (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center">
                  <div className="mx-auto max-w-md">
                    <ListFilter className="mx-auto h-8 w-8 text-[var(--color-text-muted)]" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold text-[var(--color-text-strong)]">No claims match this worklist filter.</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      Clear the search or choose another readiness filter to review claims.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}

export function DashboardPage() {
  const [priorityFilter, setPriorityFilter] = useState<RcmQueuePriority | 'all'>('all')
  const [queueSearchTerm, setQueueSearchTerm] = useState('')
  const [worklistFilter, setWorklistFilter] = useState<WorklistFilter>('all')
  const [worklistSearchTerm, setWorklistSearchTerm] = useState('')
  const [worklistSort, setWorklistSort] = useState<WorklistSort>('ageDesc')
  const { data, error, isFetching, isLoading, refetch } = useGetRcmCommandCenterQuery(undefined, {
    pollingInterval: 15000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })
  const normalizedQueueSearchTerm = queueSearchTerm.trim()
  const normalizedWorklistSearchTerm = worklistSearchTerm.trim()

  const visibleWorkflowStages = useMemo(
    () =>
      (data?.workflowStages ?? [])
        .filter((stage) => activeStageKeys.has(stage.key))
        .map((stage) => ({
          ...stage,
          items: stage.items.filter(
            (item) =>
              (priorityFilter === 'all' || item.priority === priorityFilter) &&
              itemMatchesSearch(item, normalizedQueueSearchTerm),
          ),
        })),
    [data?.workflowStages, normalizedQueueSearchTerm, priorityFilter],
  )

  const downstreamWorkflowStages = useMemo(
    () => (data?.workflowStages ?? []).filter((stage) => !activeStageKeys.has(stage.key)),
    [data?.workflowStages],
  )

  const filteredReadinessRows = useMemo(
    () =>
      sortRows(
        (data?.claimReadiness ?? []).filter(
          (row) =>
            rowMatchesFilter(row, worklistFilter) &&
            rowMatchesSearch(row, normalizedWorklistSearchTerm),
        ),
        worklistSort,
      ),
    [data?.claimReadiness, normalizedWorklistSearchTerm, worklistFilter, worklistSort],
  )

  if (isLoading && !data) {
    return <DashboardPlaceholder />
  }

  if (!data || error) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 pb-6">
        <PageHeader
          eyebrow="RCM Command Center"
          title="Revenue cycle command center"
          description="Live workflow telemetry across readiness, eligibility, contract rates, and 837P submission."
        />

        <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-danger-soft)] px-5 py-6 text-sm text-[var(--color-danger-text)]">
          Unable to load the command center. Check the RCM command-center API and retry.
        </section>
      </div>
    )
  }

  const metricMap = new Map(data.metrics.map((metric) => [metric.key, metric]))
  const totalClaims = getMetric(metricMap, 'total-claims')
  const readyClaims = getMetric(metricMap, 'claims-ready')
  const blockedClaims = getMetric(metricMap, 'claims-blocked')
  const submittedClaims = getMetric(metricMap, 'submitted-claims')
  const pendingClaims = getMetric(metricMap, 'pending-claims')
  const acceptedClaims = getMetric(metricMap, 'accepted-claims')
  const rejectedClaims = getMetric(metricMap, 'rejected-claims')
  const failedClaims = getMetric(metricMap, 'failed-claims')
  const rejectionEvents = getMetric(metricMap, 'claim-rejection-events')
  const claimsNeedingFollowUp = getMetric(metricMap, 'claims-needing-follow-up')
  const totalBilled = getMetric(metricMap, 'total-billed')
  const expectedAllowed = getMetric(metricMap, 'expected-allowed')
  const expectedInsurance = getMetric(metricMap, 'expected-insurance')
  const expectedPatient = getMetric(metricMap, 'expected-patient')
  const eraReceived = getMetric(metricMap, 'era-received')
  const paymentsPosted = getMetric(metricMap, 'payments-posted')
  const unmatchedEras = getMetric(metricMap, 'unmatched-eras')
  const totalPaid = getMetric(metricMap, 'total-paid')
  const totalAdjustments = getMetric(metricMap, 'total-adjustments')
  const underpaidClaims = getMetric(metricMap, 'underpaid-claims')
  const arTotalBalance = getMetric(metricMap, 'ar-total-balance')
  const openArWorkItems = getMetric(metricMap, 'open-ar-work-items')
  const underpaymentAmount = getMetric(metricMap, 'underpayment-amount')
  const patientBalanceTotal = getMetric(metricMap, 'patient-balance-total')
  const patientStatementsReady = getMetric(metricMap, 'patient-statements-ready')
  const overduePatientBalances = getMetric(metricMap, 'overdue-patient-balances')
  const refundPendingReview = getMetric(metricMap, 'refund-pending-review')
  const collectionsActive = getMetric(metricMap, 'collections-active')
  const collectionsRecovered = getMetric(metricMap, 'collections-recovered')
  const collectionWriteOffs = getMetric(metricMap, 'collection-write-offs')
  const openDenials = getMetric(metricMap, 'open-denials')
  const denialAmount = getMetric(metricMap, 'denial-amount')
  const preventableDenials = getMetric(metricMap, 'preventable-denials')
  const correctedClaimReady = getMetric(metricMap, 'corrected-claim-ready')
  const appealReady = getMetric(metricMap, 'appeal-ready')
  const correctedClaimsPending = getMetric(metricMap, 'corrected-claims-pending')
  const correctedClaimsSubmitted = getMetric(metricMap, 'corrected-claims-submitted')
  const appealsPending = getMetric(metricMap, 'appeals-pending')
  const appealsOverturned = getMetric(metricMap, 'appeals-overturned')
  const appealsUpheld = getMetric(metricMap, 'appeals-upheld')
  const denialRecoveryRate = getMetric(metricMap, 'denial-recovery-rate')
  const preventableDenialRecovery = getMetric(metricMap, 'preventable-denial-recovery')
  const reopenedClaims = getMetric(metricMap, 'reopened-claims')
  const collectionRate = getRatio(expectedAllowed.value, totalBilled.value)
  const patientResponsibilityRate = getRatio(expectedPatient.value, expectedAllowed.value)
  const totalOpenWork = visibleWorkflowStages.reduce((total, stage) => total + stage.count, 0)
  const totalCritical = visibleWorkflowStages.reduce((total, stage) => total + stage.criticalCount, 0)
  const nextBestMoves = sortQueueItems(
    visibleWorkflowStages.flatMap((stage) =>
      stage.items.map((item) => ({
        ...item,
        stageLabel: stage.label,
      })),
    ),
  ).slice(0, 6)
  const deterministicInsightCandidates: Array<DashboardInsight | null> = [
    blockedClaims.value > 0
      ? {
          id: 'blocked-claims',
          title: `${formatCount(blockedClaims.value)} claims are blocked before submission`,
          summary: 'Open readiness to resolve pricing, eligibility, coverage rule, authorization, or referral gaps.',
          severity: blockedClaims.value >= 3 ? 'critical' : 'warning',
          route: '/rcm/dashboard',
          actionLabel: 'Review blocked claims',
          worklistFilter: 'blocked',
        }
      : null,
    getMetric(metricMap, 'eligibility-failures').value > 0
      ? {
          id: 'eligibility-gap',
          title: `${formatCount(getMetric(metricMap, 'eligibility-failures').value)} claims need eligibility review`,
          summary: 'Run eligibility from the readiness screen before attempting deterministic submission.',
          severity: 'warning',
          route: '/rcm/dashboard',
          actionLabel: 'Open eligibility blockers',
          worklistFilter: 'eligibility',
        }
      : null,
    totalBilled.value > 0
      ? {
          id: 'expected-collection-rate',
          title: `Expected allowed amount is ${formatPercent(collectionRate)} of billed charges`,
          summary: `${formatCurrency(expectedAllowed.value)} expected allowed from ${formatCurrency(totalBilled.value)} billed.`,
          severity: collectionRate > 0 ? 'info' : 'warning',
          route: '/rcm/dashboard',
          actionLabel: 'Review claims',
          worklistFilter: 'all',
        }
      : null,
    failedClaims.value + rejectedClaims.value > 0
      ? {
          id: 'submission-failures',
          title: `${formatCount(failedClaims.value + rejectedClaims.value)} claims failed or rejected after submission`,
          summary: 'Open the readiness and submission records to review clearinghouse or payer response details.',
          severity: 'critical',
          route: '/rcm/dashboard',
          actionLabel: 'Review submissions',
          worklistFilter: 'rejectedFailed',
        }
      : null,
    unmatchedEras.value > 0
      ? {
          id: 'unmatched-era-work',
          title: `${formatCount(unmatchedEras.value)} ERA imports need matching review`,
          summary: 'Open ERA processing to resolve unmatched claim or service-line identifiers before downstream AR work.',
          severity: 'warning',
          route: '/rcm/era-eob-processings',
          actionLabel: 'Review unmatched ERAs',
        }
      : null,
  ]
  const deterministicInsights = deterministicInsightCandidates.filter(
    (insight): insight is DashboardInsight => insight !== null,
  )

  const executiveMetrics = [
    totalClaims,
    readyClaims,
    blockedClaims,
    submittedClaims,
    acceptedClaims,
    rejectedClaims,
    failedClaims,
    rejectionEvents,
    claimsNeedingFollowUp,
    eraReceived,
    paymentsPosted,
    unmatchedEras,
    underpaidClaims,
    openArWorkItems,
    openDenials,
    preventableDenials,
    correctedClaimReady,
    appealReady,
    correctedClaimsPending,
    appealsPending,
    patientStatementsReady,
    overduePatientBalances,
    refundPendingReview,
    collectionsActive,
    reopenedClaims,
  ]
  const blockerCards: Array<{ metric: RcmCommandCenterMetric; filter: WorklistFilter; actionHint: string }> = [
    { metric: getMetric(metricMap, 'missing-contract-rates'), filter: 'missingFeeSchedule', actionHint: 'Add fee schedule' },
    { metric: getMetric(metricMap, 'eligibility-failures'), filter: 'eligibility', actionHint: 'Run eligibility' },
    { metric: getMetric(metricMap, 'coverage-rule-failures'), filter: 'coverageRule', actionHint: 'Open readiness' },
    { metric: getMetric(metricMap, 'auth-missing'), filter: 'authorizationReferral', actionHint: 'Link authorization' },
    { metric: getMetric(metricMap, 'referral-missing'), filter: 'authorizationReferral', actionHint: 'Link referral' },
  ]
  const financialMetrics = [
    totalBilled,
    expectedAllowed,
    expectedInsurance,
    expectedPatient,
    totalPaid,
    totalAdjustments,
    arTotalBalance,
    underpaymentAmount,
    patientBalanceTotal,
    collectionsRecovered,
    collectionWriteOffs,
    denialAmount,
    correctedClaimsSubmitted,
    appealsOverturned,
    appealsUpheld,
    denialRecoveryRate,
    preventableDenialRecovery,
  ]

  return (
    <div className="mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 pb-6">
      <PageHeader
        eyebrow="RCM Command Center"
        title="Revenue cycle command center"
        description={`Claim readiness, contract pricing, eligibility, and 837P submission telemetry. Auto-refreshes every ${data.refreshIntervalSeconds} seconds.`}
      />

      <section className="flex flex-wrap items-center gap-2 text-sm">
        <div className="inline-flex items-center rounded-full bg-[var(--color-surface-muted)] px-3 py-1.5 font-medium text-[var(--color-text)]">
          {formatCount(totalOpenWork)} active workflow items
        </div>
        <div className="inline-flex items-center rounded-full bg-[var(--color-danger-soft)] px-3 py-1.5 font-medium text-[var(--color-danger-text)]">
          {formatCount(totalCritical)} critical
        </div>
        <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface)] px-3 py-1.5 font-medium text-[var(--color-text-muted)]">
          <RefreshCcw className={cn('h-4 w-4', isFetching && 'animate-spin')} aria-hidden="true" />
          {isFetching ? 'Refreshing live telemetry' : `Last refreshed ${formatDateTime(data.generatedAt)}`}
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </section>

      <section className="space-y-3">
        <SectionHeader
          title="Command Summary"
          description="High-level health of claims before and during 837P submission."
        />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-9">
          {executiveMetrics.map((metric) => (
            <SummaryStat
              key={metric.key}
              metric={metric}
              onClick={
                metric.key === 'claims-ready'
                  ? () => setWorklistFilter('ready')
                  : metric.key === 'claims-blocked'
                    ? () => setWorklistFilter('blocked')
                    : metric.key === 'submitted-claims'
                      ? () => setWorklistFilter('submitted')
                      : metric.key === 'pending-claims'
                        ? () => setWorklistFilter('pending')
                        : metric.key === 'accepted-claims'
                          ? () => setWorklistFilter('accepted')
                          : metric.key === 'rejected-claims'
                            ? () => setWorklistFilter('rejected')
                            : metric.key === 'failed-claims'
                              ? () => setWorklistFilter('failed')
                              : undefined
              }
            />
          ))}
        </div>
      </section>

      <section className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          <section className="space-y-3">
            <SectionHeader
              title="Submission Pipeline"
              description="Created claims through readiness, submission, acknowledgement, and failure states."
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-7">
                <PipelineStep label="Created" value={totalClaims.value} tone="neutral" onClick={() => setWorklistFilter('all')} />
                <PipelineStep label="Ready" value={readyClaims.value} tone="positive" onClick={() => setWorklistFilter('ready')} />
                <PipelineStep label="Submitted" value={submittedClaims.value} tone="neutral" onClick={() => setWorklistFilter('submitted')} />
                <PipelineStep label="Pending" value={pendingClaims.value} tone={pendingClaims.value ? 'warning' : 'positive'} onClick={() => setWorklistFilter('pending')} />
                <PipelineStep label="Accepted" value={acceptedClaims.value} tone="positive" onClick={() => setWorklistFilter('accepted')} />
                <PipelineStep label="Rejected" value={rejectedClaims.value} tone={rejectedClaims.value ? 'critical' : 'positive'} onClick={() => setWorklistFilter('rejected')} />
                <PipelineStep label="Failed" value={failedClaims.value} tone={failedClaims.value ? 'critical' : 'positive'} onClick={() => setWorklistFilter('failed')} />
            </div>
          </section>

          <ClaimReadinessTable
            rows={filteredReadinessRows}
            filter={worklistFilter}
            onFilterChange={setWorklistFilter}
            searchTerm={worklistSearchTerm}
            onSearchChange={setWorklistSearchTerm}
            sortBy={worklistSort}
            onSortChange={setWorklistSort}
          />

          <section className="space-y-3">
            <SectionHeader
              title="Operational Queues"
              description="Operational queues that feed claim readiness and submission."
            />
            <div className="grid gap-3 xl:grid-cols-2">
              {visibleWorkflowStages.map((stage) => (
                <QueueStageSection key={stage.key} stage={stage} />
              ))}
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-3">
          <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-3.5 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Action Center</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Blocking issues that need work before submission.</p>
            </div>
            {blockerCards.map(({ metric, filter, actionHint }) => {
              const Icon = metricIconMap[metric.key] ?? AlertTriangle

              return (
                <button
                  key={metric.key}
                  type="button"
                  onClick={() => setWorklistFilter(filter)}
                  className="flex w-full items-center gap-3 border-b border-[var(--color-border)] px-3.5 py-3 text-left transition-colors last:border-b-0 hover:bg-[var(--color-hover)]"
                >
                  <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-md border', metricToneClassNames[metric.tone])}>
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-[var(--color-text-strong)]">{metric.label}</span>
                    <span className="block truncate text-xs text-[var(--color-text-muted)]">{actionHint}</span>
                  </span>
                  <span className="text-xl font-semibold text-[var(--color-text-strong)]">{formatCount(metric.value)}</span>
                </button>
              )
            })}
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-3.5 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Financial Snapshot</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Expected reimbursement from claim-line snapshots.</p>
            </div>
            <div className="max-h-[16rem] overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)]">
              {financialMetrics.map((metric) => (
                <Link key={metric.key} to={metric.route || '/rcm/dashboard'} className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-[var(--color-hover)]">
                  <span className="text-sm text-[var(--color-text-muted)]">{metric.label}</span>
                  <span className="text-sm font-semibold text-[var(--color-text-strong)]">{formatDashboardMetric(metric)}</span>
                </Link>
              ))}
            </div>
            <div className="grid grid-cols-2 divide-x divide-[var(--color-border)] border-t border-[var(--color-border)]">
              <div className="px-3.5 py-3">
                <p className="text-xs text-[var(--color-text-muted)]">Allowed / billed</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{formatPercent(collectionRate)}</p>
              </div>
              <div className="px-3.5 py-3">
                <p className="text-xs text-[var(--color-text-muted)]">Patient share</p>
                <p className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{formatPercent(patientResponsibilityRate)}</p>
              </div>
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-3.5 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">RCM Insights</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Deterministic signals. Readiness remains the submission gate.</p>
            </div>
            <div className="max-h-[16rem] overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)]">
              {[...deterministicInsights, ...data.aiInsights].length ? (
                [...deterministicInsights, ...data.aiInsights].slice(0, 4).map((insight) => {
                  const content = (
                    <div className="flex items-start gap-2">
                      <span className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', insight.severity === 'critical' ? 'bg-[var(--color-danger-text)]' : insight.severity === 'warning' ? 'bg-[var(--color-warning-text)]' : 'bg-[var(--color-info-text)]')} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{insight.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{insight.summary}</p>
                      </div>
                    </div>
                  )

                  if ('worklistFilter' in insight && insight.worklistFilter) {
                    return (
                      <button
                        key={insight.id}
                        type="button"
                        onClick={() => setWorklistFilter(insight.worklistFilter as WorklistFilter)}
                        className="block w-full px-3.5 py-3 text-left transition-colors hover:bg-[var(--color-hover)]"
                      >
                        {content}
                      </button>
                    )
                  }

                  return (
                    <Link key={insight.id} to={insight.route} className="block px-3.5 py-3 transition-colors hover:bg-[var(--color-hover)]">
                      {content}
                    </Link>
                  )
                })
              ) : (
                <div className="px-4 py-6 text-sm text-[var(--color-text-muted)]">
                  No claim readiness pressure is being flagged right now.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-3.5 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Recent Claim Activity</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Latest submission, acknowledgement, and tracking timeline events.</p>
            </div>
            <div className="max-h-[18rem] overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)]">
              {data.recentClaimActivity.length ? (
                data.recentClaimActivity.slice(0, 6).map((event) => (
                  <Link key={event.id} to={event.route} className="block px-3.5 py-3 transition-colors hover:bg-[var(--color-hover)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">
                          Claim {event.claimNumber}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                          {[event.payer, event.eventType.replaceAll('_', ' ')].filter(Boolean).join(' / ')}
                        </p>
                      </div>
                      <StatusBadge tone={activityStatusTone(event.status)}>{event.status}</StatusBadge>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text)]">{event.summary}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <span>{formatDateTime(event.occurredAt)}</span>
                      <span className={cn('rounded-full px-2 py-0.5 font-semibold', event.source === 'SIMULATED' ? 'bg-[var(--color-info-soft)] text-[var(--color-info-text)]' : 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]')}>
                        {event.source}
                      </span>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-[var(--color-text-muted)]">
                  No claim timeline events have been recorded yet.
                </div>
              )}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="border-b border-[var(--color-border)] px-3.5 py-3">
              <h2 className="text-sm font-semibold text-[var(--color-text-strong)]">Queue Focus</h2>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Highest-priority workflow items.</p>
            </div>
            <div className="border-b border-[var(--color-border)] px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                {(['all', 'critical', 'high'] as Array<RcmQueuePriority | 'all'>).map((priority) => (
                  <button
                    key={priority}
                    type="button"
                    onClick={() => setPriorityFilter(priority)}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs font-semibold transition-colors',
                      priorityFilter === priority
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-hover)]',
                    )}
                  >
                    {priority === 'all' ? 'All' : priorityLabel(priority)}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex min-h-9 items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3">
                <Search className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
                <span className="sr-only">Search queue items</span>
                <input
                  value={queueSearchTerm}
                  onChange={(event) => setQueueSearchTerm(event.target.value)}
                  placeholder="Search queue work"
                  className="min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-strong)] outline-none placeholder:text-[var(--color-text-muted)]"
                />
              </label>
            </div>
            <div className="max-h-[18rem] overflow-y-auto overscroll-contain divide-y divide-[var(--color-border)]">
              {nextBestMoves.length ? (
                nextBestMoves.slice(0, 5).map((item) => (
                  <Link key={`next-${item.id}`} to={item.route} className="block px-3.5 py-3 transition-colors hover:bg-[var(--color-hover)]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{item.title}</p>
                      <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold', priorityClassNames[item.priority])}>
                        {priorityLabel(item.priority)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-xs text-[var(--color-text-muted)]">{item.nextBestAction}</p>
                  </Link>
                ))
              ) : (
                <div className="px-4 py-6 text-sm text-[var(--color-text-muted)]">No queued actions match the current filters.</div>
              )}
            </div>
          </section>
        </aside>
      </section>

      {downstreamWorkflowStages.length ? (
        <section className="space-y-3 rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-3.5">
          <SectionHeader
            title="Downstream Queues"
            description="Denial, AR, and patient balance queues are available as downstream revenue-cycle work areas."
          />
          <div className="grid gap-3 md:grid-cols-3">
            {downstreamWorkflowStages.map((stage) => (
              <article key={stage.key} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{stage.label}</p>
                <p className="mt-2 text-2xl font-semibold text-[var(--color-text-strong)]">{formatCount(stage.count)}</p>
                <p className="mt-2 text-xs text-[var(--color-text-muted)]">{stage.description}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
