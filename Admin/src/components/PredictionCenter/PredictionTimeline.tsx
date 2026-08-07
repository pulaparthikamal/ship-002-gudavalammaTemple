import type { Prediction } from '@/types/serverManagement'

interface PredictionTimelineProps {
  predictions: Prediction[]
}

export function PredictionTimeline({ predictions }: PredictionTimelineProps) {
  return (
    <section className="space-y-3">
      {predictions.map((record) => (
        <article key={record._id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">{new Date(record.created).toLocaleString()}</p>
            <span className="text-xs font-semibold text-[var(--color-text-muted)]">{record.predictions.length} forecasts</span>
          </div>
          <div className="mt-3 space-y-2">
            {record.predictions.slice(0, 3).map((item, index) => (
              <div key={`${record._id}-${index}`} className="border-l-2 border-[var(--color-border)] pl-3">
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">{item.issue}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{item.predictedFailure}</p>
              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  )
}
