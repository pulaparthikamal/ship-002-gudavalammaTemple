import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { Button } from 'primereact/button'

export type RcmSummarySeverity = 'success' | 'warning' | 'danger' | 'neutral'

export type RcmJourneyStep = {
  label: string
  status?: string
  detail?: string
  severity?: RcmSummarySeverity
}

export type RcmViewAction = {
  label: string
  helper?: string
  disabled?: boolean
  icon?: ReactNode
  onClick: () => void
}

type RcmViewSummaryProps = {
  title: string
  subtitle?: string
  status?: string
  severity?: RcmSummarySeverity
  facts?: Array<[string, ReactNode]>
  alerts?: Array<{ title: string; detail?: string; severity?: RcmSummarySeverity }>
  journey?: RcmJourneyStep[]
  actions?: RcmViewAction[]
}

const severityClass: Record<RcmSummarySeverity, string> = {
  success: 'border-[var(--color-success-border)] bg-[var(--color-success-soft)] text-[var(--color-success-text)]',
  warning: 'border-[var(--color-warning-text)]/30 bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]',
  danger: 'border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]',
  neutral: 'border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
}

function normalizeSeverity(value?: RcmSummarySeverity) {
  return value ?? 'neutral'
}

export function RcmViewSummary({
  title,
  subtitle,
  status,
  severity = 'neutral',
  facts = [],
  alerts = [],
  journey = [],
  actions = [],
}: RcmViewSummaryProps) {
  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--color-text-strong)]">{title}</h3>
          {subtitle ? <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {status ? (
          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-semibold ${severityClass[severity]}`}>
            {status}
          </span>
        ) : null}
      </div>

      {facts.length ? (
        <dl className="grid gap-3 sm:grid-cols-3">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
              <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text-strong)]">{value || '-'}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {journey.length ? (
        <div className="grid gap-2 md:grid-cols-4">
          {journey.map((step) => {
            const stepSeverity = normalizeSeverity(step.severity)
            return (
              <div key={step.label} className={`rounded-md border p-3 ${severityClass[stepSeverity]}`}>
                <p className="text-[11px] font-semibold uppercase tracking-normal opacity-80">{step.label}</p>
                <p className="mt-1 text-sm font-bold">{step.status ?? '-'}</p>
                {step.detail ? <p className="mt-1 text-xs opacity-85">{step.detail}</p> : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {alerts.length ? (
        <div className="space-y-2">
          {alerts.map((alert) => {
            const alertSeverity = normalizeSeverity(alert.severity)
            return (
              <div key={`${alert.title}-${alert.detail ?? ''}`} className={`rounded-md border px-3 py-2 ${severityClass[alertSeverity]}`}>
                <p className="text-sm font-semibold">{alert.title}</p>
                {alert.detail ? <p className="mt-1 text-xs opacity-90">{alert.detail}</p> : null}
              </div>
            )
          })}
        </div>
      ) : null}

      {actions.length ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--color-border)] pt-3">
          {actions.map((action) => (
            <Button
              key={action.label}
              type="button"
              label={action.label}
              icon={action.icon ?? <ArrowRight className="h-3.5 w-3.5" />}
              className="h-8 px-3 text-xs font-semibold"
              disabled={action.disabled}
              tooltip={action.helper}
              onClick={action.onClick}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}
