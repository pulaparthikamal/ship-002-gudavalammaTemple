import { useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { Activity, AlertTriangle, BarChart3, Cpu, Database, HardDrive, MemoryStick, Network, Plus, RefreshCw, Server, Zap } from 'lucide-react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import {
  useGetAlertsQuery,
  useGetMetricDefinitionsQuery,
  useGetServersQuery,
  useLazyGetMetricSeriesQuery,
} from '@/services/api/endpoints/serverManagementApi'
import type {
  MetricAggregation,
  MetricDefinition,
  MetricGranularity,
  MetricNamespace,
  MetricQueryParams,
  MetricQueryResponse,
  MetricTimeRange,
} from '@/types/serverManagement'
import { classNames } from '@/utils/serverManagementFormat'

const aggregations: MetricAggregation[] = ['avg', 'min', 'max', 'sum', 'count']
const timeRanges: MetricTimeRange[] = ['30m', '1h', '4h', '12h', '24h', '48h', '7d', '30d', 'custom']
const granularities: MetricGranularity[] = ['auto', '1m', '5m', '15m', '1h', '1d']
const chartColors = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#be123c']

interface PlottedMetric {
  id: string
  label: string
  unit: string
  color: string
  params: MetricQueryParams
  response: MetricQueryResponse
}

const defaultDefinition: MetricDefinition = {
  namespace: 'CPU',
  metricName: 'cpuUsagePercent',
  label: 'CPU usage',
  unit: '%',
  description: 'Average CPU utilization percentage.',
}

const formatNumber = (value?: number | null, unit = '') => {
  if (value === null || value === undefined || Number.isNaN(value)) return 'No data'
  const formatted = Math.abs(value) >= 1000 ? value.toLocaleString(undefined, { maximumFractionDigits: 0 }) : value.toFixed(2)
  return `${formatted}${unit === '%' ? '%' : unit ? ` ${unit}` : ''}`
}

const formatTime = (value: string) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

function MetricsTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-xs shadow-lg">
      <p className="font-bold text-[var(--color-text-strong)]">{label ? formatTime(label) : ''}</p>
      <div className="mt-2 space-y-1">
        {payload.map((item) => (
          <div key={item.name} className="flex min-w-44 items-center justify-between gap-4">
            <span className="flex items-center gap-2 text-[var(--color-text-muted)]">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.color }} />
              {item.name}
            </span>
            <span className="font-semibold text-[var(--color-text-strong)]">{formatNumber(Number(item.value))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  getLabel = (item) => item,
}: {
  label: string
  value: T
  options: T[]
  onChange: (value: T) => void
  getLabel?: (value: T) => string
}) {
  return (
    <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold normal-case text-[var(--color-text-strong)] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {getLabel(option)}
          </option>
        ))}
      </select>
    </label>
  )
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: string; icon: ElementType }) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-black text-[var(--color-text-strong)]">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-[var(--color-primary)]" />
      </div>
    </article>
  )
}

