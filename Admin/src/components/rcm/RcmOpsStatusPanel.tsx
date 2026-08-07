import { Activity, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useGetRcmOpsHealthQuery } from '@/services/api/endpoints/rcmOpsApi'

function valueOrDash(value: unknown) {
  return value === null || value === undefined || value === '' ? '-' : String(value)
}

export function RcmOpsStatusPanel() {
  const { data, isLoading, isError } = useGetRcmOpsHealthQuery(undefined, {
    pollingInterval: 60000,
  })

  const degraded = data?.status === 'DEGRADED' || isError
  const workerRunning = Boolean(data?.queue?.worker?.running)
  const warnings = data?.warnings ?? []

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {degraded ? <AlertTriangle className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
          <div>
            <h2 className="text-base font-semibold text-[var(--color-text-strong)]">RCM Ops</h2>
            <p className="text-sm text-[var(--color-text-muted)]">
              Queue, webhook, and clearinghouse processing health.
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text)]">
          <Activity className="h-3.5 w-3.5" />
          {isLoading ? 'Loading' : valueOrDash(data?.status)}
        </span>
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Queued</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.queue?.queued)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Running</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.queue?.running)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Failed</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.queue?.failed)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Dead Letter</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.queue?.deadLetter)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Worker</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">
            {data?.queue?.workerEnabled ? (workerRunning ? 'Running' : 'Stopped') : 'Off'}
          </dd>
        </div>
      </dl>

      <dl className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Awaiting ERA</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.metrics?.acceptedClaimsAwaitingEra)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">ERA Exceptions</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.metrics?.eraExceptions)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Posting Imbalance</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.metrics?.postingImbalances)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Pending Acks</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.metrics?.pendingAcknowledgements)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Stale Jobs</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.metrics?.staleQueueJobs ?? data?.queue?.stale)}</dd>
        </div>
        <div className="rounded-md bg-[var(--color-surface-muted)] p-3">
          <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Recovered</dt>
          <dd className="mt-1 text-lg font-semibold text-[var(--color-text-strong)]">{valueOrDash(data?.metrics?.recoveredQueueJobs ?? data?.queue?.recovered)}</dd>
        </div>
      </dl>

      {(warnings.length > 0 || data?.metrics?.latestFailedJob) && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p className="font-semibold">Operations warnings</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
            {data?.metrics?.latestFailedJob && (
              <li>
                Latest failed job: {valueOrDash(data.metrics.latestFailedJob.jobType)} - {valueOrDash(data.metrics.latestFailedJob.lastError)}
              </li>
            )}
          </ul>
        </div>
      )}
    </section>
  )
}
