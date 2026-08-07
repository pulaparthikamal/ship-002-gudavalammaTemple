import { useState } from 'react'
import {
  AlertTriangle,
  Boxes,
  Brain,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cpu,
  FileDiff,
  Gauge,
  GitCommit,
  Lightbulb,
  Minus,
  Network,
  Plus,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react'
import { classNames } from '@/utils/serverManagementFormat'
import type {
  DeploymentPrediction,
  IChangedFile,
  ICommitEntry,
  IPredictionRisk,
  PredictionRecommendation,
  PredictionRiskSeverity,
} from '@/types/deploymentAgent'

// ─── Style maps ────────────────────────────────────────────────────────────

const RECOMMENDATION_STYLES: Record<PredictionRecommendation, string> = {
  proceed: 'bg-emerald-100 text-emerald-800 ring-emerald-300 dark:bg-emerald-500/15 dark:text-emerald-300',
  proceed_with_caution: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
  block: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
}

const RECOMMENDATION_LABELS: Record<PredictionRecommendation, string> = {
  proceed: 'Proceed',
  proceed_with_caution: 'Proceed with Caution',
  block: 'Block Deployment',
}

const SEVERITY_STYLES: Record<PredictionRiskSeverity, string> = {
  low: 'bg-blue-100 text-blue-700 ring-blue-200 dark:bg-blue-500/10 dark:text-blue-300',
  medium: 'bg-amber-100 text-amber-800 ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300',
  high: 'bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-500/15 dark:text-orange-300',
  critical: 'bg-rose-100 text-rose-800 ring-rose-300 dark:bg-rose-500/15 dark:text-rose-300',
}

const CHANGE_TYPE_STYLES: Record<string, string> = {
  A: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
  M: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
  D: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  R: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
}
const CHANGE_TYPE_LABELS: Record<string, string> = {
  A: 'Added',
  M: 'Modified',
  D: 'Deleted',
  R: 'Renamed',
}

function riskColor(score: number) {
  return score >= 70 ? 'text-rose-600' : score >= 40 ? 'text-amber-600' : 'text-emerald-600'
}
function confidenceColor(score: number) {
  return score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-rose-600'
}
function barColor(value: number, label: string) {
  switch (label.toLowerCase()) {
    case 'risk score':
    case 'failure probability':
      // Lower is better
      if (value <= 30) return 'bg-emerald-500'
      if (value <= 70) return 'bg-amber-500'
      return 'bg-rose-500'

    case 'confidence':
      // Higher is better
      if (value >= 70) return 'bg-emerald-500'
      if (value >= 40) return 'bg-amber-500'
      return 'bg-rose-500'

    default:
      return 'bg-blue-500'
  }
}

// ─── Diff parser ────────────────────────────────────────────────────────────

type DiffLineType = 'added' | 'removed' | 'context' | 'hunk' | 'file-header' | 'no-newline'

interface DiffLine {
  type: DiffLineType
  content: string
  oldLine: number | null
  newLine: number | null
}

function parseDiff(raw: string): DiffLine[] {
  const lines = raw.split('\n')
  const result: DiffLine[] = []
  let oldLine = 0
  let newLine = 0

  for (const line of lines) {
    if (line.startsWith('diff --git') || line.startsWith('index ')) continue

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      result.push({ type: 'file-header', content: line, oldLine: null, newLine: null })
      continue
    }

    if (line.startsWith('@@ ')) {
      // @@ -old_start,old_count +new_start,new_count @@
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
      if (match) {
        oldLine = parseInt(match[1], 10)
        newLine = parseInt(match[2], 10)
      }
      result.push({ type: 'hunk', content: line, oldLine: null, newLine: null })
      continue
    }

    if (line.startsWith('\\ No newline')) {
      result.push({ type: 'no-newline', content: line, oldLine: null, newLine: null })
      continue
    }

    if (line.startsWith('+')) {
      result.push({ type: 'added', content: line.slice(1), oldLine: null, newLine: newLine })
      newLine++
    } else if (line.startsWith('-')) {
      result.push({ type: 'removed', content: line.slice(1), oldLine: oldLine, newLine: null })
      oldLine++
    } else {
      // context line (space or empty)
      result.push({ type: 'context', content: line.length > 0 ? line.slice(1) : '', oldLine: oldLine, newLine: newLine })
      oldLine++
      newLine++
    }
  }

  return result
}

