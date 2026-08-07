/**
 * ClaimScrubberModal
 *
 * Displays advisory scrubber errors and warnings.
 * Deterministic claim readiness and backend validation control submission.
 */

import { Dialog } from 'primereact/dialog'
import { AlertCircle, AlertTriangle, CheckCircle2, Lightbulb, ShieldCheck, X } from 'lucide-react'
import { cn } from '@/utils/classNames'
import type { ScrubIssue, ScrubResult } from '@/utils/claimScrubber'

interface ClaimScrubberModalProps {
  visible: boolean
  result: ScrubResult
  onClose: () => void
  onProceed: () => void
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QualityScoreBadge({ score }: { score: number }) {
  const getTone = () => {
    if (score >= 80) {
      return {
        border: 'border-[var(--color-success-text)]/30',
        bg: 'bg-[var(--color-success-soft)]',
        text: 'text-[var(--color-success-text)]',
        bar: 'bg-[var(--color-success-text)]',
      }
    }

    if (score >= 50) {
      return {
        border: 'border-[var(--color-warning-text)]/30',
        bg: 'bg-[var(--color-warning-soft)]',
        text: 'text-[var(--color-warning-text)]',
        bar: 'bg-[var(--color-warning-text)]',
      }
    }

    return {
      border: 'border-[var(--color-danger-text)]/30',
      bg: 'bg-[var(--color-danger-soft)]',
      text: 'text-[var(--color-danger-text)]',
      bar: 'bg-[var(--color-danger-text)]',
    }
  }

  const { bg, border, text, bar } = getTone()
  const label = score >= 80 ? 'Good' : score >= 50 ? 'Fair' : 'Poor'

  return (
    <div className={cn('flex items-center gap-3 rounded-lg border px-4 py-3 shadow-sm', border, bg)}>
      <ShieldCheck className={cn('h-5 w-5 shrink-0', text)} />
      <div className="flex-1">
        <p className={cn('text-xs font-semibold uppercase tracking-normal', text)}>Claim Quality Score</p>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-[var(--color-surface)]/75">
            <div
              className={cn('h-full rounded-full transition-all duration-500', bar)}
              style={{ width: `${score}%` }}
            />
          </div>
          <span className={cn('text-sm font-bold', text)}>{score}/100</span>
          <span className={cn('rounded-full border bg-[var(--color-surface)]/70 px-2 py-0.5 text-[10px] font-bold uppercase', border, text)}>
            {label}
          </span>
        </div>
      </div>
    </div>
  )
}

function IssueItem({ issue }: { issue: ScrubIssue }) {
  const isError = issue.type === 'error'

  return (
    <li
      className={cn(
        'rounded-lg border p-3',
        isError
          ? 'border-[var(--color-danger-text)]/30 bg-[var(--color-danger-soft)]'
          : 'border-[var(--color-warning-text)]/30 bg-[var(--color-warning-soft)]',
      )}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-text)]" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning-text)]" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className={cn('text-sm font-medium', isError ? 'text-[var(--color-danger-text)]' : 'text-[var(--color-warning-text)]')}>
            {issue.message}
          </p>
          {issue.autoFix && (
            <div className="mt-1.5 flex items-start gap-1.5">
              <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-[var(--color-info-text)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-info-text)]">{issue.autoFix}</p>
            </div>
          )}
        </div>
      </div>
    </li>
  )
}

