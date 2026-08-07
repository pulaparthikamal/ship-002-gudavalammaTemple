import { useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Brain,
  CheckCircle2,
  Cpu,
  Filter,
  Gauge,
  GitCommit,
  MousePointerClick,
  RefreshCw,
  Rocket,
  RotateCcw,
  ShieldAlert,
  Webhook,
} from 'lucide-react'
import { Dropdown } from 'primereact/dropdown'
import { Paginator } from 'primereact/paginator'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import {
  useGetApplicationsQuery,
  useGetDeploymentPredictionsQuery,
  useGetPredictionByIdQuery,
} from '@/services/api/endpoints/deploymentAgentApi'
import { classNames, formatDate } from '@/utils/serverManagementFormat'
import { IntelligencePanel } from './IntelligencePanel'
import type {
  DeploymentPrediction,
  DeploymentStatus,
  DeploymentTrigger,
  PredictionRecommendation,
} from '@/types/deploymentAgent'

// ─── Helpers / styles ─────────────────────────────────────────────────────────

function refName(ref: unknown, fallback: string): string {
  return typeof ref === 'object' && ref !== null && 'name' in (ref as Record<string, unknown>)
    ? String((ref as { name: string }).name)
    : fallback
}

const RECOMMENDATION_STYLES: Record<PredictionRecommendation, string> = {
  proceed: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
  proceed_with_caution: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
  block: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
}
const RECOMMENDATION_LABELS: Record<PredictionRecommendation, string> = {
  proceed: 'Proceed',
  proceed_with_caution: 'Caution',
  block: 'Block',
}

const DEPLOYMENT_STATUS_STYLES: Record<string, string> = {
  pending: 'bg-blue-100 text-blue-800 ring-blue-300 dark:bg-blue-500/15 dark:text-blue-300',
  running: 'bg-purple-100 text-purple-800 ring-purple-300 dark:bg-purple-500/15 dark:text-purple-300',
  success: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
  failed: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
  rolling_back: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
  rolled_back: 'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-500/10 dark:text-slate-300',
  cancelled: 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-500/10 dark:text-gray-400',
}

const DEPLOYMENT_TRIGGER_META: Record<DeploymentTrigger, { label: string; style: string; Icon: typeof Webhook }> = {
  webhook: {
    label: 'Auto-deployment',
    style: 'bg-indigo-100 text-indigo-800 ring-indigo-300 dark:bg-indigo-500/15 dark:text-indigo-300',
    Icon: Webhook,
  },
  manual: {
    label: 'Manual',
    style: 'bg-sky-100 text-sky-800 ring-sky-300 dark:bg-sky-500/15 dark:text-sky-300',
    Icon: MousePointerClick,
  },
  rollback: {
    label: 'Rollback',
    style: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
    Icon: RotateCcw,
  },
}

function TriggerBadge({ trigger }: { trigger?: DeploymentTrigger }) {
  const meta = DEPLOYMENT_TRIGGER_META[trigger ?? 'manual'] ?? DEPLOYMENT_TRIGGER_META.manual
  const { label, style, Icon } = meta
  return (
    <span className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', style)}>
      <Icon size={11} />
      {label}
    </span>
  )
}

function scoreColor(score: number, invert = false) {
  if (invert) return score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-rose-600'
  return score >= 70 ? 'text-rose-600' : score >= 40 ? 'text-amber-600' : 'text-emerald-600'
}

type DeploymentRef = { _id: string; status: DeploymentStatus; startedAt?: string; completedAt?: string; durationMs?: number; trigger?: DeploymentTrigger }

function linkedDeployment(prediction: DeploymentPrediction): DeploymentRef | null {
  return typeof prediction.deploymentId === 'object' && prediction.deploymentId !== null
    ? (prediction.deploymentId as DeploymentRef)
    : null
}

// ─── Detail view ──────────────────────────────────────────────────────────────

