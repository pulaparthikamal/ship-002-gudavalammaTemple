import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Button } from 'primereact/button'
import { RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useToast } from '@/hooks/useToast'
import { getApiErrorMessage } from '@/services/api/apiError'
import {
  useGetAnalyticsSummaryQuery,
  useRunAnalyticsRollupMutation,
  type AnalyticsCountEntry,
  type AnalyticsFunnel,
} from '@/services/api/endpoints/analyticsApi'

// Validated palette (see the `dataviz` skill's references/palette.md) — a
// sequential single hue is the correct color job for every chart on this
// page (magnitude / trend over time).
const SEQUENTIAL_HUE = '#2a78d6' // step 450
const GRIDLINE = '#e1e0d9'
const AXIS_TEXT = '#898781'
const INK_SECONDARY = '#52514e'

const DAY_RANGE_OPTIONS = [
  { label: '7 days', value: 7 },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

function formatShortDate(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'UTC' })
}

function labelizeFeature(label: string) {
  return label.replace(/^nav_|^quickaction_/, '').replace(/_/g, ' ')
}

function labelizeFunnel(name: string) {
  return name.replace(/_/g, ' ')
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">{title}</h3>
        {subtitle && <p className="text-xs text-[var(--color-text-muted)]">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

function StatTile({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[var(--color-text-strong)]">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--color-text-muted)]">{sub}</p>}
    </div>
  )
}

const chartTooltipStyle = {
  contentStyle: {
    background: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: INK_SECONDARY, fontWeight: 600 },
}

function CountBarChart({ data, height = 220 }: { data: AnalyticsCountEntry[]; height?: number }) {
  const { t } = useStaffTranslation()
  if (data.length === 0) {
    return <p className="text-sm text-[var(--color-text-muted)]">{t('No data yet for this period.')}</p>
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke={GRIDLINE} />
        <XAxis type="number" tick={{ fontSize: 11, fill: AXIS_TEXT }} allowDecimals={false} />
        <YAxis
          type="category"
          dataKey="key"
          width={150}
          tick={{ fontSize: 11, fill: INK_SECONDARY }}
          tickFormatter={(value: string) => labelizeFeature(value)}
        />
        <Tooltip {...chartTooltipStyle} formatter={(value) => [value ?? 0, t('Count')]} labelFormatter={(v) => labelizeFeature(String(v))} />
        <Bar dataKey="count" fill={SEQUENTIAL_HUE} radius={[0, 4, 4, 0]} barSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function FunnelMiniChart({ funnel }: { funnel: AnalyticsFunnel }) {
  const { t } = useStaffTranslation()
  const steps = [...funnel.steps].sort((a, b) => a.stepIndex - b.stepIndex)
  const peak = steps[0]?.count ?? 0

  return (
    <ChartCard title={labelizeFunnel(funnel.funnelName)}>
      {steps.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('No data yet.')}</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={steps} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} stroke={GRIDLINE} />
              <XAxis dataKey="stepName" tick={{ fontSize: 10, fill: AXIS_TEXT }} tickFormatter={(v) => String(v).replace(/_/g, ' ')} />
              <YAxis hide allowDecimals={false} />
              <Tooltip {...chartTooltipStyle} formatter={(value) => [value ?? 0, t('Sessions')]} />
              <Bar dataKey="count" fill={SEQUENTIAL_HUE} radius={[4, 4, 0, 0]} barSize={24} />
            </BarChart>
          </ResponsiveContainer>
          {peak > 0 && steps.length > 1 && (
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {t('{{percent}}% completed this funnel', {
                percent: Math.round(((steps[steps.length - 1].count ?? 0) / peak) * 100),
              })}
            </p>
          )}
        </>
      )}
    </ChartCard>
  )
}

