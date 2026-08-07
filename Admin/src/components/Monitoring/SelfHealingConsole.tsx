import { useState } from 'react'
import {
  Activity,
  Heart,
  RefreshCw,
  Zap,
  Server,
  ShieldCheck,
  AlertTriangle,
  Play,
  Settings,
  Terminal,
} from 'lucide-react'
import { InputText } from 'primereact/inputtext'
import type { MonitoringStatus, RemediationJob } from '@/types/serverManagement'
import { classNames } from '@/utils/serverManagementFormat'

interface SelfHealingConsoleProps {
  status?: MonitoringStatus
  serverId: string
  onPlanRemediation: (payload: {
    serverId: string
    intent: string
    description: string
    approvalMode: 'auto'
  }) => { unwrap: () => Promise<any> }
  onExecuteRemediation: (jobId: string) => { unwrap: () => Promise<any> }
  onCollectSample?: () => void
  isCollecting?: boolean
  showToast: (msg: { severity: 'success' | 'error' | 'info' | 'warn'; summary: string; detail: string }) => void
}

export function SelfHealingConsole({
  status,
  serverId,
  onPlanRemediation,
  onExecuteRemediation,
  onCollectSample,
  isCollecting = false,
  showToast,
}: SelfHealingConsoleProps) {
  const [customService, setCustomService] = useState('')
  const [isExecutingAction, setIsExecutingAction] = useState<string | null>(null)

  const selfHealing = status?.selfHealing
  const latestJob = selfHealing?.recentRecoveryActions?.[0]
  const latestIssue = latestJob?.target ?? 'None detected'
  const latestReason =
    latestJob?.decisionTrace?.find((item) => item.startsWith('Root cause classification:'))?.replace('Root cause classification:', '').replace(/\.$/, '').trim() ||
    latestJob?.lastError ||
    'No active issue'

  const handleManualRestoration = async (intent: string, desc: string, actionId: string) => {
    if (!serverId) return
    setIsExecutingAction(actionId)
    try {
      showToast({
        severity: 'info',
        summary: 'Initiating recovery action',
        detail: `Planning self-healing task: "${intent}"`,
      })
      const planned = await onPlanRemediation({
        serverId,
        intent,
        description: desc,
        approvalMode: 'auto',
      }).unwrap()
      await onExecuteRemediation(planned._id).unwrap()
      showToast({
        severity: 'success',
        summary: 'Recovery action completed',
        detail: `Self-healing command executed successfully.`,
      })
      if (onCollectSample) {
        onCollectSample()
      }
    } catch (err: any) {
      const detail = err?.data?.message || err?.message || 'Failed to complete recovery command.'
      showToast({
        severity: 'error',
        summary: 'Recovery execution failed',
        detail,
      })
    } finally {
      setIsExecutingAction(null)
    }
  }

  const handleCustomServiceRestart = () => {
    if (!customService.trim()) {
      showToast({
        severity: 'warn',
        summary: 'Input required',
        detail: 'Please enter a valid systemd or PM2 service name.',
      })
      return
    }
    const serviceName = customService.trim()
    void handleManualRestoration(
      `Restart systemd service ${serviceName}`,
      `Manual self-healing restart trigger for "${serviceName}" daemon.`,
      'custom-service'
    )
    setCustomService('')
  }

  // Skeletons / Empty State
  if (!serverId) {
    return (
      <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <p className="text-sm text-[var(--color-text-muted)] text-center">
          Select a server connection above to view the Self-Healing and Crash Recovery console.
        </p>
      </article>
    )
  }

  const recentRecoveryActions = selfHealing?.recentRecoveryActions ?? []

  return (
    <article className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 transition-all duration-300 hover:shadow-md space-y-6">
      
      {/* Console Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-[var(--color-border)] pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--color-primary)]/10 text-[var(--color-primary)]">
              <Zap className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-lg font-black text-[var(--color-text-strong)] tracking-tight">
                AI Self-Healing & Crash Recovery Console
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Automated daemon crash prevention, health check validation pipelines, and infinite retry loop guards.
              </p>
            </div>
          </div>
        </div>

        {/* Live Stability Gauge */}
        <div className="flex flex-wrap gap-2 items-center">
          <span
            className={classNames(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1',
              selfHealing?.stabilityIndicator === 'stable'
                ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
                : selfHealing?.stabilityIndicator === 'warning'
                ? 'bg-amber-500/10 text-amber-600 ring-amber-500/30 dark:text-amber-400'
                : 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400'
            )}
          >
            <Activity className="h-3.5 w-3.5" />
            Stability: {selfHealing?.stabilityIndicator?.toUpperCase() ?? 'STABLE'}
          </span>
          <span
            className={classNames(
              'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-black ring-1',
              selfHealing?.recoveryStatus === 'running'
                ? 'bg-blue-500/10 text-blue-600 ring-blue-500/30 animate-pulse dark:text-blue-400'
                : selfHealing?.recoveryStatus === 'completed'
                ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/30 dark:text-emerald-400'
                : selfHealing?.recoveryStatus === 'failed'
                ? 'bg-rose-500/10 text-rose-600 ring-rose-500/30 dark:text-rose-400'
                : 'bg-slate-500/10 text-slate-600 ring-slate-500/30 dark:text-slate-400'
            )}
          >
            <Heart className="h-3.5 w-3.5" />
            Status: {selfHealing?.recoveryStatus?.toUpperCase() ?? 'IDLE'}
          </span>
        </div>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Metric 1: System Uptime */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/40 p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Daemon Link
            </span>
            <p className="text-xl font-black text-[var(--color-text-strong)]">
              {selfHealing?.uptime || 'Online'}
            </p>
          </div>
          <div className="rounded-lg bg-emerald-500/10 p-2.5 text-emerald-500">
            <Server className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 2: Restarts Resolved */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/40 p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Auto Restarts
            </span>
            <p className="text-xl font-black text-[var(--color-text-strong)]">
              {selfHealing?.restartCount ?? 0} resolved
            </p>
          </div>
          <div className="rounded-lg bg-blue-500/10 p-2.5 text-blue-500">
            <RefreshCw className={classNames('h-5 w-5', isCollecting && 'animate-spin')} />
          </div>
        </div>

        {/* Metric 3: Active Alert incidents */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/40 p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Detected Issue
            </span>
            <p className="text-base font-black text-[var(--color-text-strong)] truncate max-w-[11rem]" title={latestIssue}>
              {latestIssue}
            </p>
          </div>
          <div className="rounded-lg bg-rose-500/10 p-2.5 text-rose-500">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Metric 4: Health Validation check */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/40 p-4 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
              Last Reason
            </span>
            <p className="text-base font-black text-[var(--color-text-strong)] mt-1 truncate max-w-[11rem]" title={latestReason}>
              {latestReason}
            </p>
          </div>
          <div className="rounded-lg bg-indigo-500/10 p-2.5 text-indigo-500">
            <ShieldCheck className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Main Column Split */}
      <div className="grid gap-6 lg:grid-cols-[1fr_1.25fr]">
        
        {/* Left Column: Action Console */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/20 p-5 space-y-5">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)]/60 pb-3">
            <Settings className="h-4 w-4 text-[var(--color-text-muted)]" />
            <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-strong)]">
              Manual Healing Controls & Cache Purges
            </h4>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            
            {/* Control 1: Drops cached caches */}
            <button
              type="button"
              className="flex flex-col items-start gap-1 p-3 text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)] transition-all group disabled:opacity-50"
              onClick={() =>
                handleManualRestoration(
                  'Clear system memory cache',
                  'Manual page cache system free command.',
                  'clear-cache'
                )
              }
              disabled={isExecutingAction !== null}
            >
              <span className="text-xs font-black text-[var(--color-text-strong)] group-hover:text-[var(--color-primary)] transition-colors">
                Drop RAM Page Caches
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Drops page cache buffer locks. Safe to trigger under RAM pressure.
              </span>
            </button>

            {/* Control 2: Storage cleanups */}
            <button
              type="button"
              className="flex flex-col items-start gap-1 p-3 text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-muted)] hover:border-[var(--color-primary)] transition-all group disabled:opacity-50"
              onClick={() =>
                handleManualRestoration(
                  'Start filesystem remediation scan',
                  'Trigger temporary logs and duplicate scanner files cleanup.',
                  'clear-disk'
                )
              }
              disabled={isExecutingAction !== null}
            >
              <span className="text-xs font-black text-[var(--color-text-strong)] group-hover:text-[var(--color-primary)] transition-colors">
                Purge Temporary storage
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)]">
                Safely scans and cleans old temporary and duplicate logs.
              </span>
            </button>
          </div>

          {/* Custom Daemon trigger */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--color-text-muted)]">
              Target Custom Daemon
            </label>
            <div className="flex gap-2">
              <span className="relative flex-1">
                <InputText
                  className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-xs focus:ring-1 focus:ring-[var(--color-primary)]"
                  placeholder="e.g. nginx, docker, postgresql"
                  value={customService}
                  onChange={(e) => setCustomService(e.target.value)}
                  disabled={isExecutingAction !== null}
                />
              </span>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-[var(--color-primary)] px-4 text-xs font-bold text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-60 transition-colors"
                onClick={handleCustomServiceRestart}
                disabled={isExecutingAction !== null}
              >
                {isExecutingAction === 'custom-service' ? 'Triggering...' : 'Restart Service'}
                <Play className="h-3 w-3" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Timelines & Auditing logs */}
        <div className="rounded-2xl border border-[var(--color-border)]/60 bg-[var(--color-surface-muted)]/20 p-5 space-y-4 flex flex-col max-h-[300px]">
          <div className="flex items-center gap-2 border-b border-[var(--color-border)]/60 pb-3 justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-[var(--color-text-muted)]" />
              <h4 className="text-xs font-black uppercase tracking-wider text-[var(--color-text-strong)]">
                AI Recovery Action Log & Timeline
              </h4>
            </div>
            <span className="text-[10px] font-bold text-[var(--color-text-muted)]">
              {recentRecoveryActions.length} entries
            </span>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
            {recentRecoveryActions.length > 0 ? (
              recentRecoveryActions.map((job: RemediationJob) => (
                <div
                  key={job._id}
                  className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3 space-y-2 hover:border-[var(--color-primary)]/40 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <span className="font-bold text-[var(--color-text-strong)]">
                      {job.type.replace(/_/g, ' ').toUpperCase()}: {job.target}
                    </span>
                    <span
                      className={classNames(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ring-1',
                        job.status === 'completed'
                          ? 'bg-emerald-500/10 text-emerald-600 ring-emerald-500/20'
                          : job.status === 'failed'
                          ? 'bg-rose-500/10 text-rose-600 ring-rose-500/20'
                          : 'bg-blue-500/10 text-blue-600 ring-blue-500/20 animate-pulse'
                      )}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--color-text-muted)] leading-relaxed">
                    {job.description}
                  </p>
                  <div className="grid gap-1 text-[10px] text-[var(--color-text-muted)] sm:grid-cols-2">
                    <span>Reason: {job.decisionTrace?.find((item) => item.startsWith('Root cause classification:'))?.replace('Root cause classification:', '').replace(/\.$/, '').trim() || job.lastError || 'unknown reason'}</span>
                    <span>Server: {selfHealing?.serverName || selfHealing?.serverHost || 'current server'}</span>
                    <span>Attempts: {(job.retryCount ?? 0) + 1}/{job.maxRetries ?? 3}</span>
                    <span>Result: {job.status === 'completed' ? 'success' : job.status}</span>
                    <span>{new Date(job.created).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] border-t border-[var(--color-border)]/40 pt-1.5 mt-1.5">
                    <span>
                      Trigger: {job.plannedBy === 'system_self_healing' ? 'AI Daemon Auto-Healing' : 'Manual operator'}
                    </span>
                    <span>{new Date(job.created).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-2 text-[var(--color-text-muted)] p-5">
                <ShieldCheck className="h-8 w-8 text-emerald-500/60" />
                <p className="text-xs">
                  No automated self-healing recoveries triggered yet. Daemon links are stable.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
