import { useEffect, useState, useRef } from 'react'
import {
  Chart,
  LineElement,
  PointElement,
  LineController,
  CategoryScale,
  LinearScale,
  Filler,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js'
import { Dropdown } from 'primereact/dropdown'
import { Calendar } from 'primereact/calendar'
import { Archive, FileSearch, HardDrive, Trash2, GripHorizontal, Minimize2, Maximize2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetReportQuery, useGetServersQuery } from '@/services/api/endpoints/serverManagementApi'
import { formatDate, formatPercent } from '@/utils/serverManagementFormat'
import { CHART_COLORS } from '@/utils/themeColors'

Chart.register(LineElement, PointElement, LineController, CategoryScale, LinearScale, Filler, Tooltip)

function ReportCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon: typeof HardDrive
}) {
  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-[var(--color-text-strong)]">{value}</p>
        </div>
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-surface-muted)] text-[var(--color-text-strong)]">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </article>
  )
}
interface Series {
  label: string
  data: number[]
  color: string
  fill?: boolean
}

interface GrafanaPanelProps {
  id: string
  title: string
  unit?: string
  series: Series[]
  labels?: string[]
  isPercent?: boolean
  size?: 'minimized' | 'normal' | 'maximized'
  onMinimize?: () => void
  onMaximize?: () => void
  onRestore?: () => void
  onDragStart?: (e: React.DragEvent) => void
}

