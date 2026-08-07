import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowLeft, Bot, CheckCircle2, Link2, RefreshCw, Send, ShieldAlert } from 'lucide-react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmClaimLifecycleTimeline } from '@/components/rcm/RcmClaimLifecycleTimeline'
import { ClaimComplianceCheckpoint } from '@/components/rcm/ClaimComplianceCheckpoint'
import { ScreenHelpButton } from '@/components/ui/ScreenHelpButton'
import { getApiErrorMessage } from '@/services/api/apiError'
import {
  useGetClaimQuery,
  useLinkClaimAuthorizationMutation,
  useLinkClaimReferralMutation,
  useRefreshClaimStatusMutation,
  useRefreshClaimPricingMutation,
  useReviewClaimReadinessWithAiMutation,
  useRunClaimEligibilityMutation,
  useSubmitClaimMutation,
  useValidateClaimReadinessMutation,
} from '@/services/api/endpoints/claimsApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import { useGetPriorAuthorizationsQuery } from '@/services/api/endpoints/priorAuthorizationsApi'
import { useGetReferralsQuery } from '@/services/api/endpoints/referralsApi'
import { useGetClaimTrackingsQuery } from '@/services/api/endpoints/claimTrackingsApi'
import { useGetDenialsQuery } from '@/services/api/endpoints/denialsApi'
import { useGetCorrectedClaimsQuery } from '@/services/api/endpoints/correctedClaimsApi'
import { useGetAppealsQuery } from '@/services/api/endpoints/appealsApi'
import { useGetArWorkItemsQuery } from '@/services/api/endpoints/arWorkItemsApi'
import { useGetPatientBillingsQuery } from '@/services/api/endpoints/patientBillingsApi'
import type { Claim, ClaimAiReadinessReviewResult, ClaimClaimLine, ClaimReadinessResult } from '@/types/claim'
import type { ClaimTracking } from '@/types/claimTracking'
import type { Denial } from '@/types/denial'
import type { CorrectedClaim } from '@/types/correctedClaim'
import type { Appeal } from '@/types/appeal'
import type { ArWorkItem } from '@/types/arWorkItem'
import type { PatientBilling } from '@/types/patientBilling'
import { buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

function formatCurrency(value?: number) {
  return typeof value === 'number'
    ? value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : '-'
}

function formatBoolean(value?: boolean) {
  if (typeof value !== 'boolean') {
    return '-'
  }

  return value ? 'Yes' : 'No'
}

function formatList(values?: string[]) {
  return values?.length ? values.join(', ') : '-'
}

function formatDateTime(value?: string | Date | null) {
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
    hour: '2-digit',
    minute: '2-digit',
  }).format(dateValue)
}

function getLineEligibilityStatus(line: ClaimClaimLine) {
  const snapshot = line.coverageRuleSnapshot as Record<string, unknown> | undefined
  const eligibility = snapshot?.eligibility as Record<string, unknown> | undefined
  const status = [eligibility?.eligibilityStatus, eligibility?.coverageStatus].filter(Boolean).join(' / ')
  return line.eligibilityVerificationId ? status || 'Verified' : 'Missing'
}

function getFeeScheduleMatch(line: ClaimClaimLine) {
  if (line.feeScheduleId && line.pricingMatchedBy) {
    return `${line.pricingMatchedBy} (${line.feeScheduleId})`
  }

  return line.feeScheduleId || line.pricingMatchedBy || 'Missing'
}

function getClaimDisplayId(claim: Claim) {
  return claim.claimId || claim._id
}

function getCoverageRuleStatus(line: ClaimClaimLine) {
  const snapshot = line.coverageRuleSnapshot as Record<string, unknown> | undefined
  const coverageRules = snapshot?.coverageRules as Record<string, unknown> | undefined
  const errors = Array.isArray(coverageRules?.errors) ? coverageRules.errors.filter(Boolean) : []
  const warnings = Array.isArray(coverageRules?.warnings) ? coverageRules.warnings.filter(Boolean) : []

  if (errors.length) {
    return `Blocked: ${errors.join(', ')}`
  }

  if (warnings.length) {
    return `Warning: ${warnings.join(', ')}`
  }

  if (coverageRules?.covered === false) {
    return 'Blocked: not covered'
  }

  return coverageRules ? 'Passed' : '-'
}

function buildEntityMap<T extends { _id: string }>(items?: T[]) {
  const map = new Map<string, T>()

  for (const item of items ?? []) {
    map.set(item._id, item)
  }

  return map
}