function PredictionDetail({ predictionId, onBack }: { predictionId: string; onBack: () => void }) {
  const { data: prediction, isLoading } = useGetPredictionByIdQuery(predictionId)

  if (isLoading) return <LoadingScreen />
  if (!prediction) return null

  const appName = refName(prediction.applicationId, 'Unknown app')
  const targetName = refName(prediction.targetId, 'Unknown target')
  const deployment = linkedDeployment(prediction)

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
      >
        <ArrowLeft size={16} />
        Back to prediction history
      </button>

      {/* Header card */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <div className="space-y-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Prediction</p>
          <p className="font-mono text-sm text-[var(--color-text-strong)]">{prediction._id}</p>
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{appName} → {targetName}</p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--color-text-muted)]">
            <span>{formatDate(prediction.created)}</span>
            {prediction.branch && <span className="inline-flex items-center gap-1"><GitCommit size={11} />{prediction.branch}</span>}
            {prediction.commit?.sha && (
              <span className="font-mono text-xs">{prediction.commit.sha.slice(0, 12)}</span>
            )}
          </div>
          {prediction.commit?.message && (
            <p className="mt-1 text-sm text-[var(--color-text)]">{prediction.commit.message}</p>
          )}
        </div>
      </div>

      {/* Associated deployment */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <Rocket size={14} className="text-[var(--color-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Associated Deployment</p>
        </div>
        {deployment ? (
          <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--color-text)]">
            <span className="font-mono text-xs text-[var(--color-text-muted)]">{deployment._id}</span>
            <span className={classNames('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset', DEPLOYMENT_STATUS_STYLES[deployment.status] ?? DEPLOYMENT_STATUS_STYLES.pending)}>
              {deployment.status?.replace(/_/g, ' ')}
            </span>
            <TriggerBadge trigger={deployment.trigger} />
            {deployment.startedAt && <span className="text-xs text-[var(--color-text-muted)]">Started {formatDate(deployment.startedAt)}</span>}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            This prediction was not followed by a deployment (analysis only / not proceeded).
          </p>
        )}
      </div>

      {/* Full intelligence */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <IntelligencePanel prediction={prediction} />
      </div>
    </div>
  )
}

// ─── List row ─────────────────────────────────────────────────────────────────

