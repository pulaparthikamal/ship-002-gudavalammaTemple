import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Activity,
  Box,
  Brain,
  CheckCircle,
  Key,
  RotateCcw,
  Server,
  ShieldCheck,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import {
  useGetApplicationsQuery,
  useGetCredentialsQuery,
  useGetDeploymentsQuery,
  useGetDeploymentTargetsQuery,
  useGetRollbackStatsQuery,
  useGetDeploymentPredictionsQuery,
} from '@/services/api/endpoints/deploymentAgentApi'
import { classNames, formatDate } from '@/utils/serverManagementFormat'
import type {
  DeploymentAppRef,
  DeploymentStatus,
  DeploymentTargetRef,
  PredictionRecommendation,
} from '@/types/deploymentAgent'

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

function predictionRefName(ref: unknown, fallback: string): string {
  return typeof ref === 'object' && ref !== null && 'name' in (ref as Record<string, unknown>)
    ? String((ref as { name: string }).name)
    : fallback
}

const DEPLOYMENT_STATUS_STYLES: Record<DeploymentStatus, string> = {
  pending: 'bg-gradient-to-r from-sky-100 to-blue-100 text-sky-800 ring-sky-300 dark:from-sky-500/15 dark:to-blue-500/15 dark:text-sky-300',
  running: 'bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-800 ring-violet-300 animate-pulse dark:from-violet-500/15 dark:to-indigo-500/15 dark:text-violet-300',
  success: 'bg-gradient-to-r from-emerald-100 to-green-100 text-emerald-800 ring-emerald-300 dark:from-emerald-500/15 dark:to-green-500/15 dark:text-emerald-300',
  failed: 'bg-gradient-to-r from-rose-100 to-red-100 text-rose-800 ring-rose-300 dark:from-rose-500/15 dark:to-red-500/15 dark:text-rose-300',
  rolling_back: 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 ring-amber-300 animate-pulse dark:from-amber-500/15 dark:to-orange-500/15 dark:text-amber-300',
  rolled_back: 'bg-gradient-to-r from-teal-100 to-cyan-100 text-teal-800 ring-teal-300 dark:from-teal-500/15 dark:to-cyan-500/15 dark:text-teal-300',
  cancelled: 'bg-gradient-to-r from-slate-100 to-gray-100 text-slate-700 ring-slate-300 dark:from-slate-500/10 dark:to-gray-500/10 dark:text-slate-300',
}

