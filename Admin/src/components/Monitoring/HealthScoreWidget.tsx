import { ShieldCheck, ShieldAlert } from 'lucide-react'
import type { MonitoringHealthScore } from '@/types/serverManagement'

const toneByStatus: Record<MonitoringHealthScore['status'], string> = {
  healthy: 'text-emerald-600',
  watch: 'text-amber-600',
  degraded: 'text-orange-600',
  critical: 'text-rose-600',
}

export function HealthScoreWidget({ healthScore }: { healthScore?: MonitoringHealthScore }) {
  const score = healthScore?.score ?? 0
  const Icon = score >= 85 ? ShieldCheck : ShieldAlert
  const tone = healthScore ? toneByStatus[healthScore.status] : 'text-[var(--color-text-muted)]'

  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-20 w-20 place-items-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)]">
        <svg className="absolute inset-1" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r="31" fill="none" stroke="var(--color-border)" strokeWidth="6" />
          <circle
            cx="36"
            cy="36"
            r="31"
            fill="none"
            stroke="currentColor"
            strokeDasharray={`${Math.max(0, Math.min(score, 100)) * 1.95} 195`}
            strokeLinecap="round"
            strokeWidth="6"
            className={tone}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <span className={`relative text-xl font-bold ${tone}`}>{score}</span>
      </div>
      <div>
        <div className={`flex items-center gap-2 text-sm font-semibold uppercase ${tone}`}>
          <Icon className="h-4 w-4" />
          {healthScore?.status ?? 'No data'}
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          {healthScore?.reasons[0] ?? 'Waiting for lightweight monitoring samples.'}
        </p>
      </div>
    </div>
  )
}
