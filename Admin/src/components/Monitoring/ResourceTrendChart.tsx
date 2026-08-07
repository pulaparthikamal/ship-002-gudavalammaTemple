import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AlertTriangle, Maximize2, Minimize2 } from 'lucide-react'
import type { MonitoringMetricHistory, MonitoringResourceSpike } from '@/types/serverManagement'

type ResourceKey = 'cpuUsagePercent' | 'memoryUsagePercent' | 'diskUsagePercent' | 'loadAverage'

export interface TrendPoint {
  collectedAt: string | Date
  cpuUsagePercent?: number
  cpuDeltaPercent?: number
  trend?: 'up' | 'down' | 'stable'
  isSpike?: boolean
  spikeSeverity?: 'low' | 'medium' | 'high'
  probableReason?: string
  topProcesses?: Array<{
    pid: string
    cpuPercent: number
    memoryPercent: number
    name: string
  }>
  runningProcessCount?: number
  memoryUsagePercent?: number
  diskUsagePercent?: number
  loadAverage?: number
}

const labelByKey: Record<ResourceKey, string> = {
  cpuUsagePercent: 'CPU',
  memoryUsagePercent: 'Memory',
  diskUsagePercent: 'Disk',
  loadAverage: 'Load',
}

const unitByKey: Record<ResourceKey, string> = {
  cpuUsagePercent: '%',
  memoryUsagePercent: '%',
  diskUsagePercent: '%',
  loadAverage: '',
}

type ChartPoint = TrendPoint & {
  time: string
  fullTime: string
  value: number
  timestamp: number
  spikes: MonitoringResourceSpike[]
}

type DotProps = {
  cx?: number
  cy?: number
  payload?: ChartPoint
}