// ─── DiffViewer ─────────────────────────────────────────────────────────────

function DiffViewer({ diff }: { diff: string }) {
  const lines = parseDiff(diff)

  if (!lines.length) {
    return <p className="py-2 text-center text-xs text-[var(--color-text-muted)]">No diff content available.</p>
  }

  return (
    <div className="overflow-x-auto rounded-b-lg">
      <table className="w-full border-collapse font-mono text-[11px] leading-5">
        <tbody>
          {lines.map((line, i) => {
            if (line.type === 'file-header') return null

            if (line.type === 'hunk') {
              return (
                <tr key={i} className="bg-blue-50 dark:bg-blue-950/30">
                  <td className="w-10 select-none border-r border-blue-200 px-2 py-0.5 text-right text-blue-400 dark:border-blue-800" />
                  <td className="w-10 select-none border-r border-blue-200 px-2 py-0.5 text-right text-blue-400 dark:border-blue-800" />
                  <td className="px-3 py-0.5 text-blue-600 dark:text-blue-400">{line.content}</td>
                </tr>
              )
            }

            if (line.type === 'no-newline') {
              return (
                <tr key={i} className="bg-[var(--color-surface-muted)]">
                  <td className="w-10 select-none border-r border-[var(--color-border)] px-2 py-0.5 text-right text-[var(--color-text-muted)]" />
                  <td className="w-10 select-none border-r border-[var(--color-border)] px-2 py-0.5 text-right text-[var(--color-text-muted)]" />
                  <td className="px-3 py-0.5 italic text-[var(--color-text-muted)]">{line.content}</td>
                </tr>
              )
            }

            const isAdded = line.type === 'added'
            const isRemoved = line.type === 'removed'

            return (
              <tr
                key={i}
                className={classNames(
                  isAdded ? 'bg-emerald-50 dark:bg-emerald-950/25' :
                    isRemoved ? 'bg-rose-50 dark:bg-rose-950/25' :
                      'bg-[var(--color-surface)]',
                )}
              >
                {/* Old line number */}
                <td className={classNames(
                  'w-10 select-none border-r px-2 py-0.5 text-right',
                  isAdded
                    ? 'border-emerald-200 text-emerald-400 dark:border-emerald-800'
                    : isRemoved
                      ? 'border-rose-200 text-rose-400 dark:border-rose-800'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)]',
                )}>
                  {line.oldLine ?? ''}
                </td>
                {/* New line number */}
                <td className={classNames(
                  'w-10 select-none border-r px-2 py-0.5 text-right',
                  isAdded
                    ? 'border-emerald-200 text-emerald-400 dark:border-emerald-800'
                    : isRemoved
                      ? 'border-rose-200 text-rose-400 dark:border-rose-800'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)]',
                )}>
                  {line.newLine ?? ''}
                </td>
                {/* Gutter sign */}
                <td className={classNames(
                  'w-4 select-none px-1 py-0.5 text-center font-bold',
                  isAdded ? 'text-emerald-600 dark:text-emerald-400' :
                    isRemoved ? 'text-rose-600 dark:text-rose-400' :
                      'text-[var(--color-text-muted)]',
                )}>
                  {isAdded ? '+' : isRemoved ? '−' : ' '}
                </td>
                {/* Content */}
                <td className={classNames(
                  'whitespace-pre px-2 py-0.5',
                  isAdded ? 'text-emerald-800 dark:text-emerald-200' :
                    isRemoved ? 'text-rose-800 dark:text-rose-200' :
                      'text-[var(--color-text)]',
                )}>
                  {line.content}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── ChangedFileRow ──────────────────────────────────────────────────────────

function ChangedFileRow({ file }: { file: IChangedFile }) {
  const [expanded, setExpanded] = useState(false)
  const type = file.changeType?.toUpperCase() ?? '?'
  const typeStyle = CHANGE_TYPE_STYLES[type] ?? 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
  const typeLabel = CHANGE_TYPE_LABELS[type] ?? type
  const hasDiff = Boolean(file.diff?.trim())
  const hasStats = file.additions != null || file.deletions != null

  // Build the additions/deletions bar (like GitHub's visual bar)
  const total = (file.additions ?? 0) + (file.deletions ?? 0)
  const addPct = total > 0 ? Math.round(((file.additions ?? 0) / total) * 5) : 0
  const delPct = total > 0 ? 5 - addPct : 0

  return (
    <div className="border-b border-[var(--color-border)] last:border-b-0">
      <button
        type="button"
        onClick={() => hasDiff && setExpanded((v) => !v)}
        className={classNames(
          'flex w-full items-center gap-2 px-3 py-2 text-left',
          hasDiff ? 'hover:bg-[var(--color-surface-muted)] cursor-pointer' : 'cursor-default',
        )}
      >
        {/* Change type badge */}
        <span className={classNames('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold', typeStyle)}>
          {typeLabel}
        </span>

        {/* File path */}
        <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--color-text)]">
          {file.path}
        </span>

        {/* Additions / deletions stats */}
        {hasStats && (
          <span className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
            {file.additions != null && (
              <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                <Plus size={10} strokeWidth={2.5} />
                {file.additions}
              </span>
            )}
            {file.deletions != null && (
              <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                <Minus size={10} strokeWidth={2.5} />
                {file.deletions}
              </span>
            )}
            {/* Visual bar */}
            <span className="flex gap-px">
              {Array.from({ length: 5 }, (_, idx) => (
                <span
                  key={idx}
                  className={classNames(
                    'inline-block h-2.5 w-1.5 rounded-sm',
                    idx < addPct
                      ? 'bg-emerald-500'
                      : idx < addPct + delPct
                        ? 'bg-rose-500'
                        : 'bg-[var(--color-border)]',
                  )}
                />
              ))}
            </span>
          </span>
        )}

        {/* Expand chevron */}
        {hasDiff && (
          expanded
            ? <ChevronDown size={13} className="shrink-0 text-[var(--color-text-muted)]" />
            : <ChevronRight size={13} className="shrink-0 text-[var(--color-text-muted)]" />
        )}
      </button>

      {/* Diff viewer */}
      {expanded && hasDiff && (
        <div className="max-h-96 overflow-y-auto border-t border-[var(--color-border)]">
          <DiffViewer diff={file.diff!} />
        </div>
      )}
    </div>
  )
}