function IssueGroup({
  title,
  issues,
  type,
}: {
  title: string
  issues: ScrubIssue[]
  type: 'error' | 'warning'
}) {
  if (issues.length === 0) return null

  const isError = type === 'error'
  const headerClass = isError
    ? 'text-[var(--color-danger-text)] border-[var(--color-danger-text)]/30'
    : 'text-[var(--color-warning-text)] border-[var(--color-warning-text)]/30'
  const Icon = isError ? AlertCircle : AlertTriangle

  return (
    <div>
      <div className={`mb-2 flex items-center gap-2 border-b pb-2 ${headerClass}`}>
        <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
        <h4 className="text-sm font-bold uppercase tracking-wide">
          {title}
          <span className="ml-2 rounded-full border border-current/20 bg-[var(--color-surface)]/70 px-2 py-0.5 text-xs font-bold">
            {issues.length}
          </span>
        </h4>
      </div>
      <ul className="space-y-2">
        {issues.map((issue, idx) => (
          <IssueItem key={`${issue.field}-${idx}`} issue={issue} />
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main modal
// ---------------------------------------------------------------------------

export function ClaimScrubberModal({
  visible,
  result,
  onClose,
  onProceed,
}: ClaimScrubberModalProps) {
  const { errors, warnings, claimQualityScore } = result
  const hasErrors = errors.length > 0
  const hasWarnings = warnings.length > 0
  const isClean = !hasErrors && !hasWarnings

  const headerTitle = hasErrors
    ? 'Advisory Claim Scrubber - Issues Found'
    : hasWarnings
      ? 'Advisory Claim Scrubber - Warnings Found'
      : 'Advisory Claim Scrubber - All Clear'

  const header = (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
          hasErrors
            ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
            : hasWarnings
              ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'
              : 'bg-[var(--color-success-soft)] text-[var(--color-success-text)]'
        }`}
      >
        {hasErrors ? (
          <AlertCircle className="h-5 w-5" aria-hidden="true" />
        ) : hasWarnings ? (
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
        )}
      </div>
      <div>
        <h2 className="text-base font-bold text-[var(--color-text-strong)]">{headerTitle}</h2>
        <p className="text-xs text-[var(--color-text-muted)]">
          {hasErrors
            ? 'Review these advisory issues before using backend readiness.'
            : hasWarnings
              ? 'Review warnings. Backend readiness remains the submission gate.'
              : 'No advisory scrubber issues were detected.'}
        </p>
      </div>
    </div>
  )

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button
        type="button"
        id="claim-scrubber-close-btn"
        onClick={onClose}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        Fix Issues
      </button>
      {!hasErrors && (
        <button
          type="button"
          id="claim-scrubber-proceed-btn"
          onClick={onProceed}
          className={cn(
            'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors',
            isClean
              ? 'bg-[var(--color-success-text)] text-white hover:opacity-90'
              : 'bg-[var(--color-warning-text)] text-white hover:opacity-90',
          )}
        >
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          {isClean ? 'Continue' : 'Continue'}
        </button>
      )}
    </div>
  )

  return (
    <Dialog
      id="claim-scrubber-modal"
      header={header}
      footer={footer}
      visible={visible}
      onHide={onClose}
      style={{ width: '560px', maxWidth: '95vw' }}
      modal
      draggable={false}
      resizable={false}
      className="claim-scrubber-dialog"
      maskClassName="crud-form-dialog-mask"
    >
      <div className="space-y-5 py-1">
        <QualityScoreBadge score={claimQualityScore} />

        {isClean && (
          <div className="rounded-lg border border-[var(--color-success-text)]/30 bg-[var(--color-success-soft)] p-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-[var(--color-success-text)]" aria-hidden="true" />
            <p className="text-sm font-semibold text-[var(--color-success-text)]">No issues detected.</p>
            <p className="mt-1 text-xs text-[var(--color-success-text)]">
              Backend readiness still controls whether this claim can be submitted.
            </p>
          </div>
        )}

        {hasErrors && (
          <IssueGroup title="Errors - Advisory Only" issues={errors} type="error" />
        )}

        {hasWarnings && (
          <IssueGroup
            title="Warnings — Review Required"
            issues={warnings}
            type="warning"
          />
        )}

        {(hasErrors || hasWarnings) && (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-3 text-xs text-[var(--color-text-muted)]">
            <p className="flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 shrink-0 text-[var(--color-danger-text)]" aria-hidden="true" />
              <strong className="text-[var(--color-danger-text)]">Errors</strong> are advisory in this modal.
            </p>
            <p className="mt-1 flex items-center gap-1.5">
              <AlertTriangle className="h-3 w-3 shrink-0 text-[var(--color-warning-text)]" aria-hidden="true" />
              <strong className="text-[var(--color-warning-text)]">Warnings</strong> are advisory. Backend readiness controls submission.
            </p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
