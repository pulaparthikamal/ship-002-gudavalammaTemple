import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Brain,
  CheckCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  GitBranch,
  GitCommit,
  History,
  Play,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  StopCircle,
  Terminal,
  Webhook,
  XCircle,
  Zap,
} from 'lucide-react'
import { Dropdown } from 'primereact/dropdown'
import { Paginator } from 'primereact/paginator'
import { Dialog } from 'primereact/dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useToast } from '@/hooks/useToast'
import {
  useGetApplicationsQuery,
  useGetDeploymentByIdQuery,
  useGetDeploymentLogsQuery,
  useGetDeploymentsQuery,
  useGetDeploymentTargetsQuery,
  useTriggerDeploymentMutation,
  useCancelDeploymentMutation,
  useGetDeploymentVersionsQuery,
  useGetDeploymentRollbackHistoryQuery,
  usePredictDeploymentMutation,
  useGetDeploymentPredictionQuery,
} from '@/services/api/endpoints/deploymentAgentApi'
import { classNames, formatDate } from '@/utils/serverManagementFormat'
import { IntelligencePanel, UnavailablePanel } from './IntelligencePanel'
import type {
  Deployment,
  DeploymentAppRef,
  DeploymentPrediction,
  DeploymentStatus,
  DeploymentTargetRef,
  DeploymentTrigger,
  IDeploymentStepResult,
  IVersionRecord,
  IRollbackRecord,
  StepStatus,
} from '@/types/deploymentAgent'

// ─── Helpers ────────────────────────────────────────────────────────────────

function refName(ref: string | { _id: string; name: string }, fallback: string): string {
  return typeof ref === 'object' && ref !== null ? (ref as { name: string }).name : fallback
}

function formatDuration(ms?: number) {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

// ─── Status styles ───────────────────────────────────────────────────────────

const DEPLOYMENT_STATUS_STYLES: Record<DeploymentStatus, string> = {
  pending: 'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  running: 'bg-purple-100 text-purple-800 ring-purple-300 animate-pulse dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30',
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  failed: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  rolling_back: 'bg-amber-100 text-amber-800 ring-amber-300 animate-pulse dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  rolled_back: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/20',
  cancelled: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20',
}

const STEP_STATUS_STYLES: Record<StepStatus, string> = {
  pending: 'text-[var(--color-text-muted)]',
  running: 'text-purple-600 dark:text-purple-400',
  success: 'text-emerald-600 dark:text-emerald-400',
  skipped: 'text-[var(--color-text-muted)]',
  failed: 'text-rose-600 dark:text-rose-400',
}

const STEP_NAME_DISPLAY_MAP: Record<string, string> = {
  'acquire-lock': 'Acquiring Lock',
  'connect': 'Connecting to Server',
  'detect-environment': 'Detecting Environment',
  'verify-env': 'Validating Credentials',
  'ensure-git': 'Checking Git',
  'ensure-node': 'Validating Node Version',
  'ensure-pm2': 'Checking PM2',
  'prepare-directories': 'Preparing Directories',
  'fetch-source': 'Uploading Application',
  'inject-env': 'Extracting Files',
  'install-dependencies': 'Installing Dependencies',
  'build': 'Building Application',
  'activate-release': 'Activating Release',
  'start-process': 'Starting Application',
  'configure-proxy': 'Configuring Proxy',
  'persist-pm2': 'Persisting PM2',
  'health-check': 'Running Health Check',
  'finalize': 'Deployment Successful',
}

const RISK_STYLES: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
  high: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
}

// ─── Small components ────────────────────────────────────────────────────────

function TriggerBadge({ trigger }: { trigger?: DeploymentTrigger }) {
  if (!trigger || trigger === 'manual') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-text-muted)]">
        <Play size={9} />manual
      </span>
    )
  }
  if (trigger === 'webhook') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
        <Webhook size={9} />webhook
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
      <RotateCcw size={9} />rollback
    </span>
  )
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'success': return <CheckCircle size={14} className="text-emerald-500" />
    case 'failed': return <XCircle size={14} className="text-rose-500" />
    case 'running': return <Activity size={14} className="animate-pulse text-purple-500" />
    case 'skipped': return <ChevronRight size={14} className="text-[var(--color-text-muted)]" />
    default: return <Clock size={14} className="text-[var(--color-text-muted)]" />
  }
}