function PredictionRow({ prediction, onView }: { prediction: DeploymentPrediction; onView: () => void }) {
  const appName = refName(prediction.applicationId, 'Unknown app')
  const targetName = refName(prediction.targetId, 'Unknown target')
  const deployment = linkedDeployment(prediction)
  const isNoChanges = prediction.noChangesDetected || prediction.source === 'no_changes'
  const isUnavailable = prediction.predictionUnavailable || prediction.source === 'unavailable'

  return (
    <li>
      <button
        type="button"
        onClick={onView}
        className="flex w-full items-center gap-4 px-4 py-4 text-left hover:bg-[var(--color-surface-muted)]"
      >
        <div className="mt-0.5 shrink-0">
          {isUnavailable
            ? <AlertTriangle size={18} className="text-amber-500" />
            : isNoChanges
              ? <CheckCircle2 size={18} className="text-sky-500" />
              : prediction.recommendation === 'block'
                ? <ShieldAlert size={18} className="text-rose-500" />
                : <Brain size={18} className="text-[var(--color-primary)]" />}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">{appName}</p>
            <span className="text-[var(--color-text-muted)]">→</span>
            <p className="text-sm text-[var(--color-text-muted)]">{targetName}</p>
            <span className={classNames(
              'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold',
              isUnavailable
                ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                : isNoChanges
                  ? 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300'
                  : prediction.source === 'ai'
                    ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
                    : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
            )}>
              {isUnavailable ? <AlertTriangle size={9} /> : isNoChanges ? <CheckCircle2 size={9} /> : prediction.source === 'ai' ? <Cpu size={9} /> : <Gauge size={9} />}
              {isUnavailable ? 'Unavailable' : isNoChanges ? 'No Changes' : prediction.source === 'ai' ? 'LLM' : 'Heuristic'}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-text-muted)]">
            <span>{formatDate(prediction.created)}</span>
            {isUnavailable ? (
              <span className="text-amber-600 dark:text-amber-400">No risk assessment — prediction unavailable</span>
            ) : isNoChanges ? (
              <span className="text-sky-600 dark:text-sky-400">No new commits</span>
            ) : (
              <>
                <span className={scoreColor(prediction.riskScore)}>Risk {prediction.riskScore}%</span>
                <span className={scoreColor(prediction.failureProbability)}>Fail {prediction.failureProbability}%</span>
                <span className={scoreColor(prediction.confidenceScore, true)}>Conf {prediction.confidenceScore}%</span>
                {prediction.impactedComponents.length > 0 && (
                  <span className="inline-flex items-center gap-0.5"><Boxes size={10} />{prediction.impactedComponents.length} impacted</span>
                )}
              </>
            )}
            {deployment && (
              <span className="inline-flex items-center gap-0.5 text-[var(--color-text-muted)]">
                <Rocket size={10} />deployed ({deployment.status?.replace(/_/g, ' ')})
              </span>
            )}
          </div>
          {/* Commit info: show current HEAD for no_changes, or incoming commits for normal */}
          {isNoChanges && prediction.commit?.sha ? (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <GitCommit size={10} className="shrink-0" />
              <span className="font-mono">{prediction.commit.sha.slice(0, 8)}</span>
              {prediction.commit.message && <span className="truncate max-w-xs">{prediction.commit.message}</span>}
            </div>
          ) : prediction.commits?.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
              <GitCommit size={10} className="shrink-0" />
              <span className="font-mono">{prediction.commits[0].sha.slice(0, 8)}</span>
              <span className="truncate max-w-xs">{prediction.commits[0].message}</span>
              {prediction.commits.length > 1 && (
                <span className="shrink-0 text-[10px]">+{prediction.commits.length - 1} more</span>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0">
          {isUnavailable ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
              <AlertTriangle size={10} />
              Unavailable
            </span>
          ) : isNoChanges ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 ring-1 ring-inset ring-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
              <CheckCircle2 size={10} />
              No Changes
            </span>
          ) : (
            <span className={classNames('inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', RECOMMENDATION_STYLES[prediction.recommendation])}>
              {RECOMMENDATION_LABELS[prediction.recommendation]}
            </span>
          )}
        </div>
      </button>
    </li>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function PredictionHistoryPage() {
  const [applicationId, setApplicationId] = useState<string>('')
  const [recommendation, setRecommendation] = useState<string>('')
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(20)

  const { data: applications = [] } = useGetApplicationsQuery()
  const { data, isLoading, refetch } = useGetDeploymentPredictionsQuery({
    applicationId: applicationId || undefined,
    recommendation: (recommendation || undefined) as PredictionRecommendation | undefined,
    page: String(page),
    limit: String(limit),
  })

  const predictions = data?.data ?? []
  const totalItems = data?.total ?? 0

  const handlePageChange = (event: { first: number; rows: number }) => {
    setPage(Math.floor(event.first / event.rows) + 1)
    setLimit(event.rows)
  }

  const applicationOptions = useMemo(
    () => [{ label: 'All applications', value: '' }, ...applications.map((a) => ({ label: a.name, value: a._id }))],
    [applications],
  )
  const recommendationOptions = [
    { label: 'All recommendations', value: '' },
    { label: 'Proceed', value: 'proceed' },
    { label: 'Proceed with caution', value: 'proceed_with_caution' },
    { label: 'Block', value: 'block' },
  ]

  if (viewingId) {
    return (
      <div className="space-y-6">
        <PredictionDetail predictionId={viewingId} onBack={() => setViewingId(null)} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deployment Agent"
        title="Prediction History"
        description="Historical AI deployment intelligence and the deployments they produced."
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

      {/* Filters */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-[var(--color-border)] pb-3 mb-4">
          <Filter className="h-4 w-4 text-[var(--color-text-muted)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Filters</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Application</label>
            <Dropdown
              value={applicationId}
              options={applicationOptions}
              onChange={(e) => {
                setApplicationId(e.value)
                setPage(1)
              }}
              className="w-full"
              filter
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--color-text-muted)] mb-1">Recommendation</label>
            <Dropdown
              value={recommendation}
              options={recommendationOptions}
              onChange={(e) => {
                setRecommendation(e.value)
                setPage(1)
              }}
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* List */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Predictions</p>
          <span className="text-xs text-[var(--color-text-muted)]">{totalItems} records</span>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin text-[var(--color-text-muted)]" />
          </div>
        )}
        {!isLoading && !predictions.length && (
          <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">No predictions recorded yet.</p>
        )}
        {!isLoading && predictions.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {predictions.map((p) => (
              <PredictionRow key={p._id} prediction={p} onView={() => setViewingId(p._id)} />
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
