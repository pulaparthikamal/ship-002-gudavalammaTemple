import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Download, RefreshCw } from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { apiClient } from '@/services/api/axiosInstance'
import {
  useGetRcmAppealsReportQuery,
  useGetRcmArReportQuery,
  useGetRcmAiOperationsReportQuery,
  useGetRcmClaimClosureReportQuery,
  useGetRcmClaimsReportQuery,
  useGetRcmDenialsReportQuery,
  useGetRcmFinancialRiskReportQuery,
  useGetRcmFinancialReportQuery,
  useGetRcmPatientBillingReportQuery,
  useGetRcmProductivityReportQuery,
  useGetRcmRealtimeReportQuery,
  useGetRcmReportsDashboardQuery,
  useGetRcmTimelyFilingReportQuery,
  type RcmReportQuery,
} from '@/services/api/endpoints/reportsApi'
import { reportApiDetails } from '@/models/reportModel'

type ReportSection = 'dashboard' | 'claims' | 'financial' | 'denials' | 'appeals' | 'ar' | 'patient-billing' | 'productivity' | 'realtime' | 'claim-closure' | 'financial-risk' | 'timely-filing' | 'ai-operations'

const sections: Array<{ id: ReportSection; label: string }> = [
  { id: 'dashboard', label: 'Executive Dashboard' },
  { id: 'claims', label: 'Claims' },
  { id: 'financial', label: 'Financial' },
  { id: 'denials', label: 'Denials' },
  { id: 'claim-closure', label: 'Claim Closure' },
  { id: 'financial-risk', label: 'Financial Risk' },
  { id: 'timely-filing', label: 'Timely Filing' },
  { id: 'ai-operations', label: 'AI Operations' },
  { id: 'appeals', label: 'Appeals' },
  { id: 'ar', label: 'AR' },
  { id: 'patient-billing', label: 'Patient Billing' },
  { id: 'productivity', label: 'Operations' },
  { id: 'realtime', label: 'Realtime' },
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}
}

function numberValue(value: unknown) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function formatNumber(value: unknown) {
  return numberValue(value).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function rowsFrom(report: Record<string, unknown>) {
  const rows = report.rows
  return Array.isArray(rows) ? rows as Record<string, unknown>[] : []
}

function summaryCards(summary: Record<string, unknown>) {
  return Object.entries(summary)
    .filter(([, value]) => typeof value !== 'object')
    .slice(0, 10)
}

function trendData(report: Record<string, unknown>) {
  const trends = report.trends
  if (Array.isArray(trends)) return trends as Array<Record<string, unknown>>
  const dashboardTrends = asRecord(trends)
  const firstTrend = Object.values(dashboardTrends).find(Array.isArray)
  return Array.isArray(firstTrend) ? firstTrend as Array<Record<string, unknown>> : []
}

function barData(source: unknown) {
  return Object.entries(asRecord(source)).map(([name, value]) => ({ name, value: numberValue(value) }))
}

function ReportCards({ summary, drillDownLinks }: { summary: Record<string, unknown>; drillDownLinks?: Record<string, unknown> }) {
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      {summaryCards(summary).map(([label, value]) => {
        const link = asRecord(drillDownLinks?.[label])
        const target = typeof link.target === 'string' ? link.target : ''
        return (
        <button
          key={label}
          type="button"
          className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left shadow-sm transition hover:border-[var(--color-primary)]"
          onClick={() => {
            if (target) {
              const queryParams = asRecord(link.query)
              const params = new URLSearchParams()
              Object.entries(queryParams).forEach(([key, value]) => {
                if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
              })
              window.location.href = params.size ? `${target}?${params.toString()}` : target
            }
          }}
        >
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label.replace(/([A-Z])/g, ' $1')}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--color-text-strong)]">{formatNumber(value)}</p>
        </button>
        )
      })}
    </section>
  )
}

function DrillDownTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = Array.from(rows.slice(0, 10).reduce((keys, row) => {
    Object.keys(row).slice(0, 9).forEach((key) => keys.add(key))
    return keys
  }, new Set<string>()))

  if (!rows.length) {
    return <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">No drill-down records found for the selected filters.</div>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--color-border)] text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-left text-xs uppercase tracking-normal text-[var(--color-text-muted)]">
            <tr>
              {columns.map((column) => <th key={column} className="px-4 py-3 font-semibold">{column}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {rows.map((row, index) => (
              <tr key={String(row._id ?? row.claimId ?? row.financialEventId ?? index)}>
                {columns.map((column) => (
                  <td key={column} className="max-w-[260px] truncate px-4 py-3 text-[var(--color-text)]">{String(row[column] ?? '-')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const operationalSectionMetrics: Partial<Record<ReportSection, string[]>> = {
  denials: [
    'openDenials',
    'denialsNeedingAction',
    'appealReadyDenials',
    'overturnedAmount',
    'upheldAmount',
    'recoveryOpportunity',
    'outstandingDeniedAmount',
    'denialRelatedAr',
  ],
  'claim-closure': [
    'claimsReadyToClose',
    'claimsClosed',
    'claimsReopened',
    'claimsBlockedFromClosure',
    'averageDaysToClose',
    'claimsAwaitingFinalFinancialSync',
  ],
  'financial-risk': [
    'eraExceptions',
    'unsupportedAdjustments',
    'duplicatePaymentRisk',
    'pendingRefunds',
    'overpayments',
    'underpayments',
    'financialImbalanceClaims',
    'claimsReopenedDueToFinancialMutation',
  ],
  'timely-filing': [
    'riskAlerts',
    'expiredAlerts',
    'criticalAlerts',
    'dueWithin7Days',
    'dueWithin30Days',
    'zapierFailures',
  ],
  realtime: [
    'pendingJobs',
    'runningJobs',
    'failedJobs',
    'staleJobs',
    'deadLetterJobs',
    'averageProcessingTimeSeconds',
    'slowestJobType',
    'webhookBacklog',
    'eraBacklog',
  ],
  'ai-operations': [
    'aiReadinessReviewsRun',
    'aiClaimReviewsRun',
    'aiDenialPredictionsGenerated',
    'aiCodingSuggestionsGenerated',
    'aiFailureCount',
    'aiTimeoutCount',
    'aiRecommendationsOverridden',
    'aiRecommendationsIgnored',
  ],
}

function OperationalMetrics({ section, summary }: { section: ReportSection; summary: Record<string, unknown> }) {
  const metrics = operationalSectionMetrics[section]
  if (!metrics?.length) return null
  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{metric.replace(/([A-Z])/g, ' $1')}</p>
          <p className="mt-2 text-xl font-semibold text-[var(--color-text-strong)]">{formatNumber(summary[metric])}</p>
        </div>
      ))}
    </section>
  )
}

export function ReportsPage() {
  const [searchParams] = useSearchParams()
  const initialFilters = useMemo<RcmReportQuery>(() => {
    const keys: Array<keyof RcmReportQuery> = ['dateFrom', 'dateTo', 'payerId', 'providerId', 'facilityId', 'status', 'claimId', 'denialStatus', 'appealStatus', 'arStatus', 'closureStatus', 'riskType', 'exceptionType', 'drillDown']
    const next: RcmReportQuery = { page: 1, limit: 25 }
    keys.forEach((key) => {
      const value = searchParams.get(key)
      if (value) next[key] = value as never
    })
    return next
  }, [searchParams])
  const [activeSection, setActiveSection] = useState<ReportSection>(() => {
    const section = searchParams.get('section') as ReportSection | null
    return section && sections.some((item) => item.id === section) ? section : 'dashboard'
  })
  const [filters, setFilters] = useState<RcmReportQuery>(initialFilters)
  const query = useMemo(() => filters, [filters])

  const dashboardQuery = useGetRcmReportsDashboardQuery(query)
  const claimsQuery = useGetRcmClaimsReportQuery(query, { skip: activeSection !== 'claims' })
  const financialQuery = useGetRcmFinancialReportQuery(query, { skip: activeSection !== 'financial' })
  const denialsQuery = useGetRcmDenialsReportQuery(query, { skip: activeSection !== 'denials' })
  const appealsQuery = useGetRcmAppealsReportQuery(query, { skip: activeSection !== 'appeals' })
  const arQuery = useGetRcmArReportQuery(query, { skip: activeSection !== 'ar' })
  const patientBillingQuery = useGetRcmPatientBillingReportQuery(query, { skip: activeSection !== 'patient-billing' })
  const productivityQuery = useGetRcmProductivityReportQuery(query, { skip: activeSection !== 'productivity' })
  const realtimeQuery = useGetRcmRealtimeReportQuery(query, { skip: activeSection !== 'realtime' })
  const claimClosureQuery = useGetRcmClaimClosureReportQuery(query, { skip: activeSection !== 'claim-closure' })
  const financialRiskQuery = useGetRcmFinancialRiskReportQuery(query, { skip: activeSection !== 'financial-risk' })
  const timelyFilingQuery = useGetRcmTimelyFilingReportQuery(query, { skip: activeSection !== 'timely-filing' })
  const aiOperationsQuery = useGetRcmAiOperationsReportQuery(query, { skip: activeSection !== 'ai-operations' })

  const activeReport = asRecord({
    dashboard: dashboardQuery.data,
    claims: claimsQuery.data,
    financial: financialQuery.data,
    denials: denialsQuery.data,
    appeals: appealsQuery.data,
    ar: arQuery.data,
    'patient-billing': patientBillingQuery.data,
    productivity: productivityQuery.data,
    realtime: realtimeQuery.data,
    'claim-closure': claimClosureQuery.data,
    'financial-risk': financialRiskQuery.data,
    'timely-filing': timelyFilingQuery.data,
    'ai-operations': aiOperationsQuery.data,
  }[activeSection] ?? dashboardQuery.data)
  const activeSummary = asRecord(activeSection === 'dashboard' ? activeReport.executive : activeReport.summary)
  const dashboard = asRecord(dashboardQuery.data)
  const insights = Array.isArray(dashboard.aiInsights) ? dashboard.aiInsights as Array<Record<string, unknown>> : []

  async function exportReport(format: 'csv' | 'xlsx') {
    const response = await apiClient.get(`${reportApiDetails.endpoint}/export`, {
      params: { ...filters, reportType: activeSection, format },
      responseType: 'blob',
    })
    const href = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = href
    link.download = `rcm-${activeSection}-report.csv`
    link.click()
    URL.revokeObjectURL(href)
  }

  return (
    <main className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">RCM Reports Center</h1>
          <p className="text-sm text-[var(--color-text-muted)]">Live operational, financial, denial, AR, and compliance analytics.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" onClick={() => dashboardQuery.refetch()}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm" onClick={() => exportReport('csv')}>
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button className="inline-flex items-center gap-2 rounded-md bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white" onClick={() => exportReport('xlsx')}>
            <Download className="h-4 w-4" /> Export CSV for Excel
          </button>
        </div>
      </div>

      <section className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 md:grid-cols-5">
        {[
          ['dateFrom', 'From', 'date'],
          ['dateTo', 'To', 'date'],
          ['payerId', 'Payer', 'text'],
          ['providerId', 'Provider', 'text'],
          ['facilityId', 'Facility', 'text'],
        ].map(([key, label, type]) => (
          <label key={key} className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            {label}
            <input
              type={type}
              className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm normal-case text-[var(--color-text)]"
              value={String(filters[key as keyof RcmReportQuery] ?? '')}
              onChange={(event) => setFilters((current) => ({ ...current, [key]: event.target.value || undefined, page: 1 }))}
            />
          </label>
        ))}
      </section>

      <nav className="flex gap-2 overflow-x-auto">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold ${activeSection === section.id ? 'bg-[var(--color-primary)] text-white' : 'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)]'}`}
            onClick={() => setActiveSection(section.id)}
          >
            {section.label}
          </button>
        ))}
      </nav>

      <ReportCards summary={activeSummary} drillDownLinks={asRecord(activeReport.drillDownLinks)} />

      <OperationalMetrics section={activeSection} summary={activeSummary} />

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text-strong)]">Trend</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData(activeReport)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Area dataKey="amount" stroke="#2563eb" fill="#bfdbfe" />
                <Area dataKey="count" stroke="#16a34a" fill="#bbf7d0" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <h2 className="mb-3 text-base font-semibold text-[var(--color-text-strong)]">Breakdown</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData(activeReport.byStatus ?? activeReport.byPayer ?? activeReport.byRiskType ?? activeReport.closureBlockersByType ?? activeReport.confidenceDistribution ?? activeReport.byCarc ?? activeReport.byCategory ?? activeReport.agingBuckets ?? activeReport.byEventType ?? activeReport.byJobType)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {insights.length > 0 && (
        <section className="grid gap-3 lg:grid-cols-5">
          {insights.map((insight) => (
            <div key={String(insight.title)} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{String(insight.severity ?? 'LOW')}</p>
              <h3 className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{String(insight.title ?? 'AI Insight')}</h3>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">{String(insight.insight ?? '')}</p>
            </div>
          ))}
        </section>
      )}

      <DrillDownTable rows={rowsFrom(activeReport)} />
    </main>
  )
}
