import { useState, useMemo, useCallback } from 'react'
import {
  AlertTriangle,
  CheckCircle,
  Clock,
  GitBranch,
  GitCommit,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import { Dropdown } from 'primereact/dropdown'
import { Dialog } from 'primereact/dialog'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useToast } from '@/hooks/useToast'
import {
  useGetApplicationsQuery,
  useGetApplicationVersionHistoryQuery,
  useRollbackToVersionMutation,
  useAnalyzeRollbackMutation,
} from '@/services/api/endpoints/deploymentAgentApi'
import { classNames, formatDate } from '@/utils/serverManagementFormat'
import type {
  DeploymentStatus,
  DeploymentTrigger,
  IVersionRecord,
  RollbackAnalysis,
} from '@/types/deploymentAgent'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DeploymentStatus, string> = {
  pending: 'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/30',
  running: 'bg-purple-100 text-purple-800 ring-purple-300 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/30',
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30',
  failed: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30',
  rolling_back: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30',
  rolled_back: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300 dark:ring-slate-500/20',
  cancelled: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20',
}

const RISK_STYLES = {
  low: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
  high: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
}

function TriggerLabel({ trigger }: { trigger?: DeploymentTrigger }) {
  if (trigger === 'webhook') return <span className="text-indigo-600 dark:text-indigo-400">webhook</span>
  if (trigger === 'rollback') return <span className="text-amber-600 dark:text-amber-400">rollback</span>
  return <span className="text-[var(--color-text-muted)]">manual</span>
}

// ─── AI Analysis Panel ────────────────────────────────────────────────────────

