import type { Anomaly } from '@/types/serverManagement'

interface SpikeDetectionPanelProps {
  anomalies: Anomaly[]
}

export function SpikeDetectionPanel({ anomalies }: SpikeDetectionPanelProps) {
  const spikes = anomalies.filter((item) => item.detector === 'threshold_statistical' || item.title.toLowerCase().includes('spike'))

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--color-text-strong)]">Spike Detection</h2>
      <div className="mt-3 divide-y divide-[var(--color-border)]">
        {spikes.map((spike, index) => (
          <div key={spike._id ?? `${spike.type}-${index}`} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">{spike.title}</p>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">{spike.detector}</span>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Value {spike.value} against baseline {spike.baseline} and threshold {spike.threshold}.
            </p>
          </div>
        ))}
        {!spikes.length && <p className="text-sm text-[var(--color-text-muted)]">No spike anomalies in the selected window.</p>}
      </div>
    </section>
  )
}