export function ServerMetricsPage() {
  const { data: servers = [], isLoading: isServersLoading } = useGetServersQuery()
  const { data: definitions } = useGetMetricDefinitionsQuery()
  const [fetchMetricSeries, { isFetching }] = useLazyGetMetricSeriesQuery()
  const [selectedServerId, setSelectedServerId] = useState('')
  const [namespace, setNamespace] = useState<MetricNamespace>('CPU')
  const [metricName, setMetricName] = useState(defaultDefinition.metricName)
  const [aggregation, setAggregation] = useState<MetricAggregation>('avg')
  const [timeRange, setTimeRange] = useState<MetricTimeRange>('24h')
  const [granularity, setGranularity] = useState<MetricGranularity>('auto')
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [plottedMetrics, setPlottedMetrics] = useState<PlottedMetric[]>([])
  const [insights, setInsights] = useState<Record<string, MetricQueryResponse>>({})
  const { data: alerts = [] } = useGetAlertsQuery({ serverId: selectedServerId, limit: 20 }, { skip: !selectedServerId })

  useEffect(() => {
    if (!selectedServerId && servers.length) {
      setSelectedServerId(servers[0]._id)
    }
  }, [selectedServerId, servers])

  const metricOptions = useMemo(
    () => (definitions?.metrics || [defaultDefinition]).filter((metric) => metric.namespace === namespace),
    [definitions, namespace],
  )
  const selectedMetric = metricOptions.find((metric) => metric.metricName === metricName) || metricOptions[0] || defaultDefinition

  useEffect(() => {
    if (selectedMetric.metricName !== metricName) {
      setMetricName(selectedMetric.metricName)
    }
  }, [metricName, selectedMetric.metricName])

  const buildParams = (definition = selectedMetric): MetricQueryParams => ({
    serverId: selectedServerId,
    namespace: definition.namespace,
    metricName: definition.metricName,
    aggregation,
    timeRange,
    granularity,
    startTime: timeRange === 'custom' ? startTime : undefined,
    endTime: timeRange === 'custom' ? endTime : undefined,
  })

  const addMetric = async (definition = selectedMetric, replace = false) => {
    if (!selectedServerId || (timeRange === 'custom' && (!startTime || !endTime))) return
    const params = buildParams(definition)
    const response = await fetchMetricSeries(params).unwrap()
    const id = `${definition.namespace}:${definition.metricName}:${aggregation}`
    setPlottedMetrics((current) => {
      const nextMetric = {
        id,
        label: `${definition.label} (${aggregation})`,
        unit: response.unit || definition.unit,
        color: chartColors[current.length % chartColors.length],
        params,
        response,
      }
      return replace ? [nextMetric] : [...current.filter((item) => item.id !== id), nextMetric]
    })
  }

  const refreshMetrics = async () => {
    if (!selectedServerId) return
    if (!plottedMetrics.length) {
      await addMetric(selectedMetric, true)
      return
    }

    const refreshed = await Promise.all(
      plottedMetrics.map(async (metric, index) => ({
        ...metric,
        response: await fetchMetricSeries(metric.params).unwrap(),
        color: chartColors[index % chartColors.length],
      })),
    )
    setPlottedMetrics(refreshed)
  }

  useEffect(() => {
    if (selectedServerId) {
      void addMetric(selectedMetric, true)
    }
  }, [selectedServerId])

  useEffect(() => {
    if (!selectedServerId) return

    const loadInsights = async () => {
      const insightMetrics = [
        { namespace: 'CPU' as MetricNamespace, metricName: 'cpuUsagePercent' },
        { namespace: 'Memory' as MetricNamespace, metricName: 'memoryUsagePercent' },
        { namespace: 'Disk' as MetricNamespace, metricName: 'diskUsagePercent' },
        { namespace: 'Network' as MetricNamespace, metricName: 'networkRxBytes' },
        { namespace: 'Network' as MetricNamespace, metricName: 'networkTxBytes' },
        { namespace: 'Application' as MetricNamespace, metricName: 'failedRequests' },
        { namespace: 'Application' as MetricNamespace, metricName: 'responseTime' },
        { namespace: 'Application' as MetricNamespace, metricName: 'uptime' },
        { namespace: 'Process' as MetricNamespace, metricName: 'topCpuProcess' },
      ]
      const entries = await Promise.all(
        insightMetrics.map(async (metric) => {
          const response = await fetchMetricSeries({
            serverId: selectedServerId,
            namespace: metric.namespace,
            metricName: metric.metricName,
            aggregation: 'avg',
            timeRange: '24h',
            granularity: 'auto',
          }).unwrap()
          return [metric.metricName, response] as const
        }),
      )
      setInsights(Object.fromEntries(entries))
    }

    void loadInsights().catch(() => setInsights({}))
  }, [fetchMetricSeries, selectedServerId])

  const chartData = useMemo(() => {
    const byTimestamp = new Map<string, Record<string, string | number>>()
    plottedMetrics.forEach((metric) => {
      metric.response.points.forEach((point) => {
        byTimestamp.set(point.timestamp, {
          ...(byTimestamp.get(point.timestamp) || { timestamp: point.timestamp }),
          [metric.id]: point.value,
        })
      })
    })
    return [...byTimestamp.values()].sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)))
  }, [plottedMetrics])

  const primarySummary = plottedMetrics[0]?.response.summary
  const serverName = servers.find((server) => server._id === selectedServerId)?.name || 'Select server'
  const cpuLatest = insights.cpuUsagePercent?.summary.latest
  const memoryLatest = insights.memoryUsagePercent?.summary.latest
  const diskLatest = insights.diskUsagePercent?.summary.latest
  const alertCount = alerts.length
  const thresholdAlerts = [
    cpuLatest !== null && cpuLatest !== undefined && cpuLatest > 80 ? 'CPU > 80%' : '',
    memoryLatest !== null && memoryLatest !== undefined && memoryLatest > 85 ? 'Memory > 85%' : '',
    diskLatest !== null && diskLatest !== undefined && diskLatest > 90 ? 'Disk > 90%' : '',
  ].filter(Boolean)

  return (
    <main className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Server Agent</p>
          <h1 className="text-3xl font-black text-[var(--color-text-strong)]">Metrics</h1>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Azure-style sampled metrics backed by one-minute server diagnostics.</p>
        </div>
        <button
          type="button"
          onClick={refreshMetrics}
          disabled={!selectedServerId || isFetching}
          className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          <RefreshCw className={classNames('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <section className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:grid-cols-2 xl:grid-cols-7">
        <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)] xl:col-span-2">
          <span>Scope</span>
          <select
            value={selectedServerId}
            onChange={(event) => setSelectedServerId(event.target.value)}
            disabled={isServersLoading}
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold normal-case text-[var(--color-text-strong)] outline-none"
          >
            {servers.map((server) => (
              <option key={server._id} value={server._id}>
                {server.name || server.host}
              </option>
            ))}
          </select>
        </label>
        <SelectField label="Namespace" value={namespace} options={definitions?.namespaces || ['CPU']} onChange={setNamespace} />
        <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
          <span>Metric</span>
          <select
            value={metricName}
            onChange={(event) => setMetricName(event.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold normal-case text-[var(--color-text-strong)] outline-none"
          >
            {metricOptions.map((metric) => (
              <option key={metric.metricName} value={metric.metricName}>
                {metric.label}
              </option>
            ))}
          </select>
        </label>
        <SelectField label="Aggregation" value={aggregation} options={aggregations} onChange={setAggregation} />
        <SelectField label="Time range" value={timeRange} options={timeRanges} onChange={setTimeRange} />
        <SelectField label="Granularity" value={granularity} options={granularities} onChange={setGranularity} />
        {timeRange === 'custom' && (
          <>
            <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
              <span>Start</span>
              <input type="datetime-local" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm normal-case text-[var(--color-text-strong)] outline-none" />
            </label>
            <label className="space-y-1 text-xs font-bold uppercase text-[var(--color-text-muted)]">
              <span>End</span>
              <input type="datetime-local" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm normal-case text-[var(--color-text-strong)] outline-none" />
            </label>
          </>
        )}
        <button
          type="button"
          onClick={() => void addMetric(selectedMetric)}
          disabled={!selectedServerId || isFetching}
          className="inline-flex h-10 items-center justify-center gap-2 self-end rounded-lg border border-[var(--color-border)] px-3 text-sm font-bold text-[var(--color-text-strong)] disabled:opacity-60"
        >
          <Plus className="h-4 w-4" />
          Add metric
        </button>
      </section>

      <section className="grid gap-3 md:grid-cols-4">
        <SummaryCard label="Average" value={formatNumber(primarySummary?.avg, plottedMetrics[0]?.unit)} icon={BarChart3} />
        <SummaryCard label="Minimum" value={formatNumber(primarySummary?.min, plottedMetrics[0]?.unit)} icon={Activity} />
        <SummaryCard label="Maximum" value={formatNumber(primarySummary?.max, plottedMetrics[0]?.unit)} icon={Zap} />
        <SummaryCard label="Latest" value={formatNumber(primarySummary?.latest, plottedMetrics[0]?.unit)} icon={Server} />
      </section>

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[var(--color-text-strong)]">{serverName}</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              {plottedMetrics.length ? `${plottedMetrics.length} metric${plottedMetrics.length === 1 ? '' : 's'} plotted` : 'No metrics plotted'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {plottedMetrics.map((metric) => (
              <button
                key={metric.id}
                type="button"
                onClick={() => setPlottedMetrics((current) => current.filter((item) => item.id !== metric.id))}
                className="rounded-full border border-[var(--color-border)] px-3 py-1 text-xs font-bold text-[var(--color-text-muted)]"
              >
                {metric.label}
              </button>
            ))}
          </div>
        </div>
        <div className="h-96">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 12, right: 24, left: 4, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="timestamp" tickFormatter={formatTime} minTickGap={32} tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <Tooltip content={<MetricsTooltip />} />
                <Legend />
                {plottedMetrics.map((metric) => (
                  <Line key={metric.id} type="monotone" dataKey={metric.id} name={metric.label} stroke={metric.color} strokeWidth={2} dot={false} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="grid h-full place-items-center text-center">
              <div>
                <Database className="mx-auto h-10 w-10 text-[var(--color-text-muted)]" />
                <p className="mt-3 text-sm font-bold text-[var(--color-text-strong)]">No sampled metrics found</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">Keep the server connected until the one-minute sampler writes history.</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="CPU usage" value={formatNumber(cpuLatest, '%')} icon={Cpu} />
        <SummaryCard label="Memory usage" value={formatNumber(memoryLatest, '%')} icon={MemoryStick} />
        <SummaryCard label="Disk usage" value={formatNumber(diskLatest, '%')} icon={HardDrive} />
        <SummaryCard label="Network usage" value={formatNumber((insights.networkRxBytes?.summary.latest || 0) + (insights.networkTxBytes?.summary.latest || 0), 'B/s')} icon={Network} />
        <SummaryCard label="Failed requests" value={formatNumber(insights.failedRequests?.summary.latest, 'count')} icon={AlertTriangle} />
        <SummaryCard label="Response time" value={formatNumber(insights.responseTime?.summary.latest, 'ms')} icon={Activity} />
        <SummaryCard label="Alerts" value={`${alertCount + thresholdAlerts.length}`} icon={AlertTriangle} />
        <SummaryCard label="Top process CPU" value={formatNumber(insights.topCpuProcess?.summary.latest, '%')} icon={Cpu} />
      </section>
    </main>
  )
}