function GrafanaPanel({ id, title, unit = '', series, labels, isPercent = false, size = 'normal', onMinimize, onMaximize, onRestore, onDragStart }: GrafanaPanelProps) {
  const [isDraggable, setIsDraggable] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<Chart | null>(null)

  const fmt = (v: number) => {
    if (unit === '%') return v.toFixed(1) + '%'
    if (unit === 'MiB') return v.toFixed(1) + ' MiB'
    if (unit === 'MB/s') return v.toFixed(1) + ' MB/s'
    if (unit === 'kB/s') return v >= 1000 ? (v / 1000).toFixed(1) + ' MB/s' : v.toFixed(0) + ' kB/s'
    if (unit === 'cores') return v.toFixed(5)
    return v.toFixed(2)
  }

  const last = series[0]?.data.at(-1) ?? 0

  useEffect(() => {
    if (!canvasRef.current) return
    chartRef.current?.destroy()

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels: labels ?? series[0]?.data.map((_, i) => String(i)),
        datasets: series.map((s) => ({
          label: s.label,
          data: s.data,
          borderColor: s.color,
          borderWidth: 1.5,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointHoverBackgroundColor: s.color,
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 1.5,
          fill: s.fill !== false ? { target: 'origin', above: s.color + '28' } : false,
          tension: 0.35,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: true,
            backgroundColor: 'rgba(15,15,20,0.92)',
            borderColor: 'rgba(255,255,255,0.08)',
            borderWidth: 1,
            titleColor: 'rgba(180,180,200,0.9)',
            bodyColor: '#ffffff',
            titleFont: { size: 10, weight: 'normal' },
            bodyFont: { size: 11, weight: 'bold' },
            padding: { x: 10, y: 8 },
            cornerRadius: 6,
            caretSize: 4,
            displayColors: true,
            boxWidth: 8,
            boxHeight: 8,
            boxPadding: 4,
            callbacks: {
              label: (ctx) => {
                const val = typeof ctx.raw === 'number' ? ctx.raw : Number(ctx.raw)
                return ` ${ctx.dataset.label}: ${fmt(val)}`
              },
            },
          },
        },
        scales: {
          x: {
            ticks: {
              display: true,
              color: 'rgba(128,128,128,0.6)',
              font: { size: 9 },
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 6,
            },
            grid: { color: 'rgba(128,128,128,0.1)', lineWidth: 0.5 },
            border: { display: false },
          },
          y: {
            ticks: {
              color: 'rgba(128,128,128,0.6)',
              font: { size: 10 },
              maxTicksLimit: 3,
              padding: 2,
              callback: (value: number | string) => fmt(Number(value)),
            },
            grid: { color: 'rgba(128,128,128,0.1)', lineWidth: 0.5 },
            border: { display: false },
          },
        },
        layout: { padding: { top: 2, bottom: 0, left: 4, right: 4 } },
      },
    }

    chartRef.current = new Chart(canvasRef.current, config)
    return () => chartRef.current?.destroy()
  }, [series, labels])

  const isMinimized = size === 'minimized'
  const isMaximized = size === 'maximized'

  return (
    <div
      draggable={isDraggable}
      onDragStart={onDragStart}
      className={`group flex flex-col gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 transition-all duration-300 ${isDraggable ? 'cursor-grabbing' : ''}`}
    >
      {/* Header */}
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <div
            onMouseEnter={() => setIsDraggable(true)}
            onMouseLeave={() => setIsDraggable(false)}
            className="cursor-grab text-[var(--color-text-muted)] opacity-0 transition-opacity group-hover:opacity-100"
            title="Drag to reorder"
          >
            <GripHorizontal className="h-4 w-4" />
          </div>
          <span className="text-xs font-medium text-[var(--color-text-muted)]">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-lg font-medium text-[var(--color-text-strong)]">{fmt(last)}</span>
          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {!isMinimized && (
              <button
                onClick={onMinimize}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Minimize"
              >
                <Minimize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isMinimized && (
              <button
                onClick={onRestore}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Restore size"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {!isMaximized && !isMinimized && (
              <button
                onClick={onMaximize}
                className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
                title="Maximize"
              >
                <Maximize2 className="h-3.5 w-3.5" />
              </button>
            )}
            {isMaximized && (
              <button
                onClick={onRestore}
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
          {/* Progress bar — only for percent metrics */}
          {isPercent && (
            <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, Math.max(0, last))}%`,
                  backgroundColor: series[0]?.color,
                }}
              />
            </div>
          )}

          {/* Sparkline */}
          <div className="relative w-full transition-all duration-300" style={{ height: isMaximized ? 200 : 100 }}>
            <canvas
              ref={canvasRef}
              id={`grafana-chart-${id}`}
              role="img"
              aria-label={`${title} time-series chart`}
            />
          </div>

          {/* Legend table */}
          <div className="mt-0.5 flex flex-col gap-0.5 border-t border-[var(--color-border)] pt-1.5">
            {/* Column headers */}
            <div className="flex justify-end gap-3 pb-0.5">
              {['Last', 'Max', 'Min'].map((h) => (
                <span key={h} className="min-w-[48px] text-right text-[10px] text-[var(--color-text-muted)]">
                  {h}
                </span>
              ))}
            </div>

            {/* Series rows */}
            {series.map((s) => {
              const sLast = s.data.at(-1) ?? 0
              const sMax = Math.max(...s.data)
              const sMin = Math.min(...s.data)
              return (
                <div key={s.label} className="flex items-center justify-between text-[11px]">
                  <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
                    <span
                      className="flex-shrink-0 rounded"
                      style={{ backgroundColor: s.color, height: 2, width: 14 }}
                    />
                    <span className="truncate text-[var(--color-text-muted)]" title={s.label}>
                      {s.label}
                    </span>
                  </div>
                  <div className="flex flex-shrink-0 gap-3">
                    {[sLast, sMax, sMin].map((v, i) => (
                      <span key={i} className="min-w-[48px] text-right font-medium text-[var(--color-text-strong)]">
                        {fmt(v)}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function LatestMetadataCards({ actions }: { actions: any[] }) {
  if (!actions || actions.length === 0) return null
  const reversedActions = [...actions].reverse();
  const getSeries = (key: string) => reversedActions.map((a) => Number(a.metadata?.[key] || 0))
  const getLabels = () =>
    reversedActions.map((a) =>
      a.created
        ? new Intl.DateTimeFormat(undefined, { timeStyle: 'short' }).format(new Date(a.created))
        : ''
    )

  const labels = getLabels()
  const latest = actions[0]?.metadata || {}

  type CardSize = 'minimized' | 'normal' | 'maximized'
  const [cardsState, setCardsState] = useState<Record<string, { size: CardSize; order: number }>>(() => {
    try {
      const saved = localStorage.getItem('dashboard-cards-state')
      if (saved) return JSON.parse(saved)
    } catch (e) {
      // ignore
    }
    return {}
  })

  useEffect(() => {
    localStorage.setItem('dashboard-cards-state', JSON.stringify(cardsState))
  }, [cardsState])

  const handleSizeChange = (id: string, newSize: CardSize) => {
    setCardsState((prev) => ({
      ...prev,
      [id]: { ...prev[id], size: newSize, order: prev[id]?.order ?? 0 },
    }))
  }

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const panels: (GrafanaPanelProps | false)[] = [
    latest.cpuUsagePercent !== undefined && {
      id: 'cpu',
      title: 'CPU Usage',
      unit: '%',
      isPercent: true,
      series: [{ label: 'cpu usage', color: CHART_COLORS.cpu.stroke, data: getSeries('cpuUsagePercent'), fill: true }],
    },
    latest.memoryUsagePercent !== undefined && {
      id: 'mem',
      title: 'Memory Usage',
      unit: '%',
      isPercent: true,
      series: [{ label: 'memory usage', color: CHART_COLORS.memory.stroke, data: getSeries('memoryUsagePercent'), fill: true }],
    },
    latest.diskUsagePercent !== undefined && {
      id: 'disk',
      title: 'Disk Usage',
      unit: '%',
      isPercent: true,
      series: [{ label: 'disk usage', color: CHART_COLORS.disk.stroke, data: getSeries('diskUsagePercent'), fill: true }],
    },
    latest.loadAverage !== undefined && {
      id: 'load',
      title: 'Load Average',
      unit: '',
      isPercent: false,
      series: [{ label: 'load avg', color: CHART_COLORS.load.stroke, data: getSeries('loadAverage'), fill: true }],
    },
    latest.networkDownloadSpeed !== undefined && {
      id: 'dl',
      title: 'Download Speed',
      unit: 'MB/s',
      isPercent: false,
      series: [{ label: 'download', color: CHART_COLORS.download.stroke, data: getSeries('networkDownloadSpeed'), fill: true }],
    },
    latest.networkUploadSpeed !== undefined && {
      id: 'ul',
      title: 'Upload Speed',
      unit: 'MB/s',
      isPercent: false,
      series: [{ label: 'upload', color: CHART_COLORS.upload.stroke, data: getSeries('networkUploadSpeed'), fill: true }],
    },
  ]

  const validPanels = panels.filter(Boolean) as GrafanaPanelProps[]
  const sortedPanels = [...validPanels].sort((a, b) => {
    const orderA = cardsState[a.id]?.order ?? 999
    const orderB = cardsState[b.id]?.order ?? 999
    return orderA - orderB
  })

  const handleDrop = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId && sourceId !== targetId) {
      setCardsState((prev) => {
        const currentOrderedIds = sortedPanels.map((p) => p.id)
        const sourceIdx = currentOrderedIds.indexOf(sourceId)
        const targetIdx = currentOrderedIds.indexOf(targetId)

        if (sourceIdx !== -1 && targetIdx !== -1) {
          const newOrderedIds = [...currentOrderedIds]
          newOrderedIds.splice(sourceIdx, 1)
          newOrderedIds.splice(targetIdx, 0, sourceId)

          const newState = { ...prev }
          newOrderedIds.forEach((id, index) => {
            if (!newState[id]) {
              newState[id] = { size: 'normal', order: index }
            } else {
              newState[id] = { ...newState[id], order: index }
            }
          })
          return newState
        }
        return prev
      })
    }
  }

  return (
    <section className={`grid grid-cols-1 gap-4 ${actions?.length > 120 ? 'md:grid-cols-2 lg:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>
      {sortedPanels.map((panel) => {
        const size = cardsState[panel.id]?.size || 'normal'
        return (
          <div
            key={panel.id}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, panel.id)}
            className={`transition-all duration-300 ease-in-out ${
              size === 'maximized' ? 'row-span-2 md:col-span-2 lg:col-span-2' : ''
            }`}
          >
            <GrafanaPanel
              {...panel}
              labels={labels}
              size={size}
              onMinimize={() => handleSizeChange(panel.id, 'minimized')}
              onMaximize={() => handleSizeChange(panel.id, 'maximized')}
              onRestore={() => handleSizeChange(panel.id, 'normal')}
              onDragStart={(e) => handleDragStart(e, panel.id)}
            />
          </div>
        )
      })}
    </section>
  )
}

export function ServerReportsPage() {
  const [selectedServerId, setSelectedServerId] = useState<string>()
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'custom'>('daily')
  const [selectedDate, setSelectedDate] = useState<(Date | null)[]>([new Date(), new Date()])

  const getDateRange = (date: (Date | null)[]) => {
    const toRange = (start: Date | null, end?: Date | null) => {
      if (!start) return {}
      const s = new Date(start), e = new Date(end || start)
      s.setHours(0, 0, 0, 0)
      e.setHours(23, 59, 59, 999)
      return { startDate: s.toISOString(), endDate: e.toISOString() }
    }
    return toRange(date[0], date[1])
  }

  const { data: servers = [], isLoading: isServersLoading } = useGetServersQuery()
  const { data: report, isFetching: isReportFetching } = useGetReportQuery(
    {
      serverId: selectedServerId ?? '',
      ...getDateRange(selectedDate),
    },
    { skip: !selectedServerId }
  )

  const isInitializing = !selectedServerId && servers.length > 0
  const isLoading = isServersLoading || isReportFetching || isInitializing

  useEffect(() => {
    if (!selectedServerId && servers[0]?._id) {
      setSelectedServerId(servers[0]._id)
    }
  }, [selectedServerId, servers])

  const handlePeriodChange = (option: 'daily' | 'weekly' | 'custom') => {
    setPeriod(option)
    if (option === 'daily') {
      const today = new Date()
      setSelectedDate([today, today])
    } else if (option === 'weekly') {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      setSelectedDate([start, end])
    }
    // 'custom' — leave selectedDate as-is; user picks via the calendar
  }

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <LoadingScreen className="bg-[var(--color-page)]/60 backdrop-blur-sm" message="Loading report data..." />
        </div>
      )}
      <div className="mx-auto max-w-full space-y-5">
        <PageHeader
        eyebrow="Reports"
        title="Storage and maintenance summaries"
        description="Daily and weekly summaries for usage, cleanup, and action history."
      />

      <section className="flex flex-col gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 md:flex-row md:items-end md:justify-between">
        <label className="w-full max-w-md space-y-1">
          <span className="text-sm font-semibold text-[var(--color-text-strong)]">Server</span>
          <Dropdown
            className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm flex items-center transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
            value={selectedServerId ?? ''}
            onChange={(e) => setSelectedServerId(e.value || undefined)}
            options={servers.map((server) => ({ label: `${server.name} (${server.host})`, value: server._id }))}
            placeholder="Select a Server"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-[var(--color-border)] p-1">
            {(['daily', 'weekly', 'custom'] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={`h-8 rounded-md px-3 text-sm font-semibold capitalize ${period === option ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text)]'
                  }`}
                onClick={() => handlePeriodChange(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {period === 'custom' && (
            <div className="relative">
              <Calendar
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.value as (Date | null)[])}
                selectionMode="range"
                readOnlyInput
                hideOnRangeSelection
                dateFormat="yy-mm-dd"
                maxDate={new Date()}
                className="h-10 w-64 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm flex items-center transition-colors focus-within:ring-2 focus-within:ring-[var(--color-primary)]/20"
                placeholder="Select Date Range"
                showIcon
              />
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ReportCard label="Avg disk" value={formatPercent(report?.storageUsage.avgDiskPercent)} icon={HardDrive} />
        <ReportCard label="Files scanned" value={report?.files.scanned ?? 0} icon={FileSearch} />
        <ReportCard label="Files cleaned" value={report?.files.cleaned ?? 0} icon={Trash2} />
        <ReportCard label="Cleaned MB" value={report?.files.storageCleanedMb ?? 0} icon={Archive} />
      </section>

      {/* display the all the data */}
      {report?.recentActions?.length && report.recentActions.length > 0 && (
        <LatestMetadataCards actions={report?.recentActions} />
      )}

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-semibold text-[var(--color-text-strong)]">Category summary</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(report?.files.byCategory ?? {}).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] pb-2 last:border-0">
                <span className="font-medium text-[var(--color-text-strong)]">{category}</span>
                <span className="text-[var(--color-text-muted)]">{count}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="font-semibold text-[var(--color-text-strong)]">Recent actions</h2>
          <div className="mt-4 space-y-3 max-h-[300px] overflow-y-auto">
            {(report?.recentActions ?? []).map((action) => (
              <div key={action._id} className="border-b border-[var(--color-border)] pb-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium text-[var(--color-text-strong)]">{action.action}</p>
                  <p className="text-xs text-[var(--color-text-muted)]">{formatDate(action.created)}</p>
                </div>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">{action.reason}</p>
              </div>
            ))}
            {!report?.recentActions?.length ? <p className="text-sm text-[var(--color-text-muted)]">No actions in this period.</p> : null}
          </div>
        </div>
      </section>
      </div>
    </>
  )
}