export function DeploymentDashboardPage() {
  const { data: applications = [], isLoading: appsLoading } = useGetApplicationsQuery()
  const { data: targets = [], isLoading: targetsLoading } = useGetDeploymentTargetsQuery()
  const { data: credentials = [], isLoading: credsLoading } = useGetCredentialsQuery()
  const { data: deploymentsResult, isLoading: deploymentsLoading } = useGetDeploymentsQuery({ limit: '8' })
  const { data: rollbackStats } = useGetRollbackStatsQuery()
  const { data: predictionsResult } = useGetDeploymentPredictionsQuery({ limit: '6' })
  const deployments = deploymentsResult?.data ?? []
  const predictions = predictionsResult?.data ?? []

  const isLoading = appsLoading || targetsLoading || credsLoading || deploymentsLoading

  const stats = useMemo(() => {
    const total = deployments.length
    const succeeded = deployments.filter((d) => d.status === 'success').length
    const failed = deployments.filter((d) => d.status === 'failed').length
    const running = deployments.filter((d) => d.status === 'running' || d.status === 'pending').length
    return { total, succeeded, failed, running }
  }, [deployments])

  const reachableTargets = targets.filter((t) => t.status === 'reachable').length

  if (isLoading) return <LoadingScreen />

  const statCards = [
    {
      label: 'Applications',
      value: applications.length,
      icon: Box,
      href: '/deployment/applications',
      iconColor: 'text-violet-600 dark:text-violet-300',
      iconBg: 'bg-white/70 dark:bg-violet-500/20',
      gradient: 'from-violet-50 via-purple-50 to-white dark:from-violet-500/15 dark:via-purple-500/[0.07] dark:to-transparent',
      ring: 'ring-violet-200/70 dark:ring-violet-500/20',
    },
    {
      label: 'Targets',
      value: `${reachableTargets}/${targets.length} reachable`,
      icon: Server,
      href: '/deployment/targets',
      iconColor: 'text-cyan-600 dark:text-cyan-300',
      iconBg: 'bg-white/70 dark:bg-cyan-500/20',
      gradient: 'from-cyan-50 via-sky-50 to-white dark:from-cyan-500/15 dark:via-sky-500/[0.07] dark:to-transparent',
      ring: 'ring-cyan-200/70 dark:ring-cyan-500/20',
    },
    {
      label: 'Credentials',
      value: credentials.length,
      icon: Key,
      href: '/deployment/credentials',
      iconColor: 'text-fuchsia-600 dark:text-fuchsia-300',
      iconBg: 'bg-white/70 dark:bg-fuchsia-500/20',
      gradient: 'from-fuchsia-50 via-pink-50 to-white dark:from-fuchsia-500/15 dark:via-pink-500/[0.07] dark:to-transparent',
      ring: 'ring-fuchsia-200/70 dark:ring-fuchsia-500/20',
    },
    {
      label: 'Recent deployments',
      value: stats.total,
      icon: Activity,
      href: '/deployment/deployments',
      iconColor: 'text-lime-600 dark:text-lime-300',
      iconBg: 'bg-white/70 dark:bg-lime-500/20',
      gradient: 'from-lime-50 via-green-50 to-white dark:from-lime-500/15 dark:via-green-500/[0.07] dark:to-transparent',
      ring: 'ring-lime-200/70 dark:ring-lime-500/20',
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Deployment Agent"
        title="Dashboard"
        description="Monitor deployments and manage your application infrastructure."
      />

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <Link
            key={card.label}
            to={card.href}
            className={classNames(
              'group flex items-center gap-4 rounded-xl border border-transparent bg-gradient-to-br p-5 ring-1 ring-inset transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
              card.gradient,
              card.ring
            )}>
            <div className={classNames('rounded-xl p-2.5 ring-1 ring-black/[0.04] transition-transform duration-200 group-hover:scale-105 dark:ring-white/10', card.iconBg)}>
              <card.icon size={20} className={card.iconColor} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[var(--color-text-strong)]">{card.value}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{card.label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Deployment summary */}
      {stats.total > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-4 ring-1 ring-inset ring-emerald-200/70 dark:from-emerald-500/15 dark:via-teal-500/[0.07] dark:to-transparent dark:ring-emerald-500/20">
            <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-emerald-500/20 dark:ring-white/10">
              <CheckCircle size={20} className="text-emerald-600 dark:text-emerald-300" />
            </span>
            <div>
              <p className="text-xl font-bold text-[var(--color-text-strong)]">{stats.succeeded}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Successful</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-rose-50 via-red-50 to-white p-4 ring-1 ring-inset ring-rose-200/70 dark:from-rose-500/15 dark:via-red-500/[0.07] dark:to-transparent dark:ring-rose-500/20">
            <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-rose-500/20 dark:ring-white/10">
              <XCircle size={20} className="text-rose-600 dark:text-rose-300" />
            </span>
            <div>
              <p className="text-xl font-bold text-[var(--color-text-strong)]">{stats.failed}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Failed</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-4 ring-1 ring-inset ring-blue-200/70 dark:from-blue-500/15 dark:via-indigo-500/[0.07] dark:to-transparent dark:ring-blue-500/20">
            <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-blue-500/20 dark:ring-white/10">
              <Activity size={20} className="text-blue-600 dark:text-blue-300" />
            </span>
            <div>
              <p className="text-xl font-bold text-[var(--color-text-strong)]">{stats.running}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Running now</p>
            </div>
          </div>
        </div>
      )}

      {/* Rollback stats */}
      {rollbackStats && (
        <div>
          <div className="flex items-center gap-3 mb-3">
            <p className="text-sm font-semibold text-[var(--color-text-strong)] whitespace-nowrap">
              Rollback Overview
            </p>
            <div className="flex-1 border-t border-[var(--color-border)]" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-amber-50 via-orange-50 to-white p-4 ring-1 ring-inset ring-amber-200/70 dark:from-amber-500/15 dark:via-orange-500/[0.07] dark:to-transparent dark:ring-amber-500/20">
              <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-amber-500/20 dark:ring-white/10">
                <RotateCcw size={20} className="text-amber-600 dark:text-amber-300" />
              </span>
              <div>
                <p className="text-xl font-bold text-[var(--color-text-strong)]">{rollbackStats.total}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Total Rollbacks</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-4 ring-1 ring-inset ring-emerald-200/70 dark:from-emerald-500/15 dark:via-teal-500/[0.07] dark:to-transparent dark:ring-emerald-500/20">
              <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-emerald-500/20 dark:ring-white/10">
                <ShieldCheck size={20} className="text-emerald-600 dark:text-emerald-300" />
              </span>
              <div>
                <p className="text-xl font-bold text-[var(--color-text-strong)]">{rollbackStats.successful}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Successful</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-rose-50 via-red-50 to-white p-4 ring-1 ring-inset ring-rose-200/70 dark:from-rose-500/15 dark:via-red-500/[0.07] dark:to-transparent dark:ring-rose-500/20">
              <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-rose-500/20 dark:ring-white/10">
                <XCircle size={20} className="text-rose-600 dark:text-rose-300" />
              </span>
              <div>
                <p className="text-xl font-bold text-[var(--color-text-strong)]">{rollbackStats.failed}</p>
                <p className="text-xs text-[var(--color-text-muted)]">Failed</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-transparent bg-gradient-to-br from-blue-50 via-indigo-50 to-white p-4 ring-1 ring-inset ring-blue-200/70 dark:from-blue-500/15 dark:via-indigo-500/[0.07] dark:to-transparent dark:ring-blue-500/20">
              <span className="rounded-lg bg-white/70 p-2 ring-1 ring-black/[0.04] dark:bg-blue-500/20 dark:ring-white/10">
                <TrendingUp size={20} className="text-blue-600 dark:text-blue-300" />
              </span>
              <div>
                <p className="text-xl font-bold text-[var(--color-text-strong)]">{rollbackStats.successRate}%</p>
                <p className="text-xs text-[var(--color-text-muted)]">Success Rate</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent deployments table */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Recent Deployments</p>
          <Link
            to="/deployment/deployments"
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            View all
          </Link>
        </div>

        {!deployments.length && (
          <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">No deployments yet.</p>
        )}

        {deployments.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {deployments.slice(0, 8).map((deployment) => {
              // applicationId and targetId are populated objects from the API
              const appName = typeof deployment.applicationId === 'object' && deployment.applicationId !== null
                ? (deployment.applicationId as DeploymentAppRef).name
                : applications.find((a) => a._id === deployment.applicationId)?.name ?? 'Unknown app'
              const targetName = typeof deployment.targetId === 'object' && deployment.targetId !== null
                ? (deployment.targetId as DeploymentTargetRef).name
                : targets.find((t) => t._id === deployment.targetId)?.name ?? 'Unknown target'
              return (
                <li key={deployment._id} className="flex items-center gap-4 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                      {appName}
                    </p>
                    <p className="text-[11px] text-[var(--color-text-muted)]">
                      {targetName} · {formatDate(deployment.created)}
                    </p>
                  </div>
                  <span
                    className={classNames(
                      'inline-flex rounded-full px-3 py-1 text-xs font-semibold capitalize ring-1 ring-inset backdrop-blur-sm',
                      DEPLOYMENT_STATUS_STYLES[deployment.status],
                    )}
                  >
                    {deployment.status.replace(/_/g, ' ')}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Recent predictions */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <Brain size={15} className="text-[var(--color-primary)]" />
            <p className="text-sm font-semibold text-[var(--color-text-strong)]">Recent Predictions</p>
          </div>
          <Link
            to="/deployment/predictions"
            className="text-xs text-[var(--color-primary)] hover:underline"
          >
            View all
          </Link>
        </div>

        {!predictions.length && (
          <p className="py-10 text-center text-sm text-[var(--color-text-muted)]">No predictions yet.</p>
        )}

        {predictions.length > 0 && (
          <ul className="divide-y divide-[var(--color-border)]">
            {predictions.slice(0, 6).map((p) => {
              const appName = predictionRefName(p.applicationId, 'Unknown app')
              const targetName = predictionRefName(p.targetId, 'Unknown target')
              return (
                <li key={p._id}>
                  <Link to="/deployment/predictions" className="flex items-center gap-4 px-4 py-3 hover:bg-[var(--color-surface-muted)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{appName}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)]">
                        {targetName} · {formatDate(p.created)} · {p.source === 'ai' ? 'LLM' : 'Heuristic'}
                      </p>
                    </div>
                    <div className="hidden shrink-0 items-center gap-3 text-[11px] font-medium sm:flex">
                      <span className={classNames(p.riskScore >= 70 ? 'text-rose-600' : p.riskScore >= 40 ? 'text-amber-600' : 'text-emerald-600')}>
                        Risk {p.riskScore}%
                      </span>
                      <span className={classNames(p.confidenceScore >= 70 ? 'text-emerald-600' : p.confidenceScore >= 45 ? 'text-amber-600' : 'text-rose-600')}>
                        Conf {p.confidenceScore}%
                      </span>
                    </div>
                    <span className={classNames('inline-flex shrink-0 rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset', RECOMMENDATION_STYLES[p.recommendation])}>
                      {RECOMMENDATION_LABELS[p.recommendation]}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* Quick links */}
      {/* <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="mb-4 text-sm font-semibold text-[var(--color-text-strong)]">Quick Links</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Add Credential', href: '/deployment/credentials', icon: Key },
            { label: 'Add Target', href: '/deployment/targets', icon: Server },
            { label: 'Add Application', href: '/deployment/applications', icon: Box },
            { label: 'Deploy Now', href: '/deployment/deployments', icon: Activity },
            { label: 'Prediction History', href: '/deployment/predictions', icon: Brain },
          ].map((link) => (
            <Link
              key={link.label}
              to={link.href}
              className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]"
            >
              <link.icon size={16} className="text-[var(--color-text-muted)]" />
              {link.label}
            </Link>
          ))}
        </div>
      </div> */}
    </div>
  )
}
