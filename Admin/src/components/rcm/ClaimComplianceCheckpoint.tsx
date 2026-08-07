import { useMemo, useState } from 'react'
import { AlertCircle, CheckCircle2, FileText, RefreshCw, ShieldAlert } from 'lucide-react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { getApiErrorMessage } from '@/services/api/apiError'
import {
  useGetDocumentationComplianceAlertsQuery,
  useRefreshDocumentationComplianceClaimMutation,
} from '@/services/api/endpoints/documentationComplianceAlertsApi'
import {
  useGetTimelyFilingAlertsQuery,
  useRefreshTimelyFilingClaimMutation,
} from '@/services/api/endpoints/timelyFilingAlertsApi'
import type { ClaimReadinessResult } from '@/types/claim'
import type { CrudListQuery } from '@/types/crud'
import type { DocumentationComplianceAlert } from '@/types/documentationComplianceAlert'
import type { TimelyFilingAlert } from '@/types/timelyFilingAlert'
import { cn } from '@/utils/classNames'

type Tone = 'success' | 'warning' | 'danger' | 'neutral'

interface ClaimComplianceCheckpointProps {
  claimId?: string
  timelyFiling?: ClaimReadinessResult['timelyFiling']
  documentationCompliance?: ClaimReadinessResult['documentationCompliance']
  title?: string
  subtitle?: string
}

function formatDate(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(dateValue.getTime())) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(dateValue)
}

function getTimelyTone(status?: string): Tone {
  if (status === 'EXPIRED' || status === 'CRITICAL') {
    return 'danger'
  }

  if (status === 'WARNING') {
    return 'warning'
  }

  if (status === 'SAFE') {
    return 'success'
  }

  return 'neutral'
}

function getDocumentationTone(status?: string): Tone {
  if (status === 'FAIL') {
    return 'danger'
  }

  if (status === 'PASS') {
    return 'success'
  }

  return 'neutral'
}

function toneClassName(tone: Tone) {
  return {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  }[tone]
}

function StatusBadge({ label, tone }: { label: string; tone: Tone }) {
  return <span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold', toneClassName(tone))}>{label}</span>
}

function Fact({ label, value }: { label: string; value?: string | number }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text-strong)]">{value ?? '-'}</dd>
    </div>
  )
}