function StepResultRow({ step }: { step: IDeploymentStepResult }) {
  const [open, setOpen] = useState(false)
  const displayName = step.stepName === 'finalize' && step.status === 'failed'
    ? 'Deployment Failed'
    : (STEP_NAME_DISPLAY_MAP[step.stepName] ?? step.stepName.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => step.error && setOpen((o) => !o)}
        className={classNames(
          'flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm',
          step.error ? 'cursor-pointer hover:bg-[var(--color-surface-muted)]' : 'cursor-default',
        )}
      >
        <StepIcon status={step.status} />
        <span className={classNames('flex-1 font-sans font-medium', STEP_STATUS_STYLES[step.status])}>
          {displayName}
        </span>
        <span className="text-[11px] text-[var(--color-text-muted)]">{formatDuration(step.durationMs)}</span>
        {step.error && (open ? <ChevronDown size={14} className="text-[var(--color-text-muted)]" /> : <ChevronRight size={14} className="text-[var(--color-text-muted)]" />)}
      </button>
      {open && step.error && (
        <div className="bg-rose-50 px-4 py-2 dark:bg-rose-500/10">
          <p className="font-mono text-xs text-rose-700 dark:text-rose-300">{step.error}</p>
        </div>
      )}
    </div>
  )
}

function CommitCard({ deployment }: { deployment: Deployment }) {
  const { commit } = deployment
  if (!commit?.sha) return null
  return (
    <div className="flex flex-wrap items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3">
      <GitCommit size={15} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
      <div className="min-w-0 flex-1 space-y-0.5">
        {commit.message && <p className="text-sm font-medium text-[var(--color-text-strong)] line-clamp-2">{commit.message}</p>}
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
          <span className="font-mono">{commit.sha.slice(0, 8)}</span>
          {commit.author && <span>by {commit.author}</span>}
          {commit.ref && <span className="inline-flex items-center gap-1"><GitBranch size={10} />{commit.ref.replace('refs/heads/', '')}</span>}
        </div>
      </div>
    </div>
  )
}

// ─── Version History section ──────────────────────────────────────────────────

