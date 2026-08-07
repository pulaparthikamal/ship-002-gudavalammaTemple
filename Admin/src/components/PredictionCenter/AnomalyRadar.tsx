import { Radar } from 'lucide-react'
import type { Anomaly } from '@/types/serverManagement'

interface AnomalyRadarProps {
  anomalies: Anomaly[]
}

export function AnomalyRadar({ anomalies }: AnomalyRadarProps) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2">
        <Radar className="h-5 w-5 text-[var(--color-info-text)]" aria-hidden="true" />
        <h2 className="text-sm font-bold text-[var(--color-text-strong)]">Anomaly Radar</h2>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {anomalies.map((anomaly, index) => (
          <div key={anomaly._id ?? `${anomaly.type}-${index}`} className="rounded-md border border-[var(--color-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">{anomaly.component}</p>
              <span className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">{anomaly.severity}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">{anomaly.title}</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text-strong)]">
              {Math.round(anomaly.confidence * 100)}% confidence
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