// ─── CommitsList ─────────────────────────────────────────────────────────────

function CommitsList({ commits }: { commits: ICommitEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? commits : commits.slice(0, 5)
  const hasMore = commits.length > 5
  const formatDate = (date: string) => {
    // git emits "YYYY-MM-DD HH:mm:ss +ZZZZ" — normalise to ISO 8601 so Date can
    // parse the absolute instant, then render it in the viewer's local timezone.
    const iso = date
      .trim()
      .replace(' ', 'T')
      .replace(/\s*([+-]\d{2})(\d{2})$/, '$1:$2')
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return date
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    })
      .format(d)
      .replace(/\b(am|pm)\b/i, (m) => m.toUpperCase())
  }

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2">
        <GitCommit size={13} className="text-[var(--color-primary)]" />
        <p className="flex-1 text-xs font-semibold text-[var(--color-text-strong)]">
          Incoming Commits ({commits.length})
        </p>
      </div>
      <ul className="divide-y divide-[var(--color-border)]">
        {visible.map((c, i) => (
          <li key={`${c.sha}-${i}`} className="flex items-start gap-3 px-3 py-2.5">
            <span className="mt-0.5 shrink-0 font-mono text-[11px] font-semibold text-[var(--color-text-muted)]">
              {c.sha.slice(0, 8)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-[var(--color-text-strong)]">
                {c.message || <span className="italic text-[var(--color-text-muted)]">no message</span>}
              </p>
              {(c.author || c.date) && (
                <p className="mt-0.5 text-[11px] text-[var(--color-text-muted)]">
                  {c.author && <span>{c.author}</span>}
                  {c.author && c.date && <span className="mx-1">·</span>}
                  {c.date && <span>{formatDate(c.date)}</span>}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>
      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-center gap-1 border-t border-[var(--color-border)] py-2 text-xs text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)]"
        >
          {expanded
            ? <><ChevronDown size={12} /> Show fewer</>
            : <><ChevronRight size={12} /> Show {commits.length - 5} more</>
          }
        </button>
      )}
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function MetricCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <div className="flex items-center gap-1.5 text-[var(--color-text-muted)]">
        {icon}
        <p className="text-[10px] font-semibold uppercase tracking-wide">{label}</p>
      </div>
      <p className={classNames('mt-1 text-2xl font-bold', color)}>{value}%</p>
      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-border)]">
        <div className={classNames('h-full rounded-full', barColor(value, label))} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function RiskRow({ risk }: { risk: IPredictionRisk }) {
  return (
    <div className="flex flex-col gap-1 border-b border-[var(--color-border)] py-2.5 last:border-b-0 sm:flex-row sm:items-start sm:gap-3">
      <span className={classNames('inline-flex h-fit shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ring-1 ring-inset', SEVERITY_STYLES[risk.severity] ?? SEVERITY_STYLES.low)}>
        {risk.severity}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-[var(--color-text-strong)]">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{risk.area}</span>
          {' · '}{risk.issue}
        </p>
        {risk.mitigation && (
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]"><span className="font-semibold">Mitigation:</span> {risk.mitigation}</p>
        )}
      </div>
    </div>
  )
}