export function AnalyticsPage() {
  const { t } = useStaffTranslation()
  const { showToast } = useToast()
  const [days, setDays] = useState(30)
  const { data: summary, isLoading, isFetching } = useGetAnalyticsSummaryQuery({ days })
  const [runRollup, { isLoading: isRunningRollup }] = useRunAnalyticsRollupMutation()

  const totals = useMemo(() => {
    const trend = summary?.dailyTrend ?? []
    const totalVisits = trend.reduce((sum, d) => sum + d.totalPageviews, 0)
    const totalSessions = trend.reduce((sum, d) => sum + d.uniqueSessions, 0)
    const today = trend[trend.length - 1]
    return {
      visitsToday: today?.totalPageviews ?? 0,
      totalVisits,
      totalSessions,
    }
  }, [summary])

  const usedCount = summary?.featureUsage.filter((f) => f.used).length ?? 0
  const totalFeatureCount = summary?.featureUsage.length ?? 0

  const handleRunRollup = async () => {
    try {
      const result = await runRollup().unwrap()
      showToast({
        severity: 'success',
        summary: t('Rollup complete'),
        detail: t('Computed for {{date}}', { date: result.date }),
      })
    } catch (error) {
      showToast({ severity: 'error', summary: t('Rollup failed'), detail: getApiErrorMessage(error) })
    }
  }

  return (
    <div className="temple-scope w-full space-y-4">
      <PageHeader
        eyebrow={t('Temple Management')}
        title={t('Analytics')}
        description={t('Devotee-site activity — visits, top pages, feature usage, and booking-funnel drop-off.')}
        actions={
          <Button
            type="button"
            label={t('Run rollup now')}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            outlined
            size="small"
            loading={isRunningRollup}
            onClick={handleRunRollup}
          />
        }
      />

      <div className="flex items-center gap-2">
        {DAY_RANGE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setDays(option.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              days === option.value
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]'
            }`}
          >
            {t(option.label)}
          </button>
        ))}
        {isFetching && <span className="text-xs text-[var(--color-text-muted)]">{t('Refreshing…')}</span>}
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--color-text-muted)]">{t('Loading analytics…')}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label={t('Visits today')} value={totals.visitsToday.toLocaleString('en-IN')} />
            <StatTile
              label={t('Total visits ({{days}}d)', { days })}
              value={totals.totalVisits.toLocaleString('en-IN')}
            />
            <StatTile
              label={t('Features used')}
              value={`${usedCount} / ${totalFeatureCount}`}
              sub={t('Nav links + quick-action cards with at least one click')}
            />
          </div>

          <ChartCard title={t('Daily visits trend')} subtitle={t('Pageviews per day, last {{days}} days', { days })}>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={summary?.dailyTrend ?? []} margin={{ left: 0, right: 16 }}>
                <CartesianGrid vertical={false} stroke={GRIDLINE} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS_TEXT }} tickFormatter={formatShortDate} />
                <YAxis tick={{ fontSize: 11, fill: AXIS_TEXT }} allowDecimals={false} />
                <Tooltip {...chartTooltipStyle} labelFormatter={(v) => formatShortDate(String(v))} />
                <Line
                  type="monotone"
                  dataKey="totalPageviews"
                  name={t('Pageviews')}
                  stroke={SEQUENTIAL_HUE}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SEQUENTIAL_HUE, stroke: 'var(--color-surface)', strokeWidth: 2 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <ChartCard title={t('Top pages')} subtitle={t('Most-visited devotee pages')}>
              <CountBarChart data={summary?.topPages ?? []} />
            </ChartCard>
            <ChartCard title={t('Top-clicked features')} subtitle={t('Nav links and quick-action cards')}>
              <CountBarChart data={summary?.topClicks ?? []} />
            </ChartCard>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-[var(--color-text-strong)]">{t('Booking-funnel drop-off')}</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(summary?.funnels ?? []).map((funnel) => (
                <FunnelMiniChart key={funnel.funnelName} funnel={funnel} />
              ))}
            </div>
          </div>

          <ChartCard title={t('Used vs. never-used features')} subtitle={t('Every instrumented nav link / quick-action card')}>
            <div className="divide-y divide-[var(--color-border)]">
              {(summary?.featureUsage ?? []).map((feature) => (
                <div key={feature.label} className="flex items-center justify-between py-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block h-2 w-2 rounded-full ${feature.used ? 'bg-emerald-500' : 'bg-gray-300'}`}
                      aria-hidden="true"
                    />
                    <span className="capitalize text-[var(--color-text-strong)]">{labelizeFeature(feature.label)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[var(--color-text-muted)]">{feature.used ? t('Used') : t('Not used yet')}</span>
                    <span className="w-10 text-right text-xs font-medium text-[var(--color-text-strong)]">{feature.count}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </>
      )}
    </div>
  )
}
