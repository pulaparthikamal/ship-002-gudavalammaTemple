import { useState } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  CircleMinus,
  Search,
  RefreshCw,
  Play,
} from 'lucide-react'
import type { MonitoringMetricHistory, MonitoringStatus } from '@/types/serverManagement'
import { classNames } from '@/utils/serverManagementFormat'

interface ServiceStatusMatrixProps {
  metric?: MonitoringMetricHistory
  status?: MonitoringStatus
  isRestartingService?: string | null
  onRestartService?: (serviceName: string) => void
}

export function ServiceStatusMatrix({
  metric,
  status,
  isRestartingService = null,
  onRestartService,
}: ServiceStatusMatrixProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // 1. Gather all unique services from the metrics and recent jobs
  const runningServices = metric?.serviceSummary?.runningServices || []
  const failedServices = metric?.serviceSummary?.failedServices || []
  const inactiveServices = metric?.serviceSummary?.inactiveServices || []
  const recentJobs = status?.selfHealing?.recentRecoveryActions || []

  const allServiceNames = Array.from(
    new Set([
      ...runningServices,
      ...failedServices,
      ...inactiveServices,
      ...recentJobs.map((job) => job.target),
    ])
  ).filter(Boolean)

  // 2. Map status for each service
  const servicesData = allServiceNames.map((name) => {
    const isRunning = runningServices.includes(name)
    const isFailed = failedServices.includes(name)
    const isInactive = inactiveServices.includes(name)

    // Check if there is an active/running recovery job for this service
    const activeJob = recentJobs.find(
      (job) => job.target === name && (job.status === 'running' || job.status === 'queued')
    )

    let currentStatus: 'Running' | 'Stopped' | 'Failed' | 'Restarting' | 'Recovering' = 'Stopped'
    if (activeJob) {
      currentStatus = activeJob.type === 'restart_service' ? 'Restarting' : 'Recovering'
    } else if (isFailed) {
      currentStatus = 'Failed'
    } else if (isRunning) {
      currentStatus = 'Running'
    } else if (isInactive) {
      currentStatus = 'Stopped'
    }

    const manager = name.startsWith('docker:')
      ? 'Docker'
      : name.startsWith('pm2:')
        ? 'PM2'
        : 'Systemd'

    return {
      name,
      status: currentStatus,
      manager,
      lastAction: recentJobs.find((job) => job.target === name),
    }
  })

  // 3. Filter based on query
  const filteredServices = servicesData.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats Counters
  const runningCount = servicesData.filter((s) => s.status === 'Running').length
  const failedCount = servicesData.filter((s) => s.status === 'Failed').length
  const stoppedCount = servicesData.filter((s) => s.status === 'Stopped').length
  const recoveringCount = servicesData.filter(
    (s) => s.status === 'Restarting' || s.status === 'Recovering'
  ).length

  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all duration-300 hover:shadow-md space-y-6">

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-[var(--color-border)] pb-5">
        <div>
          <h3 className="text-lg font-black text-[var(--color-text-strong)] tracking-tight">
            Active Daemon & Service Matrix
          </h3>
          <p className="text-xs text-[var(--color-text-muted)]">
            Real-time status check for Systemd daemons, Docker containers, and PM2 processes.
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-text-muted)]" />
          <input
            type="text"
            className="h-9 w-full sm:w-60 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-9 pr-3 text-xs focus:ring-1 focus:ring-[var(--color-primary)] outline-none"
            placeholder="Search active services..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-border)]/50 bg-emerald-50/10 p-3 text-emerald-600 dark:text-emerald-400">
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-70">Running</div>
            <div className="text-lg font-black">{runningCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-border)]/50 bg-rose-50/10 p-3 text-rose-600 dark:text-rose-400">
          <CircleAlert className="h-4.5 w-4.5 shrink-0" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-70">Failed</div>
            <div className="text-lg font-black">{failedCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-border)]/50 bg-slate-50/10 p-3 text-slate-600 dark:text-slate-400">
          <CircleMinus className="h-4.5 w-4.5 shrink-0 animate-pulse" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-70">Stopped</div>
            <div className="text-lg font-black">{stoppedCount}</div>
          </div>
        </div>

        <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--color-border)]/50 bg-blue-50/10 p-3 text-blue-600 dark:text-blue-400">
          <RefreshCw className="h-4.5 w-4.5 shrink-0 animate-spin" />
          <div>
            <div className="text-xs font-bold uppercase tracking-wider opacity-70">Recovering</div>
            <div className="text-lg font-black">{recoveringCount}</div>
          </div>
        </div>
      </div>

      {/* Services List Table */}
      <div className="border border-[var(--color-border)]/60 rounded-2xl overflow-hidden">
        <div className="max-h-[40vh] sm:max-h-[50vh] lg:max-h-[55vh] overflow-auto rounded-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--color-surface)] text-[var(--color-text-muted)] border-b border-[var(--color-border)]/60">
              <tr className="bg-[var(--color-surface-muted)]/50 border-b border-[var(--color-border)]/60 text-[var(--color-text-muted)] font-black uppercase">
                <th className="p-3">Service name</th>
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Last action</th>
                <th className="p-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.length > 0 ? (
                filteredServices.map((service) => (
                  <tr
                    key={service.name}
                    className="border-b border-[var(--color-border)]/40 hover:bg-[var(--color-surface-muted)]/20 transition-colors"
                  >
                    <td className="p-3 font-bold text-[var(--color-text-strong)] truncate max-w-[12rem]" title={service.name}>
                      {service.name.replace(/^(systemd|docker|pm2):/, '')}
                    </td>
                    <td className="p-3">
                      <span className="rounded bg-[var(--color-border)]/50 px-2 py-0.5 font-bold uppercase tracking-wider opacity-80 text-[10px]">
                        {service.manager}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={classNames(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold text-[10px] uppercase ring-1',
                          service.status === 'Running'
                            ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
                            : service.status === 'Failed'
                              ? 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
                              : service.status === 'Stopped'
                                ? 'bg-slate-500/10 text-slate-600 ring-slate-200'
                                : 'bg-blue-500/10 text-blue-600 ring-blue-500/20 animate-pulse'
                        )}
                      >
                        {service.status}
                      </span>
                    </td>
                    <td className="p-3 text-[var(--color-text-muted)]">
                      {service.lastAction ? (
                        <span className="truncate max-w-[8rem]" title={`${service.lastAction.status} on ${new Date(service.lastAction.created).toLocaleTimeString()}`}>
                          {service.lastAction.status.toUpperCase()} ({new Date(service.lastAction.created).toLocaleTimeString()})
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="p-3 text-right">
                      {onRestartService && (
                        <button
                          type="button"
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-lg bg-[var(--color-primary)] px-2.5 font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 transition-colors"
                          onClick={() => onRestartService(service.name)}
                          disabled={isRestartingService !== null}
                        >
                          <Play className="h-2.5 w-2.5" />
                          Restart
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-[var(--color-text-muted)]">
                    No matching daemons found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </article>
  )
}