function StatusBadge({ label, tone }: { label: string; tone: 'success' | 'warning' | 'danger' | 'neutral' }) {
  const className = {
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    warning: 'border-amber-200 bg-amber-50 text-amber-700',
    danger: 'border-red-200 bg-red-50 text-red-700',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  }[tone]

  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${className}`}>{label}</span>
}

function getLifecycleTone(status?: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'REJECTED' || status === 'FAILED') {
    return 'danger'
  }

  if (status === 'PENDING') {
    return 'warning'
  }

  if (status === 'ACCEPTED' || status === 'READY') {
    return 'success'
  }

  return 'neutral'
}

function normalizeWorkflowStatus(value?: string | null) {
  return value?.trim().toUpperCase() ?? ''
}

function IssueList({ title, items, tone }: { title: string; items?: string[]; tone: 'danger' | 'warning' | 'neutral' }) {
  const normalizedItems = items?.filter(Boolean) ?? []
  const className = {
    danger: 'border-red-100 bg-red-50 text-red-800',
    warning: 'border-amber-100 bg-amber-50 text-amber-800',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-800',
  }[tone]

  return (
    <section className={`rounded-lg border p-4 ${className}`}>
      <h3 className="text-sm font-semibold">{title}</h3>
      {normalizedItems.length ? (
        <ul className="mt-3 space-y-2 text-sm">
          {normalizedItems.map((item) => (
            <li key={item} className="break-words">
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm opacity-80">None</p>
      )}
    </section>
  )
}

function DocumentRequirementList({ title, items, tone }: { title: string; items?: string[]; tone: 'danger' | 'success' | 'neutral' }) {
  const normalizedItems = items?.filter(Boolean) ?? []
  const chipClassName = {
    danger: 'border-red-200 bg-red-50 text-red-700',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    neutral: 'border-neutral-200 bg-neutral-50 text-neutral-700',
  }[tone]

  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{title}</p>
      {normalizedItems.length ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {normalizedItems.map((item) => (
            <span key={item} className={`inline-flex max-w-full rounded-full border px-2.5 py-1 text-xs font-semibold ${chipClassName}`}>
              {item}
            </span>
          ))}
        </div>
      ) : (
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">None</p>
      )}
    </div>
  )
}

function DocumentationCompliancePanel({ result }: { result?: ClaimReadinessResult['documentationCompliance'] }) {
  if (!result) {
    return null
  }

  const statusTone = result.status === 'FAIL' ? 'danger' : 'success'

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Documentation compliance</h3>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Required support documents are evaluated before claim submission.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <StatusBadge label={result.status} tone={statusTone} />
          <StatusBadge label={`Severity: ${result.severity}`} tone={statusTone} />
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <DocumentRequirementList title="Required documents" items={result.requiredDocuments} tone="neutral" />
        <DocumentRequirementList title="Missing documents" items={result.missingDocuments} tone="danger" />
        <DocumentRequirementList title="Matched documents" items={result.matchedDocuments} tone="success" />
      </div>
    </div>
  )
}

function HeaderFact({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
      <dt className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-[var(--color-text-strong)]">{value || '-'}</dd>
    </div>
  )
}

function ClaimLineTable({ claim }: { claim: Claim }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <h2 className="text-base font-semibold text-[var(--color-text-strong)]">Claim lines</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-[1240px] w-full text-left text-sm">
          <thead className="bg-[var(--color-surface-muted)] text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            <tr>
              <th className="px-4 py-3">CPT</th>
              <th className="px-4 py-3">POS</th>
              <th className="px-4 py-3">Modifiers</th>
              <th className="px-4 py-3 text-right">Units</th>
              <th className="px-4 py-3 text-right">Billed</th>
              <th className="px-4 py-3 text-right">Allowed</th>
              <th className="px-4 py-3 text-right">Patient</th>
              <th className="px-4 py-3 text-right">Insurance</th>
              <th className="px-4 py-3">Fee schedule</th>
              <th className="px-4 py-3">Eligibility</th>
              <th className="px-4 py-3">Coverage rules</th>
              <th className="px-4 py-3">Auth</th>
              <th className="px-4 py-3">Referral</th>
              <th className="px-4 py-3">Network</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border)]">
            {claim.claimLines.map((line, index) => (
              <tr key={line._id || line.chargeLineId || `${line.cptCode}-${index}`} className="align-top">
                <td className="px-4 py-3 font-semibold text-[var(--color-text-strong)]">{line.cptCode || '-'}</td>
                <td className="px-4 py-3">{line.placeOfService || '-'}</td>
                <td className="px-4 py-3">{formatList(line.modifiers)}</td>
                <td className="px-4 py-3 text-right">{line.units ?? '-'}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.chargeAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.expectedAllowedAmount)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.expectedPatientResponsibility)}</td>
                <td className="px-4 py-3 text-right">{formatCurrency(line.expectedInsurancePayment)}</td>
                <td className="max-w-[16rem] break-words px-4 py-3">{getFeeScheduleMatch(line)}</td>
                <td className="px-4 py-3">{getLineEligibilityStatus(line)}</td>
                <td className="max-w-[18rem] break-words px-4 py-3">{getCoverageRuleStatus(line)}</td>
                <td className="px-4 py-3">{[formatBoolean(line.authorizationRequired), line.priorAuthorizationId].filter(Boolean).join(' / ')}</td>
                <td className="px-4 py-3">{[formatBoolean(line.referralRequired), line.referralId].filter(Boolean).join(' / ')}</td>
                <td className="px-4 py-3">{line.networkStatus || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ReadinessPanel({ readiness, loading, error }: { readiness?: ClaimReadinessResult; loading: boolean; error?: string }) {
  const timelyFiling = readiness?.timelyFiling
  const documentationCompliance = readiness?.documentationCompliance

  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">Deterministic readiness</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Backend validation controls whether the claim can be submitted.</p>
        </div>
        {loading ? (
          <StatusBadge label="Checking" tone="neutral" />
        ) : readiness?.canSubmit ? (
          <StatusBadge label="Can submit" tone="success" />
        ) : (
          <StatusBadge label="Blocked" tone="danger" />
        )}
      </div>

      {error ? <Message severity="error" text={error} className="w-full justify-start" /> : null}

      {timelyFiling ? (
        <div className="grid gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3 text-sm md:grid-cols-4">
          <HeaderFact label="Filing status" value={timelyFiling.status} />
          <HeaderFact label="Days remaining" value={timelyFiling.daysRemaining} />
          <HeaderFact label="Filing deadline" value={formatDateTime(timelyFiling.filingDeadline)} />
          <HeaderFact label="Severity" value={timelyFiling.severity} />
        </div>
      ) : null}

      <DocumentationCompliancePanel result={documentationCompliance} />

      <div className="grid gap-4 lg:grid-cols-3">
        <IssueList title="Blocking errors" items={readiness?.errors} tone="danger" />
        <IssueList title="Warnings" items={readiness?.warnings} tone="warning" />
        <IssueList title="Required actions" items={readiness?.requiredActions} tone="neutral" />
      </div>
    </section>
  )
}

function AiReadinessPanel({ review, loading, error }: { review?: ClaimAiReadinessReviewResult; loading: boolean; error?: string }) {
  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">AI readiness review</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">AI explains readiness issues and denial risk, but does not override validation.</p>
        </div>
        <StatusBadge label={loading ? 'Reviewing' : `${review?.readinessScore ?? 0}/100`} tone={review && review.readinessScore >= 80 ? 'success' : 'warning'} />
      </div>

      {error ? <Message severity="error" text={error} className="w-full justify-start" /> : null}
      {review?.summary ? <p className="rounded-md border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-800">{review.summary}</p> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <IssueList title="Denial risks" items={review?.denialRisks} tone="warning" />
        <IssueList title="Recommended fixes" items={review?.recommendedFixes} tone="neutral" />
        <IssueList title="Missing data" items={review?.missingData} tone="danger" />
      </div>
    </section>
  )
}

function SubmissionStatusPanel({
  submitMessage,
  statusMessage,
}: {
  submitMessage?: { severity: 'success' | 'error'; text: string } | null
  statusMessage?: { severity: 'success' | 'error'; text: string } | null
}) {
  return (
    <section className="space-y-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-[var(--color-text-strong)]">Stedi test submission and tracking</h2>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">Submission and tracking results come from backend Stedi test-mode calls. Failures are shown as failures and do not count as success.</p>
      </div>
      {submitMessage ? <Message severity={submitMessage.severity} text={submitMessage.text} className="w-full justify-start" /> : null}
      {statusMessage ? <Message severity={statusMessage.severity} text={statusMessage.text} className="w-full justify-start" /> : null}
      {!submitMessage && !statusMessage ? <p className="text-sm text-[var(--color-text-muted)]">No submission or tracking response has been refreshed yet.</p> : null}
    </section>
  )
}

function ClaimTrackingTimeline({
  events,
  loading,
  onRefresh,
  refreshing,
}: {
  events: ClaimTracking[]
  loading: boolean
  onRefresh: () => void
  refreshing: boolean
}) {
  const sortedEvents = useMemo(
    () =>
      [...events].sort((left, right) => {
        const leftTime = new Date(left.timestamp ?? left.receivedDate ?? left.updatedAt).getTime()
        const rightTime = new Date(right.timestamp ?? right.receivedDate ?? right.updatedAt).getTime()
        return rightTime - leftTime
      }),
    [events],
  )
  const latestEvent = sortedEvents[0]
  const ack999 = sortedEvents.find((event) => event.responseType === 'ACK_999')
  const ack277 = sortedEvents.find((event) => event.responseType === 'ACK_277CA')

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">Claim status timeline</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">999, 277CA, and 276/277 status events. Payment posting is tracked separately from acknowledgement status.</p>
        </div>
        <Button type="button" label="Refresh Status" icon={<Activity className="h-4 w-4" />} outlined loading={refreshing} onClick={onRefresh} />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <HeaderFact label="Latest normalized status" value={latestEvent?.normalizedStatus ?? '-'} />
        <HeaderFact label="999 status" value={ack999 ? `${ack999.eventType ?? '-'} / ${ack999.normalizedStatus ?? '-'}` : '-'} />
        <HeaderFact label="277CA status" value={ack277 ? `${ack277.eventType ?? '-'} / ${ack277.normalizedStatus ?? '-'}` : '-'} />
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">Loading tracking timeline...</p>
      ) : sortedEvents.length ? (
        <div className="mt-4 space-y-3">
          {sortedEvents.map((event) => (
            <article key={event._id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-[var(--color-text-strong)]">{event.eventType ?? 'CLAIM_STATUS_UPDATED'}</p>
                    <StatusBadge label={event.normalizedStatus ?? event.statusCode ?? 'PENDING'} tone={getLifecycleTone(event.normalizedStatus ?? event.statusCode)} />
                    <StatusBadge label={event.trackingSource ?? 'REAL'} tone={event.trackingSource === 'SIMULATED' ? 'warning' : 'success'} />
                  </div>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{formatDateTime(event.timestamp ?? event.receivedDate)}</p>
                </div>
                <div className="text-right text-xs text-[var(--color-text-muted)]">
                  <div>{event.responseType ?? '-'}</div>
                  <div>{event.rawStatusCode ?? event.statusCode ?? '-'}</div>
                </div>
              </div>
              <p className="mt-3 text-sm text-[var(--color-text)]">{event.summary ?? event.statusDescription ?? '-'}</p>
              {(event.rejectionReasonCodes ?? []).length || event.rejectionLevel || event.rejectionSource ? (
                <p className="mt-2 text-sm font-medium text-red-700">
                  Rejection: {[event.rejectionLevel, event.rejectionSource, (event.rejectionReasonCodes ?? []).join(', ')].filter(Boolean).join(' / ')}
                </p>
              ) : null}
              <dl className="mt-3 grid gap-2 text-xs text-[var(--color-text-muted)] md:grid-cols-3">
                <div>External ID: <span className="font-semibold text-[var(--color-text)]">{event.externalSubmissionId ?? '-'}</span></div>
                <div>Control #: <span className="font-semibold text-[var(--color-text)]">{event.controlNumber ?? event.claimControlNumber ?? '-'}</span></div>
                <div>Payer claim #: <span className="font-semibold text-[var(--color-text)]">{event.payerClaimNumber ?? '-'}</span></div>
              </dl>
              {event.responsePayloadRedacted ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-semibold text-[var(--color-primary)]">View redacted response</summary>
                  <pre className="mt-2 max-h-48 overflow-auto rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3 text-xs text-[var(--color-text)]">
                    {event.responsePayloadRedacted}
                  </pre>
                </details>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-[var(--color-text-muted)]">No claim tracking events have been recorded yet.</p>
      )}
    </section>
  )
}

function DenialReworkPanel({ denials, loading }: { denials: Denial[]; loading: boolean }) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">Denial Rework</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">ERA-linked denial and rework status for this claim.</p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
          {loading ? 'Loading' : `${denials.length} denial${denials.length === 1 ? '' : 's'}`}
        </span>
      </div>
      {denials.length ? (
        <div className="mt-4 overflow-x-auto rounded-lg border border-[var(--color-border)]">
          <table className="w-full min-w-[920px] text-left text-sm">
            <thead className="bg-[var(--color-surface-muted)] text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
              <tr>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">CPT/CDT</th>
                <th className="px-4 py-3">CARC/RARC</th>
                <th className="px-4 py-3 text-right">Denied</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Next action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {denials.map((denial) => (
                <tr key={denial._id}>
                  <td className="px-4 py-3 font-semibold text-[var(--color-text-strong)]">{denial.denialCategory ?? '-'}</td>
                  <td className="px-4 py-3">{denial.cptCode ?? '-'}</td>
                  <td className="px-4 py-3">{[...(denial.carcCodes ?? []), ...(denial.rarcCodes ?? [])].join(', ') || denial.denialCode || '-'}</td>
                  <td className="px-4 py-3 text-right">{formatCurrency(denial.denialAmount)}</td>
                  <td className="px-4 py-3">{denial.denialStatus ?? '-'}</td>
                  <td className="px-4 py-3">{denial.owner ?? '-'}</td>
                  <td className="max-w-[26rem] px-4 py-3 text-xs text-[var(--color-text-muted)]">{denial.recommendedAction ?? denial.denialReason ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-dashed border-[var(--color-border)] px-4 py-6 text-sm text-[var(--color-text-muted)]">
          No ERA-linked denials have been created for this claim.
        </div>
      )}
    </section>
  )
}

function RecoveryLineagePanel({
  claim,
  correctedClaims,
  appeals,
  loading,
}: {
  claim: Claim;
  correctedClaims: CorrectedClaim[];
  appeals: Appeal[];
  loading: boolean;
}) {
  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">Recovery Lineage</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Original claim, corrected claim handoffs, and appeal records tied to this recovery path.</p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
          {loading ? 'Loading' : `${correctedClaims.length + appeals.length} recovery item${correctedClaims.length + appeals.length === 1 ? '' : 's'}`}
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Current Claim</p>
          <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{claim.claimId || claim._id}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            {[claim.correctionType, claim.frequencyCode ? `Freq ${claim.frequencyCode}` : undefined, claim.correctedFromClaimId ? 'corrected clone' : 'original/current'].filter(Boolean).join(' / ')}
          </p>
        </div>
        {correctedClaims.map((item) => (
          <div key={item._id} className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Corrected Claim</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{item.correctedClaimStatus ?? 'DRAFT'}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {[item.correctionType, item.frequencyCode ?? item.correctedFrequencyCode, item.clonedClaimId ? `Clone ${item.clonedClaimId.slice(-6)}` : undefined].filter(Boolean).join(' / ')}
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text)]">{item.correctionReason ?? item.resubmissionReason ?? '-'}</p>
          </div>
        ))}
        {appeals.map((item) => (
          <div key={item._id} className="rounded-lg border border-[var(--color-border)] p-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Appeal</p>
            <p className="mt-1 text-sm font-semibold text-[var(--color-text-strong)]">{item.appealStatus ?? 'DRAFT'}</p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {[item.appealCategory, item.appealLevel, item.dueDate ? `Due ${formatDateTime(item.dueDate)}` : undefined].filter(Boolean).join(' / ')}
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text)]">{item.payerResponse ?? item.resolution ?? item.appealReason ?? '-'}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AccountFollowUpPanel({
  arItems,
  patientBillings,
  loading,
}: {
  arItems: ArWorkItem[];
  patientBillings: PatientBilling[];
  loading: boolean;
}) {
  const patientBalance = patientBillings.reduce((total, item) => total + (item.currentBalance ?? item.amountDue ?? item.patientBalance ?? 0), 0)
  const arBalance = arItems.reduce((total, item) => total + (item.balanceAmount ?? 0), 0)

  return (
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">AR and Patient Ledger</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">Post-adjudication follow-up, finalized patient balances, and statement status.</p>
        </div>
        <span className="rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-text-muted)]">
          {loading ? 'Loading' : `${arItems.length} AR / ${patientBillings.length} bill`}
        </span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Open AR Balance</p>
          <p className="mt-1 text-xl font-semibold text-[var(--color-text-strong)]">{formatCurrency(arBalance)}</p>
          <div className="mt-3 space-y-2">
            {arItems.slice(0, 4).map((item) => (
              <div key={item._id} className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-xs">
                <p className="font-semibold text-[var(--color-text-strong)]">{[item.category, item.status, item.priority].filter(Boolean).join(' / ') || 'AR follow-up'}</p>
                <p className="mt-1 text-[var(--color-text-muted)]">{item.nextAction ?? item.reason ?? '-'}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-[var(--color-border)] p-3">
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Final Patient Balance</p>
          <p className="mt-1 text-xl font-semibold text-[var(--color-text-strong)]">{formatCurrency(patientBalance)}</p>
          <div className="mt-3 space-y-2">
            {patientBillings.slice(0, 4).map((item) => (
              <div key={item._id} className="rounded-md bg-[var(--color-surface-muted)] px-3 py-2 text-xs">
                <p className="font-semibold text-[var(--color-text-strong)]">{[item.statementNumber, item.status ?? item.statementStatus].filter(Boolean).join(' / ') || 'Patient statement'}</p>
                <p className="mt-1 text-[var(--color-text-muted)]">
                  {formatCurrency(item.currentBalance ?? item.amountDue ?? item.patientBalance)} due {item.dueDate ? `by ${formatDateTime(item.dueDate)}` : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function GateStatusPanel({
  title,
  required,
  valid,
  linkedId,
  errors,
  availableItems,
  buttonLabel,
  loading,
  onLink,
}: {
  title: string
  required?: boolean
  valid?: boolean
  linkedId?: string
  errors?: string[]
  availableItems: string[]
  buttonLabel: string
  loading: boolean
  onLink: () => void
}) {
  const tone = !required ? 'neutral' : valid ? 'success' : 'danger'
  const status = !required ? 'Not required' : valid ? 'Valid' : 'Blocked'

  return (
    <section className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-strong)]">{title}</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">{linkedId ? `Linked record: ${linkedId}` : 'Backend matching uses payer, policy, CPT, provider, facility, and service date.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge label={status} tone={tone} />
          <Button type="button" label={buttonLabel} icon={<Link2 className="h-4 w-4" />} outlined loading={loading} onClick={onLink} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <IssueList title="Validation errors" items={errors} tone={errors?.length ? 'danger' : 'neutral'} />
        <IssueList title="Available matching records" items={availableItems} tone="neutral" />
      </div>
    </section>
  )
}

export function ClaimReadinessPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const autoRunClaimIdRef = useRef<string | null>(null)
  const claimId = id
  const [submitMessage, setSubmitMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)
  const [statusMessage, setStatusMessage] = useState<{ severity: 'success' | 'error'; text: string } | null>(null)
  const claimQuery = useGetClaimQuery(claimId ?? '', { skip: !claimId })
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const priorAuthorizationsQuery = useGetPriorAuthorizationsQuery(lookupQuery)
  const referralsQuery = useGetReferralsQuery(lookupQuery)
  const trackingQuery = useGetClaimTrackingsQuery(
    {
      page: 1,
      limit: 50,
      sortfield: 'timestamp',
      direction: 'desc',
      criteria: claimId ? [{ key: 'claimId', value: claimId, type: 'equals' }] : [],
    },
    { skip: !claimId },
  )
  const denialsQuery = useGetDenialsQuery(
    {
      page: 1,
      limit: 25,
      sortfield: 'denialDate',
      direction: 'desc',
      criteria: claimId ? [{ key: 'claimId', value: claimId, type: 'equals' }] : [],
    },
    { skip: !claimId },
  )
  const correctedClaimsQuery = useGetCorrectedClaimsQuery(
    {
      page: 1,
      limit: 25,
      sortfield: 'updated',
      direction: 'desc',
      criteria: claimId ? [{ key: 'originalClaimId', value: claimId, type: 'equals' }] : [],
    },
    { skip: !claimId },
  )
  const appealsQuery = useGetAppealsQuery(
    {
      page: 1,
      limit: 25,
      sortfield: 'updated',
      direction: 'desc',
      criteria: claimId ? [{ key: 'claimId', value: claimId, type: 'equals' }] : [],
    },
    { skip: !claimId },
  )
  const arItemsQuery = useGetArWorkItemsQuery(
    {
      page: 1,
      limit: 25,
      sortfield: 'updated',
      direction: 'desc',
      criteria: claimId ? [{ key: 'claimId', value: claimId, type: 'equals' }] : [],
    },
    { skip: !claimId },
  )
  const patientBillingsQuery = useGetPatientBillingsQuery(
    {
      page: 1,
      limit: 25,
      sortfield: 'updated',
      direction: 'desc',
      criteria: claimId ? [{ key: 'claimId', value: claimId, type: 'equals' }] : [],
    },
    { skip: !claimId },
  )
  const [validateReadiness, readinessState] = useValidateClaimReadinessMutation()
  const [reviewWithAi, aiReviewState] = useReviewClaimReadinessWithAiMutation()
  const [runClaimEligibility, runEligibilityState] = useRunClaimEligibilityMutation()
  const [refreshClaimPricing, refreshPricingState] = useRefreshClaimPricingMutation()
  const [refreshClaimStatus, refreshStatusState] = useRefreshClaimStatusMutation()
  const [linkClaimAuthorization, linkAuthorizationState] = useLinkClaimAuthorizationMutation()
  const [linkClaimReferral, linkReferralState] = useLinkClaimReferralMutation()
  const [submitClaim, submitClaimState] = useSubmitClaimMutation()

  const patientById = useMemo(() => buildEntityMap(patientsQuery.data?.data), [patientsQuery.data])
  const payerById = useMemo(() => {
    const map = buildEntityMap(payersQuery.data?.data)

    for (const payer of payersQuery.data?.data ?? []) {
      if (payer.payerId) {
        map.set(payer.payerId, payer)
      }
    }

    return map
  }, [payersQuery.data])
  const providerById = useMemo(() => buildEntityMap(providersQuery.data?.data), [providersQuery.data])
  const facilityById = useMemo(() => buildEntityMap(facilitiesQuery.data?.data), [facilitiesQuery.data])

  const claim = claimQuery.data
  const patient = claim?.patientId ? patientById.get(claim.patientId) : undefined
  const payer = claim?.payerId ? payerById.get(claim.payerId) : undefined
  const billingProvider = claim?.billingProviderId ? providerById.get(claim.billingProviderId) : undefined
  const renderingProvider = claim?.renderingProviderId ? providerById.get(claim.renderingProviderId) : undefined
  const facility = claim?.facilityId ? facilityById.get(claim.facilityId) : undefined
  const readiness = readinessState.data
  const aiReview = aiReviewState.data
  const latestTracking = trackingQuery.data?.data?.[0]
  const latestDenial = denialsQuery.data?.data?.[0]
  const latestCorrectedClaim = correctedClaimsQuery.data?.data?.[0]
  const latestAppeal = appealsQuery.data?.data?.[0]
  const latestArItem = arItemsQuery.data?.data?.[0]
  const latestPatientBilling = patientBillingsQuery.data?.data?.[0]
  const readinessError = readinessState.error ? getApiErrorMessage(readinessState.error) : undefined
  const aiReviewError = aiReviewState.error ? getApiErrorMessage(aiReviewState.error) : undefined
  const submittedClaimStatuses = new Set(['SUBMITTED', 'ACCEPTED', 'PAID', 'CLOSED'])
  const submittedSubmissionStatuses = new Set(['SUBMITTED', 'TRANSMITTED', 'ACKNOWLEDGED', 'ACCEPTED', 'PENDING'])
  const hasSubmissionTracking = (trackingQuery.data?.data ?? []).some((event) =>
    event.claimSubmissionId || ['SUBMITTED', 'PENDING', 'ACCEPTED'].includes(normalizeWorkflowStatus(event.normalizedStatus)),
  )
  const isAlreadySubmitted = Boolean(
    claim &&
    (
      submittedClaimStatuses.has(normalizeWorkflowStatus(claim.claimStatus)) ||
      submittedSubmissionStatuses.has(normalizeWorkflowStatus(claim.submissionStatus)) ||
      hasSubmissionTracking
    ),
  )
  const canSubmit = Boolean(readiness?.canSubmit) && !isAlreadySubmitted
  const claimCptCodes = useMemo(
    () => new Set((claim?.claimLines ?? []).map((line) => line.cptCode?.toUpperCase()).filter((code): code is string => Boolean(code))),
    [claim?.claimLines],
  )
  const availableAuthorizations = useMemo(
    () =>
      (priorAuthorizationsQuery.data?.data ?? [])
        .filter((item) =>
          item.patientId === claim?.patientId &&
          item.payerId === claim?.payerId &&
          (item.procedureCodes ?? []).some((code) => claimCptCodes.has(code.toUpperCase())),
        )
        .map((item) => `${item.authNumber || item._id} | ${item.authorizationStatus ?? '-'} | ${(item.procedureCodes ?? []).join(', ') || '-'}`),
    [claim?.patientId, claim?.payerId, claimCptCodes, priorAuthorizationsQuery.data],
  )
  const availableReferrals = useMemo(
    () =>
      (referralsQuery.data?.data ?? [])
        .filter((item) =>
          item.patientId === claim?.patientId &&
          item.payerId === claim?.payerId &&
          (item.procedureCodes ?? []).some((code) => claimCptCodes.has(code.toUpperCase())),
        )
        .map((item) => `${item.referralNumber || item._id} | ${item.referralStatus ?? '-'} | ${(item.procedureCodes ?? []).join(', ') || '-'}`),
    [claim?.patientId, claim?.payerId, claimCptCodes, referralsQuery.data],
  )

  const runReadiness = useCallback(async () => {
    if (!claimId) {
      return
    }

    setSubmitMessage(null)
    setStatusMessage(null)
    await validateReadiness(claimId).unwrap()
  }, [claimId, validateReadiness])

  const runAiReview = useCallback(async () => {
    if (!claimId) {
      return
    }

    setSubmitMessage(null)
    setStatusMessage(null)
    await reviewWithAi(claimId).unwrap()
  }, [claimId, reviewWithAi])

  const handleRunEligibility = useCallback(async () => {
    if (!claimId) {
      return
    }

    setSubmitMessage(null)
    setStatusMessage(null)

    try {
      const result = await runClaimEligibility(claimId).unwrap()
      setSubmitMessage({
        severity: 'success',
        text: `Eligibility completed. Verification ${result.eligibilityVerification.externalVerificationId || result.eligibilityVerification._id} was attached to matching claim lines.`,
      })
      void claimQuery.refetch()
      await validateReadiness(claimId).unwrap()
    } catch (error) {
      setSubmitMessage({
        severity: 'error',
        text: getApiErrorMessage(error),
      })
    }
  }, [claimId, claimQuery, runClaimEligibility, validateReadiness])

  const handleRefreshPricing = useCallback(async () => {
    if (!claimId) {
      return
    }

    setSubmitMessage(null)
    setStatusMessage(null)

    try {
      const result = await refreshClaimPricing(claimId).unwrap()
      const matchedCount = result.pricingResults.filter((item) => item.matched).length
      const missingCount = result.pricingResults.length - matchedCount
      setSubmitMessage({
        severity: missingCount ? 'error' : 'success',
        text: missingCount
          ? `Pricing refreshed. ${matchedCount} line(s) matched and ${missingCount} line(s) still need fee schedules.`
          : `Pricing refreshed. ${matchedCount} claim line(s) now have contract rate snapshots.`,
      })
      void claimQuery.refetch()
      await validateReadiness(claimId).unwrap()
    } catch (error) {
      setSubmitMessage({
        severity: 'error',
        text: getApiErrorMessage(error),
      })
    }
  }, [claimId, claimQuery, refreshClaimPricing, validateReadiness])

  const handleLinkAuthorization = useCallback(async () => {
    if (!claimId) {
      return
    }

    setSubmitMessage(null)

    try {
      const result = await linkClaimAuthorization({ id: claimId }).unwrap()
      setSubmitMessage({
        severity: 'success',
        text: `Authorization ${result.authorizationId ?? 'record'} linked to matching claim lines.`,
      })
      void claimQuery.refetch()
      await validateReadiness(claimId).unwrap()
    } catch (error) {
      setSubmitMessage({
        severity: 'error',
        text: getApiErrorMessage(error),
      })
    }
  }, [claimId, claimQuery, linkClaimAuthorization, validateReadiness])

  const handleLinkReferral = useCallback(async () => {
    if (!claimId) {
      return
    }

    setSubmitMessage(null)

    try {
      const result = await linkClaimReferral({ id: claimId }).unwrap()
      setSubmitMessage({
        severity: 'success',
        text: `Referral ${result.referralId ?? 'record'} linked to matching claim lines.`,
      })
      void claimQuery.refetch()
      await validateReadiness(claimId).unwrap()
    } catch (error) {
      setSubmitMessage({
        severity: 'error',
        text: getApiErrorMessage(error),
      })
    }
  }, [claimId, claimQuery, linkClaimReferral, validateReadiness])

  useEffect(() => {
    if (!claimId || autoRunClaimIdRef.current === claimId) {
      return
    }

    autoRunClaimIdRef.current = claimId
    void validateReadiness(claimId)
    void reviewWithAi(claimId)
  }, [claimId, reviewWithAi, validateReadiness])

  const handleSubmit = useCallback(async () => {
    if (!claimId || !canSubmit) {
      return
    }

    setSubmitMessage(null)
    setStatusMessage(null)

    try {
      const result = await submitClaim(claimId).unwrap()
      const rejected = result.claim.claimStatus === 'Rejected' || result.claim.submissionStatus === 'Rejected'
      setSubmitMessage({
        severity: rejected ? 'error' : 'success',
        text: rejected
          ? `Claim rejected. ${result.claim.rejectionReason ?? 'Review rejection details before resubmission.'}`
          : `Claim submitted. Submission ${result.claimSubmission.submissionId || result.claimSubmission._id}; status ${result.trackingStatus || result.claimSubmission.transmissionStatus || '-'}.`,
      })
      void claimQuery.refetch()
      void trackingQuery.refetch()
      void validateReadiness(claimId)
      if (rejected) {
        navigate(`/rcm/claims/rejected/${claimId}`)
      } else {
        navigate(
          `/rcm/claim-submissions${buildWorkflowSearch(
            mergeWorkflowContext(workflowContext, {
              claimId,
              claimSubmissionId: result.claimSubmissionId ?? result.claimSubmission._id,
              returnTo: `${location.pathname}${location.search}`,
              returnLabel: 'Back to Claim Readiness',
            }),
          )}`,
        )
      }
    } catch (error) {
      setSubmitMessage({
        severity: 'error',
        text: getApiErrorMessage(error),
      })
    }
  }, [canSubmit, claimId, claimQuery, location.pathname, location.search, navigate, submitClaim, trackingQuery, validateReadiness, workflowContext])

  const handleRefreshTracking = useCallback(async () => {
    if (!claimId) {
      return
    }

    setStatusMessage(null)

    try {
      const result = await refreshClaimStatus(claimId).unwrap()
      setStatusMessage({
        severity: 'success',
        text: `Claim tracking refreshed. Status ${result.trackingStatus || result.claimSubmission.transmissionStatus || '-'}; external ID ${result.externalSubmissionId || '-'}.`,
      })
      void claimQuery.refetch()
      void trackingQuery.refetch()
    } catch (error) {
      setStatusMessage({
        severity: 'error',
        text: getApiErrorMessage(error),
      })
    }
  }, [claimId, claimQuery, refreshClaimStatus, trackingQuery])

  const goBackToClaim = () => {
    navigate(
      `/rcm/claims${buildWorkflowSearch(
        mergeWorkflowContext(workflowContext, {
          claimId,
          dashboardQueue: undefined,
          dashboardEntityId: undefined,
          returnTo: undefined,
          returnLabel: undefined,
        }),
      )}`,
    )
  }

  if (!claimId) {
    return (
      <div className="p-6">
        <Message severity="error" text="Claim ID is required." className="w-full justify-start" />
      </div>
    )
  }

  if (claimQuery.isLoading) {
    return <div className="p-6 text-sm text-[var(--color-text-muted)]">Loading claim readiness...</div>
  }

  if (claimQuery.error || !claim) {
    return (
      <div className="p-6">
        <Message severity="error" text={claimQuery.error ? getApiErrorMessage(claimQuery.error) : 'Claim was not found.'} className="w-full justify-start" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <WorkflowReturnButton context={workflowContext} />
        <WorkflowProgressTracker
          currentStage="claimReadiness"
          context={mergeWorkflowContext(workflowContext, {
            claimId,
            claimStatus: claim.claimStatus,
            submissionStatus: claim.submissionStatus,
            paymentStatus: claim.paymentStatus,
            closureStatus: claim.closureStatus,
          })}
        />
      </div>

      <RcmClaimLifecycleTimeline
        currentStage="claimReadiness"
        patientLabel={patient ? `${patient.firstName} ${patient.lastName}` : undefined}
        claimLabel={getClaimDisplayId(claim)}
        context={mergeWorkflowContext(workflowContext, {
          claimId,
          claimStatus: claim.claimStatus,
          submissionStatus: claim.submissionStatus,
          paymentStatus: claim.paymentStatus,
          closureStatus: claim.closureStatus,
          claimTrackingId: latestTracking?._id,
          denialId: latestDenial?._id,
          correctedClaimId: latestCorrectedClaim?._id,
          appealId: latestAppeal?._id,
          arWorkItemId: latestArItem?._id,
          patientBillingId: latestPatientBilling?._id,
        })}
        statuses={{
          claim: claim.claimStatus,
          claimReadiness: readiness?.canSubmit,
          claimSubmission: claim.submissionStatus,
          claimTracking: latestTracking?.normalizedStatus,
          paymentPosting: claim.paymentStatus,
          denial: latestDenial?.denialStatus,
          appeal: latestAppeal?.appealStatus,
          correctedClaim: latestCorrectedClaim?.correctedClaimStatus,
          arWorkItem: latestArItem?.status,
          patientBilling: latestPatientBilling?.status ?? latestPatientBilling?.statementStatus,
          closed: claim.closureStatus === 'CLOSED' ? 'CLOSED' : undefined,
        }}
        nextAction={
          isAlreadySubmitted
            ? 'Continue from submission, tracking, ERA, denial, AR, or patient-billing work queues.'
            : canSubmit
              ? 'Submit the claim.'
              : 'Resolve readiness blockers before submission.'
        }
      />

      <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Pre-submission claim workflow</p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">{getClaimDisplayId(claim)}</h1>
              <ScreenHelpButton
                help={{
                  title: 'Claim Readiness',
                  intro: 'Validate the claim before transmission, resolve blockers, and submit only when the readiness checks pass.',
                  steps: [
                    {
                      label: 'Re-run readiness',
                      icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
                      description: 'Click Re-run readiness to refresh deterministic validation for claim lines, payer, provider, facility, authorization, referral, and pricing.',
                    },
                    {
                      label: 'Run AI review',
                      icon: <Bot className="h-4 w-4" aria-hidden="true" />,
                      description: 'Click Run AI review to get guidance on missing data, denial risk, and recommended fixes before submission.',
                    },
                    {
                      label: 'Run eligibility and refresh pricing',
                      icon: <ShieldAlert className="h-4 w-4" aria-hidden="true" />,
                      description: 'Use Run eligibility and Refresh pricing when readiness shows coverage, fee schedule, or payer-rule gaps.',
                    },
                    {
                      label: 'Submit claim',
                      icon: <Send className="h-4 w-4" aria-hidden="true" />,
                      description: 'Click Submit claim when the readiness result allows submission. The workflow moves to Claim Submissions.',
                    },
                  ],
                }}
              />
            </div>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">Review deterministic readiness, AI guidance, and claim-line financial snapshots before submission.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" label="Back to claim detail" icon={<ArrowLeft className="h-4 w-4" />} outlined onClick={goBackToClaim} />
            <Button type="button" label="Re-run readiness" icon={<RefreshCw className="h-4 w-4" />} outlined loading={readinessState.isLoading} onClick={() => void runReadiness()} />
            <Button type="button" label="Refresh pricing" icon={<RefreshCw className="h-4 w-4" />} outlined loading={refreshPricingState.isLoading} onClick={() => void handleRefreshPricing()} />
            <Button type="button" label="Run eligibility" icon={<ShieldAlert className="h-4 w-4" />} outlined loading={runEligibilityState.isLoading} onClick={() => void handleRunEligibility()} />
            <Button type="button" label="Refresh tracking" icon={<Activity className="h-4 w-4" />} outlined loading={refreshStatusState.isLoading} onClick={() => void handleRefreshTracking()} />
            <Button type="button" label="Run AI review" icon={<Bot className="h-4 w-4" />} outlined loading={aiReviewState.isLoading} onClick={() => void runAiReview()} />
            <Button
              type="button"
              label="Submit claim"
              icon={<Send className="h-4 w-4" />}
              disabled={!canSubmit || submitClaimState.isLoading}
              loading={submitClaimState.isLoading}
              onClick={() => void handleSubmit()}
            />
          </div>
        </div>

        <dl className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <HeaderFact label="Patient" value={patient ? `${patient.firstName} ${patient.lastName} (${patient.medicalRecordNumber})` : claim.patientId} />
          <HeaderFact label="Payer" value={payer ? `${payer.payerName || payer.payerId || payer._id}${payer.ediPayerId ? ` / EDI ${payer.ediPayerId}` : ''}` : claim.payerId} />
          <HeaderFact label="Billing provider" value={billingProvider ? [billingProvider.firstName, billingProvider.lastName, billingProvider.credentials].filter(Boolean).join(' ') : claim.billingProviderId} />
          <HeaderFact label="Rendering provider" value={renderingProvider ? [renderingProvider.firstName, renderingProvider.lastName, renderingProvider.credentials].filter(Boolean).join(' ') : claim.renderingProviderId} />
          <HeaderFact label="Facility" value={facility ? `${facility.facilityName || facility.facilityCode || facility._id}${facility.state ? `, ${facility.state}` : ''}` : claim.facilityId} />
          <HeaderFact label="Claim type" value={claim.claimType} />
          <HeaderFact label="Claim status" value={claim.claimStatus} />
          <HeaderFact label="Submission status" value={claim.submissionStatus} />
          <HeaderFact label="Payment status" value={claim.paymentStatus} />
          <HeaderFact label="Total billed" value={formatCurrency(claim.totalChargeAmount)} />
        </dl>

        {claim.snapshotStatus === 'STALE' || claim.snapshotIssues?.length ? (
          <Message
            severity="error"
            text={`Claim snapshot is outdated. ${(claim.snapshotIssues ?? ['Regenerate or correct the claim from the current approved coding review before submission.']).join(' ')}`}
            className="mt-4 w-full justify-start"
          />
        ) : null}
      </section>

      <ClaimComplianceCheckpoint
        claimId={claimId}
        timelyFiling={readiness?.timelyFiling}
        documentationCompliance={readiness?.documentationCompliance}
      />
      <SubmissionStatusPanel submitMessage={submitMessage} statusMessage={statusMessage} />
      <ClaimTrackingTimeline
        events={trackingQuery.data?.data ?? []}
        loading={trackingQuery.isLoading || trackingQuery.isFetching}
        refreshing={refreshStatusState.isLoading}
        onRefresh={() => void handleRefreshTracking()}
      />
      <DenialReworkPanel denials={denialsQuery.data?.data ?? []} loading={denialsQuery.isLoading || denialsQuery.isFetching} />
      <RecoveryLineagePanel
        claim={claim}
        correctedClaims={correctedClaimsQuery.data?.data ?? []}
        appeals={appealsQuery.data?.data ?? []}
        loading={correctedClaimsQuery.isLoading || correctedClaimsQuery.isFetching || appealsQuery.isLoading || appealsQuery.isFetching}
      />
      <AccountFollowUpPanel
        arItems={arItemsQuery.data?.data ?? []}
        patientBillings={patientBillingsQuery.data?.data ?? []}
        loading={arItemsQuery.isLoading || arItemsQuery.isFetching || patientBillingsQuery.isLoading || patientBillingsQuery.isFetching}
      />
      <ClaimLineTable claim={claim} />
      <ReadinessPanel readiness={readiness} loading={readinessState.isLoading} error={readinessError} />
      <div className="grid gap-6 xl:grid-cols-2">
        <GateStatusPanel
          title="Authorization Status"
          required={readiness?.authorizationRequired}
          valid={readiness?.authorizationValid}
          linkedId={readiness?.authorizationId}
          errors={readiness?.authorizationErrors}
          availableItems={availableAuthorizations}
          buttonLabel="Link Authorization"
          loading={linkAuthorizationState.isLoading}
          onLink={() => void handleLinkAuthorization()}
        />
        <GateStatusPanel
          title="Referral Status"
          required={readiness?.referralRequired}
          valid={readiness?.referralValid}
          linkedId={readiness?.referralId}
          errors={readiness?.referralErrors}
          availableItems={availableReferrals}
          buttonLabel="Link Referral"
          loading={linkReferralState.isLoading}
          onLink={() => void handleLinkReferral()}
        />
      </div>
      <AiReadinessPanel review={aiReview} loading={aiReviewState.isLoading} error={aiReviewError} />

      {isAlreadySubmitted ? (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          This claim already has a submission/tracking record. Continue from Claim Submission, Claim Tracking, ERA, or AR work queues instead of submitting again.
        </div>
      ) : !canSubmit ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm font-medium text-amber-800">
          <ShieldAlert className="h-4 w-4 shrink-0" />
          Submit remains disabled until the backend readiness API returns canSubmit=true.
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Backend readiness passed. The final submit action will still be validated by the server.
        </div>
      )}
    </div>
  )
}