// ─── No-changes panel ────────────────────────────────────────────────────────

function NoChangesPanel({ prediction }: { prediction: DeploymentPrediction }) {
  const sha = prediction.commit?.sha
  const message = prediction.commit?.message

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[var(--color-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Deployment Intelligence</p>
          <span className="inline-flex items-center gap-1 rounded-md bg-lime-500 px-2 py-0.5 text-[10px] font-semibold text-lime-900 ring-1 ring-inset ring-lime-300 dark:bg-lime-500/15 dark:text-lime-300 dark:ring-lime-500/30">
            <Gauge size={9} />
            No Analysis Detected
          </span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-100 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-300 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30">
          <CheckCircle2 size={12} />
          No Changes Detected
        </span>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 dark:border-sky-500/20 dark:bg-sky-500/10">
        <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-sky-600 dark:text-sky-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-sky-800 dark:text-sky-300">Production is already up to date</p>
          <p className="text-xs text-sky-700 dark:text-sky-400">
            No new commits were found since the last successful deployment. No AI prediction was generated
            because there are no new code changes to analyze.
          </p>
        </div>
      </div>

      {/* Latest commit */}
      {sha && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <GitCommit size={13} className="text-[var(--color-primary)]" />
            <p className="text-xs font-semibold text-[var(--color-text-strong)]">Currently Deployed Commit</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 font-mono text-sm font-semibold text-[var(--color-text-muted)]">{sha.slice(0, 8)}</span>
            <span> - </span>
            <p className="text-sm text-[var(--color-text)]">
              {message || <span className="italic text-[var(--color-text-muted)]">no commit message</span>}
            </p>
          </div>
        </div>
      )}

      {/* Metrics — N/A state */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex flex-wrap justify-between items-center just gap-6">
          {[
            { label: 'Risk Score', icon: <ShieldAlert size={12} /> },
            { label: 'Failure Probability', icon: <TrendingUp size={12} /> },
            { label: 'Confidence Score', icon: <Gauge size={12} /> },
          ].map(({ label, icon }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">{icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}:</span>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">N/A</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          AI risk metrics are not applicable — no new code changes were detected.
        </p>
      </div>

      {/* Changed files — empty state */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--color-border)] px-3 py-2.5">
          <FileDiff size={13} className="text-[var(--color-primary)]" />
          <p className="text-xs font-semibold text-[var(--color-text-strong)]">Changed Files</p>
          <span className="ml-auto text-[10px] text-[var(--color-text-muted)]">0 files</span>
        </div>
        <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
          No file changes were detected between the deployed version and the target branch.
        </p>
      </div>
    </div>
  )
}

// ─── Prediction-unavailable panel ────────────────────────────────────────────

export function UnavailablePanel({
  prediction,
  reason: reasonOverride,
}: {
  prediction?: DeploymentPrediction | null
  reason?: string
}) {
  const reason = reasonOverride || prediction?.predictionError || prediction?.summary
    || 'The AI prediction service was unavailable.'
  const sha = prediction?.commit?.sha
  const message = prediction?.commit?.message

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[var(--color-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Deployment Intelligence</p>
          <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-300 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
            <AlertTriangle size={9} />
            Prediction Unavailable
          </span>
        </div>
      </div>

      {/* Reason banner */}
      <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div className="space-y-0.5">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Could not generate a deployment prediction</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">{reason}</p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            The auto-deployment proceeded without an AI risk assessment. No heuristic prediction is produced —
            predictions are generated by the LLM only.
          </p>
        </div>
      </div>

      {/* Commit being deployed */}
      {sha && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <GitCommit size={13} className="text-[var(--color-primary)]" />
            <p className="text-xs font-semibold text-[var(--color-text-strong)]">Deploying Commit</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="shrink-0 font-mono text-sm font-semibold text-[var(--color-text-muted)]">{sha.slice(0, 8)}</span>
            <span> - </span>
            <p className="text-sm text-[var(--color-text)]">
              {message || <span className="italic text-[var(--color-text-muted)]">no commit message</span>}
            </p>
          </div>
        </div>
      )}

      {/* Metrics — N/A state */}
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
        <div className="flex flex-wrap justify-between items-center gap-6">
          {[
            { label: 'Risk Score', icon: <ShieldAlert size={12} /> },
            { label: 'Failure Probability', icon: <TrendingUp size={12} /> },
            { label: 'Confidence Score', icon: <Gauge size={12} /> },
          ].map(({ label, icon }) => (
            <div key={label} className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">{icon}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}:</span>
              <span className="text-xs font-semibold text-[var(--color-text-muted)]">N/A</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
          AI risk metrics are not available — the prediction could not be generated.
        </p>
      </div>
    </div>
  )
}

// ─── Main panel ──────────────────────────────────────────────────────────────

export function IntelligencePanel({ prediction }: { prediction: DeploymentPrediction }) {
  const [showFiles, setShowFiles] = useState(false)

  if (prediction.predictionUnavailable || prediction.source === 'unavailable') {
    return <UnavailablePanel prediction={prediction} />
  }

  if (prediction.noChangesDetected || prediction.source === 'no_changes') {
    return <NoChangesPanel prediction={prediction} />
  }

  const recStyle = RECOMMENDATION_STYLES[prediction.recommendation] ?? RECOMMENDATION_STYLES.proceed_with_caution

  const totalAdditions = prediction.changedFiles.reduce((s, f) => s + (f.additions ?? 0), 0)
  const totalDeletions = prediction.changedFiles.reduce((s, f) => s + (f.deletions ?? 0), 0)

  return (
    <div className="space-y-4">
      {/* Header: source + recommendation */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Brain size={16} className="text-[var(--color-primary)]" />
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Deployment Intelligence</p>
          <span className={classNames(
            'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold',
            prediction.source === 'ai'
              ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300'
              : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]',
          )}>
            {prediction.source === 'ai' ? <Cpu size={9} /> : <Gauge size={9} />}
            {prediction.source === 'ai' ? 'LLM analysis' : 'Heuristic'}
          </span>
        </div>
        <span className={classNames('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', recStyle)}>
          {prediction.recommendation === 'block' && <ShieldAlert size={12} />}
          {RECOMMENDATION_LABELS[prediction.recommendation]}
        </span>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MetricCard label="Risk Score" value={prediction.riskScore} color={riskColor(prediction.riskScore)} icon={<ShieldAlert size={12} />} />
        <MetricCard label="Failure Probability" value={prediction.failureProbability} color={riskColor(prediction.failureProbability)} icon={<TrendingUp size={12} />} />
        <MetricCard label="Confidence" value={prediction.confidenceScore} color={confidenceColor(prediction.confidenceScore)} icon={<Gauge size={12} />} />
      </div>

      {/* LLM explanation / summary */}
      {prediction.summary && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <p className="text-sm leading-relaxed text-[var(--color-text)]">{prediction.summary}</p>
        </div>
      )}

      {/* Infrastructure impact */}
      {prediction.impactedComponents.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Network size={13} className="text-[var(--color-primary)]" />
            <p className="text-xs font-semibold text-[var(--color-text-strong)]">Infrastructure Impact ({prediction.impactedComponents.length})</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {prediction.impactedComponents.map((c, i) => (
              <span
                key={`${c.key}-${i}`}
                title={c.reason}
                className={classNames(
                  'inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset',
                  c.downstream
                    ? 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300'
                    : 'bg-[var(--color-surface-muted)] text-[var(--color-text)] ring-[var(--color-border)]',
                )}
              >
                <Boxes size={11} />
                {c.key}
                {c.type && <span className="text-[10px] text-[var(--color-text-muted)]">({c.type})</span>}
                {c.downstream && <span className="text-[9px] font-semibold uppercase">downstream</span>}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Incoming commits list */}
      {prediction.commits?.length > 0 && (
        <CommitsList commits={prediction.commits} />
      )}

      {/* Risks */}
      {prediction.risks.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-1 flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            <p className="text-xs font-semibold text-[var(--color-text-strong)]">Identified Risks ({prediction.risks.length})</p>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {prediction.risks.map((r, i) => <RiskRow key={i} risk={r} />)}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {prediction.recommendations.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-center gap-1.5">
            <Lightbulb size={13} className="text-[var(--color-primary)]" />
            <p className="text-xs font-semibold text-[var(--color-text-strong)]">Recommendations</p>
          </div>
          <ul className="space-y-1.5">
            {prediction.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text)]">
                <ChevronRight size={14} className="mt-0.5 shrink-0 text-[var(--color-text-muted)]" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Changed files (collapsible header, per-file expand for diffs) */}
      {prediction.changedFiles.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          {/* Section header */}
          <button
            type="button"
            onClick={() => setShowFiles((v) => !v)}
            className="flex w-full items-center gap-1.5 px-3 py-2.5 text-left hover:bg-[var(--color-surface-muted)]"
          >
            <FileDiff size={13} className="text-[var(--color-primary)]" />
            <p className="flex-1 text-xs font-semibold text-[var(--color-text-strong)]">
              Changed Files ({prediction.changedFiles.length})
            </p>
            {(totalAdditions > 0 || totalDeletions > 0) && (
              <span className="flex items-center gap-2 font-mono text-[11px]">
                {totalAdditions > 0 && (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                    <Plus size={10} strokeWidth={2.5} />{totalAdditions}
                  </span>
                )}
                {totalDeletions > 0 && (
                  <span className="flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                    <Minus size={10} strokeWidth={2.5} />{totalDeletions}
                  </span>
                )}
              </span>
            )}
            {showFiles
              ? <ChevronDown size={14} className="shrink-0 text-[var(--color-text-muted)]" />
              : <ChevronRight size={14} className="shrink-0 text-[var(--color-text-muted)]" />
            }
          </button>

          {/* File list */}
          {showFiles && (
            <div className="border-t border-[var(--color-border)]">
              {prediction.changedFiles.map((f, i) => (
                <ChangedFileRow key={i} file={f} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
