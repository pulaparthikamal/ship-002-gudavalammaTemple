import { AlertTriangle, Activity, Server } from 'lucide-react'
import type { MonitoringHealthScore, MonitoringMetricHistory, MonitoringResourceSpike } from '@/types/serverManagement'

type TimelineItem = {
  id: string
  time: string
  title: string
  detail: string
  tone: 'neutral' | 'warning' | 'critical' | 'success'
}

const toneClass: Record<TimelineItem['tone'], string> = {
  neutral: 'bg-slate-50 text-slate-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-rose-50 text-rose-700',
  success: 'bg-emerald-50 text-emerald-700',
}

export function InfrastructureTimeline({
  metrics,
  healthScores,
  spikes,
}: {
  metrics: MonitoringMetricHistory[]
  healthScores: MonitoringHealthScore[]
  spikes: MonitoringResourceSpike[]
}) {
  const metricItems = metrics.slice(0, 4).map<TimelineItem>((metric) => ({
    id: `metric-${metric._id}`,
    time: metric.collectedAt,
    title: 'Monitor sample collected',
    detail: `${metric.os.name} · CPU ${metric.cpuUsagePercent.toFixed(1)}% · Memory ${metric.memoryUsagePercent.toFixed(1)}%`,
    tone: 'neutral',
  }))
  const healthItems = healthScores.slice(0, 4).map<TimelineItem>((score) => ({
    id: `health-${score._id}`,
    time: score.calculatedAt,
    title: `Health ${score.status}`,
    detail: `Score ${score.score}${score.reasons[0] ? ` · ${score.reasons[0]}` : ''}`,
    tone: score.status === 'critical' ? 'critical' : score.status === 'healthy' ? 'success' : 'warning',
  }))
  const spikeItems = spikes.slice(0, 6).map<TimelineItem>((spike) => ({
    id: `spike-${spike._id}`,
    time: spike.detectedAt,
    title: spike.metric.replace(/_/g, ' '),
    detail: spike.message,
    tone: spike.severity === 'critical' ? 'critical' : 'warning',
  }))
  const items = [...metricItems, ...healthItems, ...spikeItems]
    .sort((first, second) => new Date(second.time).getTime() - new Date(first.time).getTime())
    .slice(0, 12)

  return (
    <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <h3 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Infrastructure timeline</h3>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-1 lg:grid-cols-2">
        {items.map((item) => {
          const Icon = item.title.includes('spike') ? AlertTriangle : item.title.includes('Health') ? Activity : Server
          return (
            <div
              key={item.id}
              className="group flex gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 shadow-sm transition-all duration-300 hover:shadow-md hover:border-[var(--color-primary)]/30 hover:-translate-y-0.5"
            >
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${toneClass[item.tone]} shadow-sm transition-transform duration-300 group-hover:scale-105`}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <div className="min-w-0 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-sm font-black text-[var(--color-text-strong)] truncate capitalize" title={item.title}>
                    {item.title}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2 leading-relaxed" title={item.detail}>
                    {item.detail}
                  </p>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-[var(--color-text-muted)] tracking-tight">
                  {new Date(item.time).toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </article>
  )

}