export function ResourceTrendChart({
  metrics,
  resourceKey,
  spikes = [],
  isLive = false,
  showSeconds = false,
  yDomain,
  rightAccessory,
  showDiagnostics = false,
  footerNote,
}: {
  metrics: Array<MonitoringMetricHistory | TrendPoint>
  resourceKey: ResourceKey
  spikes?: MonitoringResourceSpike[]
  isLive?: boolean
  showSeconds?: boolean
  yDomain?: [number | string, number | string]
  rightAccessory?: ReactNode
  showDiagnostics?: boolean
  footerNote?: string
}) {
  const [size, setSize] = useState<'normal' | 'minimized' | 'maximized'>('normal')

  const data = [...metrics]
    .reverse()
    .map<ChartPoint>((metric) => {
      const collectedAt = new Date(metric.collectedAt)

      return {
        ...metric,
        time: collectedAt.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          ...(showSeconds ? { second: '2-digit' } : {}),
        }),
        fullTime: collectedAt.toLocaleString([], {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          ...(showSeconds ? { second: '2-digit' } : {}),
        }),
        value: Number(metric[resourceKey] ?? 0),
        timestamp: collectedAt.getTime(),
        spikes: [],
      }
    })

  spikes.forEach((spike) => {
    const spikeTime = new Date(spike.detectedAt).getTime()
    let closestData = data[0]
    let minDiff = Infinity
    for (const item of data) {
      const diff = Math.abs(item.timestamp - spikeTime)
      if (diff < minDiff) {
        minDiff = diff
        closestData = item
      }
    }
    if (closestData) {
      closestData.spikes.push(spike)
    }
  })

  const unit = unitByKey[resourceKey]
  const values = data.map((item) => item.value).filter((value) => Number.isFinite(value))
  const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0
  const minimum = values.length ? Math.min(...values) : 0
  const maximum = values.length ? Math.max(...values) : 0
  const latest = values.length ? values[values.length - 1] : 0
  const summaryCards = [
    { label: 'Average', value: average, detail: 'over selected range' },
    { label: 'Maximum', value: maximum, detail: 'peak value' },
    { label: 'Minimum', value: minimum, detail: 'floor value' },
    { label: 'Latest', value: latest, detail: 'most recent' },
  ]
  const formatMetricValue = (value: number) => `${value.toFixed(resourceKey === 'loadAverage' ? 2 : 1)}${unit}`

  const renderTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null

    const point = payload[0].payload as ChartPoint | undefined
    if (!point) return null
    const topProcess = point.topProcesses?.[0]

    if (showDiagnostics) {
      return (
        <div className="max-w-xs rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text-muted)] shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold text-[var(--color-text-strong)]">{point.fullTime}</p>
              <p className="mt-1 text-[var(--color-text-muted)]">
                CPU: <span className="font-semibold text-[var(--color-text-strong)]">{point.value.toFixed(1)}%</span>
              </p>
            </div>
            {point.isSpike && (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 font-bold uppercase text-rose-600 ring-1 ring-rose-200">
                {point.spikeSeverity || 'spike'}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1 text-[var(--color-text-muted)]">
            <p>Trend: <span className="font-semibold capitalize text-[var(--color-text-strong)]">{point.trend || 'stable'}</span></p>
            <p>Delta: <span className="font-semibold text-[var(--color-text-strong)]">{Number(point.cpuDeltaPercent || 0).toFixed(1)}%</span></p>
            <p>Reason: <span className="text-[var(--color-text-strong)]">{point.probableReason || 'No clear process-level cause found.'}</span></p>
            <p>Top process: <span className="font-semibold text-[var(--color-text-strong)]">{topProcess ? `${topProcess.name} (${topProcess.cpuPercent.toFixed(1)}%)` : 'n/a'}</span></p>
            <p>Memory: <span className="font-semibold text-[var(--color-text-strong)]">{Number(point.memoryUsagePercent || 0).toFixed(1)}%</span></p>
            <p>Load average: <span className="font-semibold text-[var(--color-text-strong)]">{Number(point.loadAverage || 0).toFixed(2)}</span></p>
          </div>
        </div>
      )
    }

    return (
      <div className="z-50 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-xl">
        <p className="mb-1 text-xs font-bold text-[var(--color-text-muted)]">{label || point.fullTime}</p>
        <p className="text-sm font-semibold text-[var(--color-primary)]">
          {labelByKey[resourceKey]}: {formatMetricValue(point.value)}
        </p>
        {point.spikes.length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {point.spikes.map((spike) => (
              <div
                key={spike._id}
                className="flex items-start gap-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <div>
                  <p className="text-xs font-bold capitalize">{spike.metric.replace(/_/g, ' ')}</p>
                  <p className="mt-0.5 text-[11px] leading-tight opacity-90">{spike.message}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  const isMinimized = size === 'minimized'
  const isMaximized = size === 'maximized'

  return (
    <div className={`space-y-5 transition-all duration-300 ${isMaximized ? 'col-span-full' : ''}`}>
      <div className="grid gap-3 md:grid-cols-4">
        {summaryCards.map((item) => (
          <article key={item.label} className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <p className="text-sm font-bold text-[var(--color-text-muted)]">~ {item.label}</p>
            <p className="mt-1 text-3xl font-black leading-none text-[var(--color-text-strong)]">{formatMetricValue(item.value)}</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text-muted)]">{item.detail}</p>
          </article>
        ))}
      </div>

      <article className={`space-y-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-all duration-300 ${isMaximized ? 'col-span-full' : ''}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-black text-[var(--color-text-strong)]">
            {labelByKey[resourceKey]} - {resourceKey} - {isLive ? 'Live' : 'Selected range'}
          </h3>
          {isLive && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-600 ring-1 ring-emerald-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              LIVE
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {rightAccessory}
          <span className="text-sm font-bold text-[var(--color-text-muted)]">{isLive ? 'Live stream' : 'Auto granularity'} - {data.length} data points</span>
          <div className="flex gap-1">
            {!isMinimized && (
              <button
                type="button"
                onClick={() => setSize('minimized')}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isMinimized && (
              <button
                type="button"
                onClick={() => setSize('normal')}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Restore size"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {!isMaximized && !isMinimized && (
              <button
                type="button"
                onClick={() => setSize('maximized')}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Maximize"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isMaximized && (
              <button
                type="button"
                onClick={() => setSize('normal')}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Restore size"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
      {!isMinimized && (
        <div className="animate-in fade-in slide-in-from-top-2 flex flex-col gap-1 duration-300">
          <div className={`transition-all duration-300 ${isMaximized ? 'h-[400px]' : 'h-72'}`}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }} interval="preserveStartEnd" axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fontSize: 12, fill: 'var(--color-text-muted)' }}
                  width={42}
                  domain={yDomain}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(value: number) => `${value}${unit}`}
                />
                <Tooltip content={renderTooltip} />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--color-primary)"
                  fill="var(--color-primary-soft)"
                  strokeWidth={2}
                  dot={(props: DotProps) => (
                    props.payload?.isSpike && props.cx !== undefined && props.cy !== undefined
                      ? (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={4}
                          fill="#e11d48"
                          stroke="var(--color-surface)"
                          strokeWidth={2}
                        />
                      )
                      : <circle cx={props.cx ?? 0} cy={props.cy ?? 0} r={0} fill="transparent" />
                  )}
                  activeDot={{ r: 4 }}
                  isAnimationActive={!isLive}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 grid border-t border-[var(--color-border)] pt-4 text-center md:grid-cols-4">
            {summaryCards.map((item) => (
              <div key={`footer-${item.label}`}>
                <p className="text-sm font-bold text-[var(--color-text-muted)]">{item.label}</p>
                <p className="text-lg font-black text-[var(--color-text-strong)]">{formatMetricValue(item.value)}</p>
              </div>
            ))}
          </div>
          {footerNote && <p className="text-xs text-[var(--color-text-muted)]">{footerNote}</p>}
        </div>
      )}
    </article>
    </div>
  )
}
