import { Dialog } from 'primereact/dialog'
import { AlertTriangle, CheckCircle2, RefreshCw, Send, ShieldAlert, X } from 'lucide-react'
import { cn } from '@/utils/classNames'
import type { ClaimDenialPredictionResult } from '@/types/claim'

interface ClaimDenialPredictionModalProps {
  visible: boolean
  prediction: ClaimDenialPredictionResult | null
  loading?: boolean
  error?: string | null
  canSubmit?: boolean
  submitLoading?: boolean
  onClose: () => void
  onRetry: () => void
  onProceed?: () => void
}

function getTone(riskLevel?: string) {
  if (riskLevel === 'High') {
    return {
      icon: 'text-[var(--color-danger-text)]',
      bg: 'bg-[var(--color-danger-soft)]',
      border: 'border-[var(--color-danger-text)]/30',
      bar: 'bg-[var(--color-danger-text)]',
    }
  }

  if (riskLevel === 'Medium') {
    return {
      icon: 'text-[var(--color-warning-text)]',
      bg: 'bg-[var(--color-warning-soft)]',
      border: 'border-[var(--color-warning-text)]/30',
      bar: 'bg-[var(--color-warning-text)]',
    }
  }

  return {
    icon: 'text-[var(--color-success-text)]',
    bg: 'bg-[var(--color-success-soft)]',
    border: 'border-[var(--color-success-text)]/30',
    bar: 'bg-[var(--color-success-text)]',
  }
}

export function ClaimDenialPredictionModal({
  visible,
  prediction,
  loading = false,
  error,
  canSubmit = false,
  submitLoading = false,
  onClose,
  onRetry,
  onProceed,
}: ClaimDenialPredictionModalProps) {
  const tone = getTone(prediction?.riskLevel)
  const isHighRisk = prediction?.riskLevel === 'High'
  const statusText = prediction ? `${prediction.riskLevel} Risk` : loading ? 'Predicting' : 'Not run'

  const header = (
    <div className="flex items-center gap-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', tone.bg, tone.icon)}>
        <ShieldAlert className="h-5 w-5" aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-base font-bold text-[var(--color-text-strong)]">AI Claim Denial Prediction</h2>
        <p className="text-xs text-[var(--color-text-muted)]">Pre-submission denial risk review</p>
      </div>
    </div>
  )

  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)]"
      >
        <X className="h-4 w-4" aria-hidden="true" />
        Close
      </button>
      <button
        type="button"
        onClick={onRetry}
        disabled={loading || submitLoading}
        className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm font-semibold text-[var(--color-text)] transition-colors hover:bg-[var(--color-hover)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
        Retry
      </button>
      {canSubmit && prediction && onProceed ? (
        <button
          type="button"
          onClick={onProceed}
          disabled={loading || submitLoading}
          className={cn(
            'inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
            isHighRisk ? 'bg-[var(--color-danger-text)] hover:opacity-90' : 'bg-[var(--color-success-text)] hover:opacity-90',
          )}
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          {isHighRisk ? 'Acknowledge and Submit' : 'Continue Submission'}
        </button>
      ) : null}
    </div>
  )

  return (
    <Dialog
      header={header}
      footer={footer}
      visible={visible}
      onHide={onClose}
      style={{ width: 'min(96vw, 66rem)' }}
      modal
      blockScroll
      draggable={false}
      resizable={false}
      className="crud-view-dialog claim-denial-prediction-dialog"
      maskClassName="crud-form-dialog-mask"
    >
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-sm text-[var(--color-text-muted)]">
            Predicting denial risk...
          </div>
        ) : null}

        {error ? (
          <div className="rounded-md border border-[var(--color-danger-text)]/30 bg-[var(--color-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--color-danger-text)]">
            {error}
          </div>
        ) : null}

        {prediction ? (
          <>
            <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[var(--color-text-strong)]">Claim denial risk review</h3>
                  <p className="mt-1 text-sm text-[var(--color-text-muted)]">{prediction.summary}</p>
                </div>
                <span className={cn('w-fit rounded-full border px-3 py-1 text-xs font-semibold', tone.border, tone.bg, tone.icon)}>
                  {statusText}
                </span>
              </div>

              <dl className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Denial probability</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{prediction.denialProbability}%</dd>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Risk score</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{prediction.riskScore}/100</dd>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                  <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Confidence</dt>
                  <dd className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{prediction.confidenceLevel}%</dd>
                </div>
              </dl>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--color-text-muted)]">
                    <span>Risk score</span>
                    <span>{prediction.riskScore}/100</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface)]">
                    <div className={cn('h-full rounded-full', tone.bar)} style={{ width: `${prediction.riskScore}%` }} />
                  </div>
                </div>
                <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                  <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--color-text-muted)]">
                    <span>Confidence</span>
                    <span>{prediction.confidenceLevel}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface)]">
                    <div className="h-full rounded-full bg-[var(--color-info-text)]" style={{ width: `${prediction.confidenceLevel}%` }} />
                  </div>
                </div>
              </div>

              {isHighRisk ? (
                <div className="flex items-start gap-2 rounded-md border border-[var(--color-danger-text)]/30 bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger-text)]">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  <p className="font-medium">High denial risk detected. Review the reasons and recommendations before continuing.</p>
                </div>
              ) : null}
            </section>

            <div className="grid gap-4 md:grid-cols-2">
              <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Predicted denial reasons</h3>
                <ul className="space-y-2">
                  {prediction.predictedDenialReasons.map((reason, index) => (
                    <li key={`${reason}-${index}`} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)]">
                      {reason}
                    </li>
                  ))}
                </ul>
              </section>
              <section className="space-y-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
                <h3 className="text-sm font-bold text-[var(--color-text-strong)]">Recommendations</h3>
                <ul className="space-y-2">
                  {prediction.recommendations.map((recommendation, index) => (
                    <li key={`${recommendation}-${index}`} className="flex items-start gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] px-3 py-2 text-sm text-[var(--color-text)]">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success-text)]" aria-hidden="true" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}
