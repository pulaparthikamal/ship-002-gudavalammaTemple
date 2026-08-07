import { useState, useMemo } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  History,
  Shield,
  StopCircle,
  Terminal,
  User,
  Zap,
} from 'lucide-react'
import { Dropdown } from 'primereact/dropdown'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useServerManagementSocket } from '@/hooks/useServerManagementSocket'
import {
  useGetServersQuery,
  useGetRemediationJobsQuery,
  useGetDiskCleanupJobsQuery,
} from '@/services/api/endpoints/serverManagementApi'
import { classNames, formatBytes, formatDate } from '@/utils/serverManagementFormat'
import type { RemediationJob } from '@/types/serverManagement'

export function RemediationPage() {
  const [selectedServerId, setSelectedServerId] = useState<string>()
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  const { data: servers = [], isLoading: isServersLoading } = useGetServersQuery()
  const { data: jobs = [] as RemediationJob[], refetch: refetchJobs, isFetching: isJobsFetching } = useGetRemediationJobsQuery(
    { serverId: selectedServerId, limit: 50 },
    { skip: !selectedServerId }
  )
  const { data: cleanupJobs = [] } = useGetDiskCleanupJobsQuery(
    { serverId: selectedServerId ?? '', limit: 10 },
    { skip: !selectedServerId },
  )
  useServerManagementSocket(selectedServerId, refetchJobs, { debounceMs: 15_000 })

  const isLoading = isServersLoading || (isJobsFetching && !jobs.length)

  const selectedJob = useMemo<RemediationJob | undefined>(() => jobs.find((j) => j._id === selectedJobId), [jobs, selectedJobId])
  const activeStatuses = ['planned', 'pending_approval', 'queued', 'running'] as const
  const getProgressPercent = (job: RemediationJob) => {
    if (job.status === 'completed' || job.status === 'partially_completed' || job.status === 'failed') {
      return 100
    }

    return Math.max(0, Math.min(Math.round(job.progressPercent ?? 0), 100))
  }
  const getEstimatedCompletion = (job: RemediationJob) => {
    const progress = getProgressPercent(job)
    if (!job.startedAt || progress <= 0 || progress >= 100 || job.status !== 'running') {
      return undefined
    }

    const elapsedMs = Date.now() - new Date(job.startedAt).getTime()
    const remainingMs = (elapsedMs / progress) * (100 - progress)
    if (!Number.isFinite(remainingMs) || remainingMs <= 0) {
      return undefined
    }

    const minutes = Math.max(1, Math.round(remainingMs / 60000))
    return minutes > 60 ? `${Math.round(minutes / 60)}h remaining` : `${minutes}m remaining`
  }

  const statusColors = {
    planned: 'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
    pending_approval: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    queued: 'bg-indigo-100 text-indigo-800 ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/30',
    running: 'bg-purple-100 text-purple-800 ring-purple-300 animate-pulse dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30',
    completed: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
    partially_completed: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
    failed: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
    skipped: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/20',
    rolled_back: 'bg-slate-200 text-slate-800 ring-slate-300 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/30',
    cancelled: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20',
  }

  return (
    <>
      {isLoading && (
        <div className="fixed inset-0 z-[100] overflow-hidden">
          <LoadingScreen className="bg-[var(--color-page)]/60 backdrop-blur-sm" message="Loading remediation data..." />
        </div>
      )}
      <div className="mx-auto max-w-full space-y-6">
        <PageHeader
        eyebrow="Infrastructure Automation"
        title="Automated Remediation"
        description="Manage and monitor automated fixes, service restarts, and process resolutions."
      />

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 items-center gap-4">
          <label className="flex flex-col space-y-1.5 min-w-[300px]">
            <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">Server</span>
            <Dropdown
              className="h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm flex items-center"
              value={selectedServerId ?? ''}
              onChange={(e) => setSelectedServerId(e.value || undefined)}
              options={servers.map((server) => ({ label: `${server.name} (${server.host})`, value: server._id }))}
              optionLabel="label"
              optionValue="value"
              placeholder="Select a Server"
            />
          </label>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => refetchJobs()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)]"
          >
            <Clock className="h-4 w-4" /> Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_500px] min-h-[600px]">
        {cleanupJobs.some((job) => job.triggerType === 'STORAGE_SPIKE') ? (
          <section className="lg:col-span-2 overflow-hidden rounded-2xl border border-orange-200 bg-[var(--color-surface)] shadow-sm dark:border-orange-500/35">
            {cleanupJobs.filter((job) => job.triggerType === 'STORAGE_SPIKE').slice(0, 1).map((job) => (
              <div key={job.jobId} className="border-l-4 border-orange-500 p-4">
                <div className="mb-4 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:ring-orange-500/30">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-black text-[var(--color-text-strong)]">Storage spike cleanup</p>
                    <p className="text-xs font-medium text-[var(--color-text-muted)]">Automatic disk cleanup was triggered by high storage usage.</p>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-5">
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">Detected</p>
                    <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">{formatDate(job.cleanupStartedAt || job.createdAt || '')}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">Cleanup action</p>
                    <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">{job.status.replace('_', ' ')}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">Reduced</p>
                    <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">{formatBytes(job.storageReducedBytes)}</p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--color-text-muted)]">
                      {job.filesDeleted} deleted, {job.filesSkipped} skipped
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">Before</p>
                    <p className="mt-1 text-sm font-bold text-[var(--color-text-strong)]">{job.diskUsagePercentBefore}%</p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    <p className="text-[10px] font-black uppercase tracking-wide text-[var(--color-text-muted)]">After</p>
                    <p className={classNames(
                      'mt-1 text-sm font-bold',
                      job.diskUsagePercentAfter < 85 ? 'text-emerald-700 dark:text-emerald-300' : 'text-rose-700 dark:text-rose-300',
                    )}>
                      {job.diskUsagePercentAfter}% {job.diskUsagePercentAfter < 85 ? 'resolved' : 'still critical'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </section>
        ) : null}
        <section
          className={classNames(
            'rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden flex flex-col',
            jobs.length ? 'h-[600px]' : 'h-[180px]'
          )}
        >
          <div className="border-b border-[var(--color-border)] p-4 bg-[var(--color-surface-muted)] flex items-center justify-between">
            <h3 className="text-sm font-bold text-[var(--color-text-strong)] flex items-center gap-2">
              <History className="h-4 w-4 text-[var(--color-primary)]" /> Remediation History
            </h3>
          </div>
          <div
            className={classNames(
              'overflow-auto',
              jobs.length ? 'flex-1' : ''
            )}
          >
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-surface-muted)]/50 text-left text-xs uppercase text-[var(--color-text-muted)]">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                  {/* <th className="px-4 py-3 text-right">Actions</th> */}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {jobs.map((job) => (
                  <tr
                    key={job._id}
                    onClick={() => setSelectedJobId(job._id)}
                    className={classNames(
                      'cursor-pointer transition-colors hover:bg-[var(--color-hover)]',
                      selectedJobId === job._id ? 'bg-[var(--color-primary)]/5' : ''
                    )}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-lg bg-slate-100 flex items-center justify-center dark:bg-slate-800">
                          {job.type === 'restart_service' ? <Zap className="h-4 w-4 text-amber-500" /> :
                            job.type === 'kill_process' ? <StopCircle className="h-4 w-4 text-rose-500" /> :
                              <Terminal className="h-4 w-4 text-blue-500" />}
                        </div>
                        <span className="font-bold text-[var(--color-text-strong)]">{job.type.replace('_', ' ')}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono text-xs">{job.target}</td>
                    <td className="px-4 py-4">
                      <span className={classNames('rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ring-1', statusColors[job.status])}>
                        {job.status.replace('_', ' ')}
                      </span>
                      {activeStatuses.includes(job.status as typeof activeStatuses[number]) ? (
                        <div className="mt-2 w-28">
                          <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-border)]">
                            <div
                              className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                              style={{ width: `${getProgressPercent(job)}%` }}
                            />
                          </div>
                          <p className="mt-1 text-[10px] font-semibold text-[var(--color-text-muted)]">
                            {getProgressPercent(job)}%
                          </p>
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-[var(--color-text-muted)]">{formatDate(job.created)}</td>
                    {/* <td className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        {job.status === 'planned' && (
                          <button
                            onClick={() => handleExecute(job._id)}
                            disabled={isExecuting}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            title="Execute"
                          >
                            {isExecuting ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <Play className="h-4 w-4" />}
                          </button>
                        )}
                        {(job.status === 'completed' || job.status === 'failed') && job.rollbackSteps.length > 0 && (
                          <button
                            onClick={() => handleRollback(job._id)}
                            disabled={isRollingBack}
                            className="h-8 w-8 flex items-center justify-center rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
                            title="Rollback"
                          >
                            {isRollingBack ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> : <RotateCcw className="h-4 w-4" />}
                          </button>
                        )}
                        {['planned', 'pending_approval', 'queued'].includes(job.status) && (
                          <button
                            onClick={() => handleCancel(job._id)}
                            disabled={isCancelling}
                            className="h-8 w-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                            title="Cancel"
                          >
                            {isCancelling ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-border)] border-t-[var(--color-primary)]" /> : <StopCircle className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </td> */}
                  </tr>
                ))}
                {!jobs.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-[var(--color-text-muted)]">
                      {selectedServerId ? 'No remediation jobs found.' : 'Select a server to view remediation history.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <aside className="space-y-6">
          {selectedJob ? (
            <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm h-[600px] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-[var(--color-text-strong)]">Job Details</h4>
                <button onClick={() => setSelectedJobId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]">
                  <ArrowLeft className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4 ring-1 ring-[var(--color-border)]">
                  <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-2">Description</p>
                  <p className="text-sm font-medium text-[var(--color-text-strong)] leading-relaxed">{selectedJob.description}</p>
                  {selectedJob.reasoningSummary ? (
                    <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
                      {selectedJob.reasoningSummary}
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-[var(--color-border)] p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <p className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Progress</p>
                    <span className="text-xs font-black text-[var(--color-text-strong)]">{getProgressPercent(selectedJob)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-border)]">
                    <div
                      className="h-full rounded-full bg-[var(--color-primary)] transition-all"
                      style={{ width: `${getProgressPercent(selectedJob)}%` }}
                    />
                  </div>
                  <p className="mt-2 truncate text-xs font-semibold text-[var(--color-text-muted)]" title={selectedJob.currentStep}>
                    {selectedJob.currentStep || selectedJob.status.replace('_', ' ')}
                  </p>
                  {getEstimatedCompletion(selectedJob) ? (
                    <p className="mt-1 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                      ETA: {getEstimatedCompletion(selectedJob)}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-2xl border border-[var(--color-border)]">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Priority</p>
                    <p className="text-sm font-black text-[var(--color-text-strong)] uppercase">{selectedJob.priority}</p>
                  </div>
                  <div className="p-3 rounded-2xl border border-[var(--color-border)]">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Planned By</p>
                    <div className="flex items-center gap-2 mt-1">
                      <User className="h-3 w-3 text-[var(--color-primary)]" />
                      <span className="max-w-[140px] truncate text-sm font-bold text-[var(--color-text-strong)]" title={selectedJob.plannedBy}>{selectedJob.plannedBy}</span>
                    </div>
                  </div>
                  <div className="p-3 rounded-2xl border border-[var(--color-border)]">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Planning Mode</p>
                    <p className="text-sm font-black text-[var(--color-text-strong)] uppercase">{selectedJob.planningMode || 'static'}</p>
                  </div>
                  <div className="p-3 rounded-2xl border border-[var(--color-border)]">
                    <p className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase">Risk</p>
                    <p className="text-sm font-black text-[var(--color-text-strong)] uppercase">{selectedJob.riskLevel || selectedJob.priority}</p>
                  </div>
                </div>

                {selectedJob.executionSummary ? (
                  <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                    <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase mb-3">Cleanup Summary</p>
                    {selectedJob.executionSummary.noSafeFixApplied ? (
                      <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                        No safe fix applied: {selectedJob.executionSummary.noSafeFixReason || 'No safe automated action matched this issue.'}
                      </div>
                    ) : null}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Deleted</p>
                        <p className="font-black text-[var(--color-text-strong)]">{selectedJob.executionSummary.filesDeleted ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Archived</p>
                        <p className="font-black text-[var(--color-text-strong)]">{selectedJob.executionSummary.filesArchived ?? 0}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Recovered</p>
                        <p className="font-black text-[var(--color-text-strong)]">{selectedJob.executionSummary.spaceReclaimedMb ?? 0} MB</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Failed</p>
                        <p className="font-black text-[var(--color-text-strong)]">{selectedJob.executionSummary.failedActions ?? 0}</p>
                      </div>
                    </div>
                    {selectedJob.executionSummary.remainingIssues !== undefined ? (
                      <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
                        Remaining cleanup findings: {selectedJob.executionSummary.remainingIssues}
                      </p>
                    ) : null}
                    {selectedJob.executionSummary.optimizationActions ? (
                      <p className="mt-1 text-xs font-medium text-[var(--color-text-muted)]">
                        Safe optimization actions: {selectedJob.executionSummary.optimizationActions}
                        {selectedJob.executionSummary.optimizationRecoveredMb !== undefined
                          ? ` (${selectedJob.executionSummary.optimizationRecoveredMb} MB recovered)`
                          : ''}
                      </p>
                    ) : null}
                    {selectedJob.executionSummary.verification ? (
                      <div className="mt-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                        <p className="text-[10px] font-bold uppercase text-[var(--color-text-muted)]">Verification</p>
                        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                          <span className="text-[var(--color-text-muted)]">Disk delta</span>
                          <span className="font-bold text-[var(--color-text-strong)]">
                            {selectedJob.executionSummary.verification.diskUsageDeltaPercent ?? 0}%
                          </span>
                          <span className="text-[var(--color-text-muted)]">Prediction delta</span>
                          <span className="font-bold text-[var(--color-text-strong)]">
                            {selectedJob.executionSummary.verification.predictionConfidenceDelta ?? 0}
                          </span>
                          <span className="text-[var(--color-text-muted)]">Issue still present</span>
                          <span className="font-bold text-[var(--color-text-strong)]">
                            {selectedJob.executionSummary.verification.issueStillPresent ? 'Yes' : 'No'}
                          </span>
                        </div>
                        {selectedJob.executionSummary.verification.issueStillPresent ? (
                          <p className="mt-2 text-xs font-medium text-[var(--color-text-muted)]">
                            The latest prediction still reports risk. Review skipped actions and remaining findings before trying a stronger manual fix.
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="space-y-2">
                  <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Execution Steps</p>
                  <div className="space-y-3">
                    {selectedJob.steps.map((step, idx) => (
                      <div key={idx} className="relative pl-6 pb-2 border-l border-[var(--color-border)] last:pb-0">
                        <div className={classNames(
                          "absolute -left-1.5 top-1 h-3 w-3 rounded-full ring-2 ring-white",
                          step.status === 'completed' ? 'bg-emerald-500' :
                            step.status === 'failed' ? 'bg-rose-500' :
                              step.status === 'running' ? 'bg-blue-500 animate-pulse' : 'bg-slate-300'
                        )} />
                        <p className="text-sm font-bold text-[var(--color-text-strong)]">{step.name}</p>
                        {step.toolName ? (
                          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-primary)]">
                            Tool: {step.toolName}
                          </p>
                        ) : null}
                        {step.command && <p className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1 truncate">{step.command}</p>}
                        {step.output ? (
                          <details className="mt-2 rounded-lg bg-[var(--color-surface-muted)] p-2 ring-1 ring-[var(--color-border)]">
                            <summary className="cursor-pointer text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
                              Step Output
                            </summary>
                            <pre className="mt-2 whitespace-pre-wrap break-words text-[10px] text-[var(--color-text-muted)]">
                              {step.output}
                            </pre>
                          </details>
                        ) : null}
                        {step.error && <p className="mt-2 text-xs text-rose-600 bg-rose-50 p-2 rounded-lg">{step.error}</p>}
                      </div>
                    ))}
                  </div>
                </div>

                {selectedJob.preFlightCheck && (
                  <div className="p-4 rounded-2xl border border-[var(--color-border)] bg-slate-50 dark:bg-slate-900/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Pre-flight Health</p>
                      <span className={classNames(
                        "text-[10px] font-black uppercase px-2 py-0.5 rounded-full",
                        selectedJob.preFlightCheck.status === 'passed' ? 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]' : 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
                      )}>
                        {selectedJob.preFlightCheck.status}
                      </span>
                    </div>
                    <p className="text-[10px] font-mono text-[var(--color-text-muted)]">{selectedJob.preFlightCheck.results?.uptime}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] p-12 text-center h-[180px] flex flex-col items-center justify-center">
              <Shield className="h-12 w-12 text-[var(--color-primary)] mx-auto mb-4" />
              <p className="text-sm font-medium text-[var(--color-text-muted)]">Select a remediation job to view details and logs.</p>
            </div>
          )}

          {/* <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-lg">
            <h4 className="text-lg font-black flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Safety First
            </h4>
            <p className="mt-2 text-sm font-medium opacity-90 leading-relaxed">
              All remediation actions are executed via secure SSH with audited commands. Rolling back is possible for most service-level operations.
            </p>
          </div> */}
        </aside>
      </div>
    </div>
    </>
  )
}