function VersionHistorySection({ deploymentId }: { deploymentId: string }) {
  const { data: versions = [], isLoading } = useGetDeploymentVersionsQuery(deploymentId)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <GitCommit size={14} className="text-[var(--color-text-muted)]" />
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">Version History</p>
      </div>
      {isLoading && (
        <div className="flex justify-center py-6">
          <RefreshCw size={16} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      )}
      {!isLoading && !versions.length && (
        <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No version history recorded yet.</p>
      )}
      {!isLoading && versions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Version</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Commit</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Environment</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Date</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {versions.map((v: IVersionRecord, i: number) => (
                <tr key={i} className="hover:bg-[var(--color-surface-muted)]">
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-strong)]">{v.version.slice(0, 8)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{v.commitHash?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{v.environment ?? 'production'}</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDate(v.deploymentDate)}</td>
                  <td className="px-4 py-3">
                    <span className={classNames(
                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset',
                      DEPLOYMENT_STATUS_STYLES[v.status as DeploymentStatus] ?? 'bg-gray-100 text-gray-500 ring-gray-200',
                    )}>
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Rollback History section ─────────────────────────────────────────────────

function RollbackHistorySection({ deploymentId }: { deploymentId: string }) {
  const { data: records = [], isLoading } = useGetDeploymentRollbackHistoryQuery(deploymentId)

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] px-4 py-3">
        <History size={14} className="text-[var(--color-text-muted)]" />
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">Rollback History</p>
      </div>
      {isLoading && (
        <div className="flex justify-center py-6">
          <RefreshCw size={16} className="animate-spin text-[var(--color-text-muted)]" />
        </div>
      )}
      {!isLoading && !records.length && (
        <p className="py-6 text-center text-sm text-[var(--color-text-muted)]">No rollbacks recorded for this deployment.</p>
      )}
      {!isLoading && records.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Date</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Source</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Target</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Risk</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Status</th>
                <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {records.map((r: IRollbackRecord, i: number) => (
                <tr key={i} className="hover:bg-[var(--color-surface-muted)]">
                  <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">{formatDate(r.startedAt)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{r.sourceVersion?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">{r.targetVersion?.slice(0, 8) ?? '—'}</td>
                  <td className="px-4 py-3">
                    {r.riskLevel && (
                      <span className={classNames('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset', RISK_STYLES[r.riskLevel] ?? RISK_STYLES.medium)}>
                        {r.riskLevel}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={classNames(
                      'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset',
                      r.status === 'success'
                        ? 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
                    )}>
                      {r.status}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-xs text-[var(--color-text-muted)]" title={r.recoveryResult}>
                    {r.recoveryResult ?? '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Deployment Intelligence section (associated prediction) ─────────────────

function DeploymentPredictionSection({ deploymentId }: { deploymentId: string }) {
  const { data: prediction, isLoading } = useGetDeploymentPredictionQuery(deploymentId)
  const [expanded, setExpanded] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
        <RefreshCw size={14} className="animate-spin text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Loading deployment intelligence…</p>
      </div>
    )
  }
  if (!prediction) return null

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left hover:bg-[var(--color-surface-muted)]"
        aria-expanded={expanded}
      >
        <Brain size={15} className="text-[var(--color-primary)]" />
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">Deployment Intelligence</p>
        {prediction.predictionUnavailable || prediction.source === 'unavailable' ? (
          <span className="ml-1 hidden items-center gap-1.5 sm:flex">
            <AlertTriangle size={12} className="text-amber-500" />
            <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400">Prediction Unavailable</span>
          </span>
        ) : prediction.noChangesDetected || prediction.source === 'no_changes' ? (
          <span className="ml-1 hidden items-center gap-1.5 sm:flex">
            <CheckCircle2 size={12} className="text-sky-500" />
            <span className="text-[11px] font-medium text-sky-600 dark:text-sky-400">No Changes Detected</span>
          </span>
        ) : (
          <span className="ml-1 hidden items-center gap-3 text-[11px] font-medium sm:flex">
            <span className={classNames(prediction.riskScore >= 70 ? 'text-rose-600' : prediction.riskScore >= 40 ? 'text-amber-600' : 'text-emerald-600')}>Risk {prediction.riskScore}%</span>
            <span className={classNames(prediction.failureProbability >= 70 ? 'text-rose-600' : prediction.failureProbability >= 40 ? 'text-amber-600' : 'text-emerald-600')}>Fail {prediction.failureProbability}%</span>
            <span className={classNames(prediction.confidenceScore >= 70 ? 'text-emerald-600' : prediction.confidenceScore >= 45 ? 'text-amber-600' : 'text-rose-600')}>Conf {prediction.confidenceScore}%</span>
          </span>
        )}
        <span className="flex-1" />
        {expanded ? <ChevronDown size={16} className="text-[var(--color-text-muted)]" /> : <ChevronRight size={16} className="text-[var(--color-text-muted)]" />}
      </button>

      {/* Traceability: clear mapping between the deployment and its prediction. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-text-muted)]">
        <span>Generated from prediction</span>
        <span className="font-mono text-[var(--color-text)]">{prediction._id}</span>
        <span>· {formatDate(prediction.created)}</span>
        <span>· {prediction.source === 'unavailable' ? 'Prediction unavailable' : prediction.source === 'no_changes' ? 'No changes' : 'LLM analysis'}</span>
      </div>

      {expanded && (
        <div className="border-t border-[var(--color-border)] p-4">
          <IntelligencePanel prediction={prediction} />
        </div>
      )}
    </div>
  )
}

// ─── Deployment Detail ────────────────────────────────────────────────────────

function DeploymentDetail({ deploymentId, onBack }: { deploymentId: string; onBack: () => void }) {
  const [showLogs, setShowLogs] = useState(false)
  const [cancelDeployment] = useCancelDeploymentMutation()
  const { showToast } = useToast()

  const { data: deployment, isLoading } = useGetDeploymentByIdQuery(deploymentId, { pollingInterval: 5000 })
  const { data: logs = [] } = useGetDeploymentLogsQuery(
    { id: deploymentId, query: { limit: 500 } },
    { skip: !showLogs },
  )
  const handleCancel = useCallback(async () => {
    try {
      await cancelDeployment(deploymentId).unwrap()
      showToast({ severity: 'success', summary: 'Deployment cancelled.' })
    } catch {
      showToast({ severity: 'error', summary: 'Failed to cancel deployment.' })
    }
  }, [cancelDeployment, deploymentId, showToast])

  if (isLoading) return <LoadingScreen />
  if (!deployment) return null

  const steps = deployment.steps ?? []
  const isActive = deployment.status === 'running' || deployment.status === 'pending'
  const appName = refName(deployment.applicationId as DeploymentAppRef, 'Unknown app')
  const targetHost = typeof deployment.targetId === 'object' && deployment.targetId !== null
    ? (deployment.targetId as DeploymentTargetRef).host
    : ''

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={16} />
        Back to deployments
      </button>

      {/* Header card */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Deployment</p>
          <p className="font-mono text-sm text-[var(--color-text-strong)]">{deployment._id}</p>
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{appName}{targetHost && ` → ${targetHost}`}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span>{formatDate(deployment.startedAt ?? deployment.created)}</span>
            {deployment.durationMs ? <span>— {formatDuration(deployment.durationMs)}</span> : null}
            <TriggerBadge trigger={deployment.trigger} />
            {deployment.rolledBack && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
                <RotateCcw size={9} />rolled back
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-3">
          <span className={classNames('inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset', DEPLOYMENT_STATUS_STYLES[deployment.status])}>
            {deployment.status.replace(/_/g, ' ')}
          </span>
          <div className="flex gap-2">
            {isActive && (
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
              >
                <StopCircle size={13} />Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {deployment.commit?.sha && <CommitCard deployment={deployment} />}

      {/* Associated prediction (Predict-Then-Deploy traceability) */}
      <DeploymentPredictionSection deploymentId={deploymentId} />

      {deployment.error && (
        <div className="flex gap-2 rounded-lg border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/20 dark:bg-rose-500/10">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-500" />
          <p className="text-sm text-rose-700 dark:text-rose-300">{deployment.error}</p>
        </div>
      )}

      {/* Pipeline steps */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Pipeline Steps</p>
        </div>
        <div>
          {steps.map((step) => <StepResultRow key={step.stepName} step={step} />)}
          {!steps.length && <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">Pipeline has not started.</p>}
        </div>
      </div>

      {/* Version History */}
      <VersionHistorySection deploymentId={deploymentId} />

      {/* Rollback History */}
      <RollbackHistorySection deploymentId={deploymentId} />

      {/* Logs */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Logs</p>
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
          >
            <Terminal size={13} />
            {showLogs ? 'Hide logs' : 'Show logs'}
          </button>
        </div>
        {showLogs && (
          <div className="max-h-96 overflow-y-auto bg-[var(--color-surface-muted)] p-4">
            {logs.length ? (
              <pre className="font-mono text-[11px] leading-relaxed text-[var(--color-text)]">
                {logs.map((log) => (
                  <div
                    key={log._id}
                    className={classNames('py-0.5', log.level === 'error' ? 'text-rose-500' : log.level === 'warn' ? 'text-amber-500' : '')}
                  >
                    <span className="text-[var(--color-text-muted)]">[{new Date(log.timestamp).toISOString().slice(11, 23)}]</span>
                    {' '}{log.stepName && <span className="text-[var(--color-primary)]">[{log.stepName}]</span>}
                    {' '}{log.message}
                  </div>
                ))}
              </pre>
            ) : (
              <p className="text-center text-sm text-[var(--color-text-muted)]">No logs available.</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Deployment row ───────────────────────────────────────────────────────────

function DeploymentRow({ deployment, onView }: { deployment: Deployment; onView: () => void }) {
  const appName = refName(deployment.applicationId as DeploymentAppRef, 'Unknown app')
  const targetName = refName(deployment.targetId as DeploymentTargetRef, 'Unknown target')
  const targetHost = typeof deployment.targetId === 'object' && deployment.targetId !== null
    ? ` (${(deployment.targetId as DeploymentTargetRef).host})`
    : ''
  const steps = deployment.steps ?? []
  const successCount = steps.filter((s) => s.status === 'success').length
  const rollbackCount = deployment.rollbackHistory?.length ?? 0

  return (
    <li>
      <button
        type="button"
        onClick={onView}
        className="flex w-full items-start gap-4 px-4 py-4 text-left hover:bg-[var(--color-surface-muted)]"
      >
        <div className="mt-0.5 shrink-0">
          {deployment.status === 'success' ? <CheckCircle size={18} className="text-emerald-500" />
            : deployment.status === 'failed' ? <XCircle size={18} className="text-rose-500" />
              : deployment.status === 'running' || deployment.status === 'pending' ? <Activity size={18} className="animate-pulse text-purple-500" />
                : deployment.status === 'rolling_back' ? <RotateCcw size={18} className="animate-spin text-amber-500" />
                  : <Clock size={18} className="text-[var(--color-text-muted)]" />}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">{appName}</p>
            <span className="text-[var(--color-text-muted)]">→</span>
            <p className="text-sm text-[var(--color-text-muted)]">{targetName}{targetHost}</p>
            <TriggerBadge trigger={deployment.trigger} />
          </div>

          {deployment.commit?.sha && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <GitCommit size={11} />
              <span className="font-mono">{deployment.commit.sha.slice(0, 8)}</span>
              {deployment.commit.message && <span className="max-w-[200px] truncate">{deployment.commit.message.split('\n')[0]}</span>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
            <span>{formatDate(deployment.created)}</span>
            {deployment.durationMs && <span>{formatDuration(deployment.durationMs)}</span>}
            {steps.length > 0 && <span>{successCount}/{steps.length} steps</span>}
            {rollbackCount > 0 && (
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <RotateCcw size={10} />{rollbackCount} rollback{rollbackCount > 1 ? 's' : ''}
              </span>
            )}
            {deployment.rolledBack && (
              <span className="inline-flex items-center gap-0.5 text-amber-600">
                <Zap size={10} />rolled back
              </span>
            )}
          </div>
        </div>

        <div className="shrink-0">
          <span className={classNames('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset', DEPLOYMENT_STATUS_STYLES[deployment.status])}>
            {deployment.status.replace(/_/g, ' ')}
          </span>
        </div>
      </button>
    </li>
  )
}

// ─── Pre-deployment Intelligence Modal (Predict-Then-Deploy) ─────────────────

function PreDeploymentIntelligenceModal({
  applicationId,
  targetId,
  appLabel,
  targetLabel,
  onClose,
  onProceed,
}: {
  applicationId: string
  targetId: string
  appLabel: string
  targetLabel: string
  onClose: () => void
  onProceed: (predictionId: string) => void
}) {
  const [predictDeployment, { isLoading: predicting }] = usePredictDeploymentMutation()
  const [prediction, setPrediction] = useState<DeploymentPrediction | null>(null)
  const [predictionError, setPredictionError] = useState<string | null>(null)
  const { showToast } = useToast()
  // Guard against React StrictMode's double-invoke of useEffect in development.
  // Mutations are not deduplicated like queries, so without this the LLM is called
  // twice and the user sees two different prediction results.
  const hasTriggeredRef = useRef(false)

  const runPrediction = useCallback(async () => {
    setPredictionError(null)
    try {
      const result = await predictDeployment({ applicationId, targetId }).unwrap()
      setPrediction(result)
    } catch (err) {
      // RTK Query surfaces the server body under `data`; the API returns the human
      // readable cause in `respMessage` (e.g. an unreachable LLM / connection error).
      const body = (err as { data?: { respMessage?: string; message?: string } })?.data
      const reason = body?.respMessage || body?.message
        || 'The AI prediction service is unavailable or could not be reached.'
      setPrediction(null)
      setPredictionError(reason)
      showToast({ severity: 'error', summary: 'Failed to analyze deployment.' })
    }
  }, [predictDeployment, applicationId, targetId, showToast])

  // Run the prediction automatically when the modal opens — exactly once.
  useEffect(() => {
    if (hasTriggeredRef.current) return
    hasTriggeredRef.current = true
    void runPrediction()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isBlocked = prediction?.recommendation === 'block'
  const isNoChanges = prediction?.noChangesDetected || prediction?.source === 'no_changes'
  const footer = (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <button
        type="button"
        onClick={onClose}
        className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)]"
      >
        Cancel
      </button>
      <button
        type="button"
        onClick={runPrediction}
        disabled={predicting}
        className="flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-[var(--color-surface)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] transition hover:bg-[var(--color-surface-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw size={14} className={predicting ? 'animate-spin' : ''} />
        Re-analyze
      </button>
      <button
        type="button"
        onClick={() => prediction && onProceed(prediction._id)}
        disabled={!prediction || predicting}
        className={classNames(
          'flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:cursor-not-allowed disabled:opacity-50',
          isBlocked ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]',
        )}
      >
        {isBlocked ? <ShieldAlert size={14} /> : isNoChanges ? <CheckCircle2 size={14} /> : <Play size={14} />}
        {isBlocked ? 'Deploy Anyway' : isNoChanges ? 'Re-deploy Current Version' : 'Proceed with Deployment'}
      </button>
    </div>
  )

  return (
    <Dialog
      visible
      onHide={onClose}
      header={
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[var(--color-primary)]" />
          <span>Pre-Deployment Intelligence</span>
        </div>
      }
      style={{ width: '720px', maxWidth: '95vw' }}
      modal
      blockScroll
      draggable={false}
      resizable={false}
      className="crud-view-dialog"
      contentClassName="overflow-y-auto"
      footer={footer}
    >
      <div className="space-y-4">
        {/* Target summary */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Application</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-strong)]" title={appLabel}>{appLabel}</p>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Target Server</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[var(--color-text-strong)]" title={targetLabel}>{targetLabel}</p>
          </div>
        </div>

        {predicting && !prediction && (
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6">
            <RefreshCw size={16} className="animate-spin text-[var(--color-text-muted)]" />
            <p className="text-sm text-[var(--color-text-muted)]">Analyzing commit changes and predicting deployment impact…</p>
          </div>
        )}

        {prediction && <IntelligencePanel prediction={prediction} />}

        {!prediction && !predicting && predictionError && (
          <UnavailablePanel reason={predictionError} />
        )}
      </div>
    </Dialog>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DeploymentsPage() {
  const [selectedApplicationId, setSelectedApplicationId] = useState<string>('')
  const [selectedTargetId, setSelectedTargetId] = useState<string>('')
  const [viewingDeploymentId, setViewingDeploymentId] = useState<string | null>(null)
  const [showIntelligenceModal, setShowIntelligenceModal] = useState(false)
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(20)

  const { data: applications = [], isLoading: appsLoading } = useGetApplicationsQuery()
  const { data: targets = [], isLoading: targetsLoading } = useGetDeploymentTargetsQuery()
  const { data: deploymentsResult, isLoading: deploymentsLoading, refetch } = useGetDeploymentsQuery({
    applicationId: selectedApplicationId || undefined,
    page: String(page),
    limit: String(limit),
  })
  const [triggerDeployment, { isLoading: triggering }] = useTriggerDeploymentMutation()
  const { showToast } = useToast()

  const isLoading = appsLoading || targetsLoading
  const deployments = deploymentsResult?.data ?? []
  const totalItems = deploymentsResult?.total ?? 0

  const handlePageChange = (event: { first: number; rows: number }) => {
    setPage(Math.floor(event.first / event.rows) + 1)
    setLimit(event.rows)
  }

  const applicationOptions = useMemo(() => applications.map((a) => ({ label: a.name, value: a._id })), [applications])
  const targetOptions = useMemo(() => targets.map((t) => ({ label: `${t.name} (${t.host})`, value: t._id })), [targets])

  const rollbackStats = useMemo(() => {
    const rolled = deployments.filter((d) => d.status === 'rolled_back').length
    const totalRollbacks = deployments.reduce((sum, d) => sum + (d.rollbackHistory?.length ?? 0), 0)
    return { rolled, totalRollbacks }
  }, [deployments])

  // Predict-Then-Deploy: open the intelligence panel first; deployment is only
  // triggered after the user reviews the prediction and chooses to proceed.
  const handleProceedDeployment = useCallback(async (predictionId: string) => {
    if (!selectedApplicationId || !selectedTargetId) return
    try {
      const deployment = await triggerDeployment({
        applicationId: selectedApplicationId,
        targetId: selectedTargetId,
        predictionId,
      }).unwrap()
      showToast({ severity: 'success', summary: 'Deployment triggered. Pipeline is starting...' })
      setShowIntelligenceModal(false)
      setViewingDeploymentId(deployment._id)
    } catch {
      showToast({ severity: 'error', summary: 'Failed to trigger deployment.' })
    }
  }, [selectedApplicationId, selectedTargetId, triggerDeployment, showToast])

  if (isLoading) return <LoadingScreen />

  if (viewingDeploymentId) {
    return (
      <div className="space-y-6">
        <DeploymentDetail deploymentId={viewingDeploymentId} onBack={() => setViewingDeploymentId(null)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deployment Agent"
        title="Deployments"
        description="Trigger and monitor application deployments across your infrastructure."
        actions={
          <button
            type="button"
            onClick={refetch}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
          >
            <RefreshCw size={14} />Refresh
          </button>
        }
      />

      {/* Rollback stat strip */}
      {rollbackStats.totalRollbacks > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
            <RotateCcw size={14} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800 dark:text-amber-300">{rollbackStats.totalRollbacks} total rollback{rollbackStats.totalRollbacks !== 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span className="text-sm font-semibold text-[var(--color-text-strong)]">{rollbackStats.rolled} currently rolled back</span>
          </div>
        </div>
      )}

      {/* Trigger section */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-4 text-sm font-semibold text-[var(--color-text-strong)]">Trigger a Deployment</p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Application</label>
            <Dropdown
              value={selectedApplicationId}
              options={applicationOptions}
              onChange={(e) => {
                setSelectedApplicationId(e.value);
                setPage(1)
              }}
              placeholder="Select application"
              className="w-full"
              filter
            />
          </div>
          <div className="min-w-[220px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">Target server</label>
            <Dropdown
              value={selectedTargetId}
              options={targetOptions}
              onChange={(e) => {
                setSelectedTargetId(e.value);
                setPage(1)
              }}
              placeholder="Select target"
              className="w-full"
              filter
            />
          </div>
          <button
            type="button"
            onClick={() => setShowIntelligenceModal(true)}
            disabled={!selectedApplicationId || !selectedTargetId || triggering}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Brain size={14} />
            {triggering ? 'Deploying…' : 'Analyze & Deploy'}
          </button>
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          AI analyzes the change and predicts deployment risk before you proceed.
        </p>
      </div>

      {showIntelligenceModal && selectedApplicationId && selectedTargetId && (
        <PreDeploymentIntelligenceModal
          applicationId={selectedApplicationId}
          targetId={selectedTargetId}
          appLabel={applications.find((a) => a._id === selectedApplicationId)?.name ?? 'Application'}
          targetLabel={targetOptions.find((t) => t.value === selectedTargetId)?.label ?? 'Target'}
          onClose={() => setShowIntelligenceModal(false)}
          onProceed={handleProceedDeployment}
        />
      )}

      {/* Deployments list */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">
            Recent Deployments {selectedApplicationId ? `· ${applications.find((a) => a._id === selectedApplicationId)?.name}` : ''}
          </p>
          <span className="text-xs text-[var(--color-text-muted)]">{totalItems} deployments</span>
        </div>

        {deploymentsLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}

        {!deploymentsLoading && !deployments.length && (
          <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No deployments yet. Trigger one above.</p>
        )}

        {!deploymentsLoading && deployments.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {deployments.map((deployment) => (
              <DeploymentRow
                key={deployment._id}
                deployment={deployment}
                onView={() => setViewingDeploymentId(deployment._id)}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Pagination Controls */}
      <div className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 shadow-sm">
        <div className="flex items-center gap-4">
          <Paginator
            first={(page - 1) * limit}
            rows={limit}
            totalRecords={totalItems}
            rowsPerPageOptions={[10, 20, 50, 100]}
            template="CurrentPageReport RowsPerPageDropdown"
            currentPageReportTemplate="Showing {first}-{last} of {totalRecords}"
            className="compact-paginator"
            onPageChange={handlePageChange}
          />
        </div>
        <Paginator
          first={(page - 1) * limit}
          rows={limit}
          totalRecords={totalItems}
          template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink"
          className="compact-paginator"
          onPageChange={handlePageChange}
        />
      </div>
    </div>
  )
}
