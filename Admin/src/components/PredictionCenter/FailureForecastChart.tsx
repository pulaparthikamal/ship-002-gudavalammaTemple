import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PredictiveIssue } from '@/types/serverManagement'

interface FailureForecastChartProps {
  predictions: PredictiveIssue[]
}

export function FailureForecastChart({ predictions }: FailureForecastChartProps) {
  const data = predictions.map((item) => ({
    name: item.issue,
    horizon: item.horizonMinutes,
    risk: Math.round(item.confidence * 100),
  }))

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-bold text-[var(--color-text-strong)]">Failure Forecast</h2>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="horizon" tickLine={false} axisLine={false} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} />
            <Tooltip />
            <Line type="monotone" dataKey="risk" stroke="var(--color-warning-text)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