function DocumentChips({ label, values, tone }: { label: string; values?: string[]; tone: Tone }) {
  const normalizedValues = values?.filter(Boolean) ?? []

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
      {normalizedValues.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {normalizedValues.map((value) => (
            <span key={value} className={cn('inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold', toneClassName(tone))}>
              {value}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">None</p>
      )}
    </div>
  )
}

function normalizeTimelyFiling(
  readinessTimelyFiling: ClaimReadinessResult['timelyFiling'],
  alert?: TimelyFilingAlert,
) {
  if (readinessTimelyFiling) {
    return {
      status: readinessTimelyFiling.status,
      severity: readinessTimelyFiling.severity,
      serviceDate: readinessTimelyFiling.serviceDate,
      filingDeadline: readinessTimelyFiling.filingDeadline,
      daysRemaining: readinessTimelyFiling.daysRemaining,
    }
  }

  if (alert) {
    return {
      status: alert.status,
      severity: alert.severity,
      serviceDate: alert.serviceDate,
      filingDeadline: alert.filingDeadline,
      daysRemaining: alert.daysRemaining,
    }
  }

  return null
}

function normalizeDocumentationCompliance(
  readinessDocumentationCompliance: ClaimReadinessResult['documentationCompliance'],
  alert?: DocumentationComplianceAlert,
) {
  if (readinessDocumentationCompliance) {
    return readinessDocumentationCompliance
  }

  if (alert) {
    return {
      claimId: alert.claimId,
      requiredDocuments: alert.requiredDocuments,
      missingDocuments: alert.missingDocuments,
      matchedDocuments: alert.matchedDocuments,
      severity: alert.severity,
      status: alert.status,
    }
  }

  return null
}

export function ClaimComplianceCheckpoint({
  claimId,
  timelyFiling,
  documentationCompliance,
  title = 'Pre-submit compliance checkpoint',
  subtitle = 'Review timely filing and supporting documentation before transmitting the claim.',
}: ClaimComplianceCheckpointProps) {
  const scopedQuery = useMemo<CrudListQuery>(
    () => ({
      page: 1,
      limit: 1,
      sortfield: 'updated',
      direction: 'desc',
      criteria: claimId ? [{ key: 'claimId', value: claimId, type: 'equals' }] : [],
    }),
    [claimId],
  )
  const timelyFilingQuery = useGetTimelyFilingAlertsQuery(scopedQuery, { skip: !claimId })
  const documentationQuery = useGetDocumentationComplianceAlertsQuery(scopedQuery, { skip: !claimId })
  const [refreshTimelyFilingClaim, refreshTimelyFilingState] = useRefreshTimelyFilingClaimMutation()
  const [refreshDocumentationComplianceClaim, refreshDocumentationState] = useRefreshDocumentationComplianceClaimMutation()
  const [refreshError, setRefreshError] = useState<string | null>(null)

  const timelyFilingSnapshot = normalizeTimelyFiling(timelyFiling, timelyFilingQuery.data?.data?.[0])
  const documentationSnapshot = normalizeDocumentationCompliance(documentationCompliance, documentationQuery.data?.data?.[0])
  const timelyTone = getTimelyTone(timelyFilingSnapshot?.status)
  const documentationTone = getDocumentationTone(documentationSnapshot?.status)
  const hasBlockingIssue = timelyTone === 'danger' || documentationTone === 'danger'
  const loading = timelyFilingQuery.isLoading || documentationQuery.isLoading
  const error = timelyFilingQuery.error || documentationQuery.error

  async function refreshCompliance() {
    if (!claimId) {
      return
    }

    setRefreshError(null)

    try {
      await Promise.all([
        refreshTimelyFilingClaim(claimId).unwrap(),
        refreshDocumentationComplianceClaim(claimId).unwrap(),
      ])
    } catch (error) {
      setRefreshError(getApiErrorMessage(error))
    }
  }

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-[var(--color-primary)]" aria-hidden="true" />
            <h2 className="text-base font-semibold text-[var(--color-text-strong)]">{title}</h2>
          </div>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {loading ? <StatusBadge label="Loading" tone="neutral" /> : null}
          <StatusBadge label={hasBlockingIssue ? 'Attention needed' : 'No blocking compliance'} tone={hasBlockingIssue ? 'danger' : 'success'} />
          {claimId ? (
            <Button
              type="button"
              label="Refresh compliance"
              icon={<RefreshCw className="h-4 w-4" />}
              outlined
              size="small"
              loading={refreshTimelyFilingState.isLoading || refreshDocumentationState.isLoading}
              onClick={() => void refreshCompliance()}
            />
          ) : null}
        </div>
      </div>

      {error ? <Message severity="error" text={getApiErrorMessage(error)} className="mt-3 w-full justify-start" /> : null}
      {refreshError ? <Message severity="error" text={refreshError} className="mt-3 w-full justify-start" /> : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Timely filing</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={timelyFilingSnapshot?.status ?? 'Not checked'} tone={timelyTone} />
              <StatusBadge label={`Severity: ${timelyFilingSnapshot?.severity ?? '-'}`} tone={timelyTone} />
            </div>
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3">
            <Fact label="Service date" value={formatDate(timelyFilingSnapshot?.serviceDate)} />
            <Fact label="Filing deadline" value={formatDate(timelyFilingSnapshot?.filingDeadline)} />
            <Fact label="Days remaining" value={timelyFilingSnapshot?.daysRemaining} />
          </dl>
        </div>

        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-[var(--color-text-muted)]" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Documentation compliance</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge label={documentationSnapshot?.status ?? 'Not checked'} tone={documentationTone} />
              <StatusBadge label={`Severity: ${documentationSnapshot?.severity ?? '-'}`} tone={documentationTone} />
            </div>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <DocumentChips label="Required" values={documentationSnapshot?.requiredDocuments} tone="neutral" />
            <DocumentChips label="Missing" values={documentationSnapshot?.missingDocuments} tone="danger" />
            <DocumentChips label="Matched" values={documentationSnapshot?.matchedDocuments} tone="success" />
          </div>
        </div>
      </div>

      {!loading && !timelyFilingSnapshot && !documentationSnapshot ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-700">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          No saved compliance checkpoint exists for this claim yet. Run readiness or refresh compliance before submit.
        </div>
      ) : null}
    </section>
  )
}