function AIAnalysisPanel({ analysis, loading }: { analysis: RollbackAnalysis | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <RefreshCw size={14} className="animate-spin text-[var(--color-text-muted)]" />
        <p className="text-sm text-[var(--color-text-muted)]">Analyzing rollback safety…</p>
      </div>
    )
  }
  if (!analysis) return null

  const riskStyle = RISK_STYLES[analysis.riskLevel] ?? RISK_STYLES.medium
  const score = analysis.confidenceScore
  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 55 ? 'text-amber-600' : 'text-rose-600'

  return (
    <div className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-center gap-2">
        <ShieldCheck size={15} className="text-[var(--color-primary)]" />
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">AI Safety Analysis</p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-[var(--color-surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Confidence</p>
          <p className={classNames('text-2xl font-bold', scoreColor)}>{score}%</p>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Risk</p>
          <span className={classNames('mt-1 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset', riskStyle)}>
            {analysis.riskLevel}
          </span>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-muted)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Recovery Time</p>
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{analysis.estimatedRecoveryTime}</p>
        </div>
        <div className="col-span-2 rounded-lg bg-[var(--color-surface-muted)] p-3 sm:col-span-1">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Recommendation</p>
          <p className="text-xs font-semibold text-[var(--color-text-strong)]">{analysis.recommendation}</p>
        </div>
      </div>
      {analysis.failureAnalysis && (
        <div className="space-y-1.5 rounded-lg bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-text)]">
          {analysis.failureAnalysis.rootCause && (
            <p><span className="font-semibold">Root cause:</span> {analysis.failureAnalysis.rootCause}</p>
          )}
          {analysis.failureAnalysis.recoveryRecommendation && (
            <p><span className="font-semibold">Recovery:</span> {analysis.failureAnalysis.recoveryRecommendation}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function RollbackConfirmDialog({
  version,
  isLatest,
  onClose,
  onConfirm,
}: {
  version: IVersionRecord
  isLatest: boolean
  onClose: () => void
  onConfirm: (reason: string, analysis: RollbackAnalysis | null) => void
}) {
  const [reason, setReason] = useState('')
  const [analysis, setAnalysis] = useState<RollbackAnalysis | null>(null)
  const [analyzeRollback, { isLoading: analyzing }] = useAnalyzeRollbackMutation()
  const [rolling, setRolling] = useState(false)
  const { showToast } = useToast()

  const handleAnalyze = useCallback(async () => {
    if (!version.deploymentId) return
    try {
      const result = await analyzeRollback({ id: version.deploymentId }).unwrap()
      setAnalysis(result)
    } catch {
      showToast({ severity: 'error', summary: 'Failed to analyze rollback safety.' })
    }
  }, [analyzeRollback, version.deploymentId, showToast])

  const handleConfirm = useCallback(async () => {
    setRolling(true)
    try {
      await onConfirm(reason, analysis)
    } finally {
      setRolling(false)
    }
  }, [onConfirm, reason, analysis])

  return (
    <Dialog
      visible
      onHide={onClose}
      header={
        <div className="flex items-center gap-2">
          <RotateCcw size={16} className="text-amber-600" />
          <span>Confirm Rollback</span>
        </div>
      }
      style={{ width: '600px' }}
      modal
      className="p-fluid"
    >
      <div className="space-y-5 py-2">
        {/* Warning banner */}
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div className="space-y-1 text-sm text-amber-800 dark:text-amber-300">
            <p className="font-semibold">You are about to create a rollback deployment.</p>
            <p className="text-xs">
              A new deployment record will be created that resets the application code to commit{' '}
              <code className="font-mono">{version.commitHash?.slice(0, 8) ?? version.version.slice(0, 8)}</code>.
              {isLatest && ' This is the most recent version — rolling back will revert to the previous state.'}
            </p>
          </div>
        </div>

        {/* Version summary */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Version</p>
            <p className="mt-0.5 font-mono text-sm font-semibold text-[var(--color-text-strong)]">{version.version.slice(0, 8)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Commit ID</p>
            <p className="mt-0.5 font-mono text-sm text-[var(--color-text-muted)]">{version.commitHash?.slice(0, 8) ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Environment</p>
            <div className="mt-0.5 flex items-center gap-1 text-sm text-[var(--color-text-muted)]">
              <GitBranch size={12} />
              {version.environment ?? 'production'}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Build #</p>
            <p className="mt-0.5 font-mono text-sm text-[var(--color-text-muted)]">{version.buildNumber ?? '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Deployed</p>
            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">{formatDate(version.deploymentDate)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Status</p>
            <span className={classNames('mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset', STATUS_STYLES[version.status as DeploymentStatus] ?? '')}>
              {version.status}
            </span>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-[var(--color-text-muted)]">
            Rollback Reason <span className="font-normal text-[var(--color-text-muted)]">(optional)</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            placeholder="Describe why you are rolling back…"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          />
        </div>

        {/* AI Analysis */}
        <AIAnalysisPanel analysis={analysis} loading={analyzing} />

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={rolling}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleAnalyze}
            disabled={analyzing || rolling || !version.deploymentId}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
          >
            <ShieldAlert size={14} />
            {analyzing ? 'Analyzing…' : 'Analyze Safety'}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={rolling}
            className="flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <RotateCcw size={14} className={rolling ? 'animate-spin' : ''} />
            {rolling ? 'Rolling back…' : 'Confirm Rollback'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Version row ──────────────────────────────────────────────────────────────

function VersionRow({
  version,
  isLatest,
  onRollback,
}: {
  version: IVersionRecord
  isLatest: boolean
  onRollback: (v: IVersionRecord) => void
}) {
  const rollbackDisabledReason =
    version.status !== 'success'
      ? 'Only successful deployments can be rolled back to'
      : !version.commitHash
        ? 'No commit SHA was recorded for this deployment — cannot roll back'
        : undefined
  const canRollback = !rollbackDisabledReason

  return (
    <tr className="hover:bg-[var(--color-surface-muted)]">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold text-[var(--color-text-strong)]">
            {version.version.slice(0, 8)}
          </span>
          {isLatest && (
            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              latest
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-muted)]">
        {version.buildNumber ?? '—'}
      </td>
      <td className="px-4 py-3">
        {version.commitHash ? (
          <div className="flex items-center gap-1.5 font-mono text-xs text-[var(--color-text-muted)]">
            <GitCommit size={11} className="shrink-0" />
            {version.commitHash.slice(0, 12)}
          </div>
        ) : (
          <span className="text-xs text-[var(--color-text-muted)]">—</span>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-[var(--color-text-muted)]">
        {formatDate(version.deploymentDate)}
      </td>
      <td className="px-4 py-3">
        <span className={classNames(
          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset',
          STATUS_STYLES[version.status as DeploymentStatus] ?? 'bg-gray-100 text-gray-500 ring-gray-200',
        )}>
          {version.status === 'success'
            ? <><CheckCircle size={10} className="mr-1 inline" />success</>
            : version.status === 'failed'
            ? <><XCircle size={10} className="mr-1 inline" />failed</>
            : version.status}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
          <GitBranch size={11} />
          {version.environment ?? 'production'}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs">
          <TriggerLabel trigger={version.trigger} />
        </span>
      </td>
      <td className="px-4 py-3">
        <button
          type="button"
          disabled={!canRollback}
          onClick={() => onRollback(version)}
          title={rollbackDisabledReason ?? 'Roll back to this version'}
          className={classNames(
            'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
            canRollback
              ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300'
              : 'cursor-not-allowed border border-[var(--color-border)] bg-[var(--color-surface-muted)] text-[var(--color-text-muted)] opacity-50',
          )}
        >
          <RotateCcw size={11} />
          Rollback
        </button>
      </td>
    </tr>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function DeploymentVersionHistoryPage() {
  const [selectedAppId, setSelectedAppId] = useState<string>('')
  const [confirmVersion, setConfirmVersion] = useState<IVersionRecord | null>(null)

  const { data: applications = [], isLoading: appsLoading } = useGetApplicationsQuery()
  const {
    data: versions = [],
    isLoading: versionsLoading,
    refetch,
    isFetching,
  } = useGetApplicationVersionHistoryQuery(selectedAppId, { skip: !selectedAppId })

  const [rollbackToVersion] = useRollbackToVersionMutation()
  const { showToast } = useToast()

  const appOptions = useMemo(
    () => applications.map((a) => ({ label: a.displayName ?? a.name, value: a._id })),
    [applications],
  )

  const latestDeploymentId = useMemo(
    () => versions.find((v) => v.status === 'success')?.deploymentId,
    [versions],
  )

  const handleRollbackConfirm = useCallback(
    async (reason: string, analysis: RollbackAnalysis | null) => {
      if (!confirmVersion?.deploymentId) return
      try {
        await rollbackToVersion({
          targetDeploymentId: confirmVersion.deploymentId,
          reason: reason || undefined,
          confidenceScore: analysis?.confidenceScore,
          riskLevel: analysis?.riskLevel,
        }).unwrap()
        showToast({
          severity: 'success',
          summary: `Rollback to ${confirmVersion.version.slice(0, 8)} initiated. Monitor deployment logs for progress.`,
        })
        setConfirmVersion(null)
        refetch()
      } catch {
        showToast({ severity: 'error', summary: 'Rollback failed. Check deployment logs for details.' })
      }
    },
    [confirmVersion, rollbackToVersion, showToast, refetch],
  )

  if (appsLoading) return <LoadingScreen />

  return (
    <div className="space-y-6">
      {confirmVersion && (
        <RollbackConfirmDialog
          version={confirmVersion}
          isLatest={confirmVersion.deploymentId === latestDeploymentId}
          onClose={() => setConfirmVersion(null)}
          onConfirm={handleRollbackConfirm}
        />
      )}

      <PageHeader
        eyebrow="Deployment Agent"
        title="Version History"
        description="View all deployment versions for an application and roll back to any previously successful version."
        actions={
          selectedAppId && (
            <button
              type="button"
              onClick={refetch}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)] disabled:opacity-50"
            >
              <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
              Refresh
            </button>
          )
        }
      />

      {/* Application selector */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <label className="mb-2 block text-xs font-semibold text-[var(--color-text-muted)]">Select Application</label>
        <Dropdown
          value={selectedAppId}
          options={appOptions}
          onChange={(e) => setSelectedAppId(e.value)}
          placeholder="Choose an application to view its version history…"
          className="w-full max-w-sm"
          filter
        />
      </div>

      {/* Version table */}
      {selectedAppId && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[var(--color-text-muted)]" />
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                Deployment Versions
                {versions.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-[var(--color-text-muted)]">
                    {versions.length} record{versions.length !== 1 ? 's' : ''}
                  </span>
                )}
              </p>
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Rollback is available for <span className="font-semibold text-emerald-600">successful</span> versions only
            </p>
          </div>

          {versionsLoading && (
            <div className="flex items-center justify-center py-16">
              <RefreshCw size={20} className="animate-spin text-[var(--color-text-muted)]" />
            </div>
          )}

          {!versionsLoading && !versions.length && (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <Clock size={32} className="text-[var(--color-text-muted)] opacity-40" />
              <p className="text-sm font-medium text-[var(--color-text-muted)]">No deployment history found for this application.</p>
              <p className="text-xs text-[var(--color-text-muted)]">Trigger a deployment to start tracking versions.</p>
            </div>
          )}

          {!versionsLoading && versions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)]">
                    {['Version', 'Build #', 'Commit ID', 'Deployment Date', 'Status', 'Environment', 'Trigger', 'Action'].map((h) => (
                      <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {versions.map((v) => (
                    <VersionRow
                      key={v.deploymentId ?? v.version}
                      version={v}
                      isLatest={v.deploymentId === latestDeploymentId}
                      onRollback={setConfirmVersion}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedAppId && (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] py-20 text-center">
          <GitBranch size={36} className="text-[var(--color-text-muted)] opacity-30" />
          <p className="text-sm font-medium text-[var(--color-text-muted)]">Select an application above to view its deployment version history.</p>
        </div>
      )}
    </div>
  )
}
