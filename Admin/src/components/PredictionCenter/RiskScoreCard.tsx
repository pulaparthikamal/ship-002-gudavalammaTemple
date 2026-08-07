import { ShieldAlert } from 'lucide-react'
import type { PredictiveIssue } from '@/types/serverManagement'

interface RiskScoreCardProps {
  predictions: PredictiveIssue[]
}

export function RiskScoreCard({ predictions }: RiskScoreCardProps) {
  const highest = predictions.reduce((max, item) => Math.max(max, item.confidence), 0)
  const critical = predictions.filter((item) => item.severity === 'critical').length
  const high = predictions.filter((item) => item.severity === 'high').length
  const score = Math.round(highest * 100)

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">Risk score</p>
          <p className="mt-1 text-3xl font-bold text-[var(--color-text-strong)]">{score}%</p>
        </div>
        <ShieldAlert className="h-6 w-6 text-[var(--color-warning-text)]" aria-hidden="true" />
      </div>
      <div className="mt-4 h-2 rounded-full bg-[var(--color-surface-muted)]">
        <div className="h-full rounded-full bg-[var(--color-warning-text)]" style={{ width: `${score}%` }} />
      </div>
      <p className="mt-3 text-sm text-[var(--color-text-muted)]">
        {critical} critical and {high} high-confidence forecasts.
      </p>
    </section>
  )
}
