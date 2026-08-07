import { AlertTriangle, Check, ClipboardCheck, Navigation, PencilLine, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { AiScrubberInsights } from '@/components/rcm/AiScrubberInsights'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createCodingReviewFormConfig, createCodingReviewTableColumns, getCodingReviewRowLabel, mapCodingReviewFormToPayload, mapCodingReviewToFormValues, renderCodingReviewGridItem } from '@/models/codingReviewModel'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useApproveCodingReviewMutation, useGetCodingReviewQuery, useGetCodingReviewsQuery } from '@/services/api/endpoints/codingReviewsApi'
import { useGetClaimPredictionsQuery, usePredictForChargeMutation } from '@/services/api/endpoints/claimPredictionsApi'
import { useGetChargesQuery, useGetChargeQuery } from '@/services/api/endpoints/chargesApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useGetEncountersQuery } from '@/services/api/endpoints/encountersApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import type { EntityId } from '@/types/common'
import type { CrudTableAction } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { WorkflowFeedback } from '@/types/rcmWorkflow'
import type { Charge, ChargeChargeLine } from '@/types/charge'
import type { ClaimPrediction } from '@/types/claimPrediction'
import type { CodingReview, CodingReviewCreatePayload, CodingReviewFormValues, CodingReviewUpdatePayload } from '@/types/codingReview'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'

type BulkDeletePayload = {
  ids: EntityId[]
}

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

function canApproveForClaim(item: CodingReview) {
  return item.scrubStatus === 'Passed' &&
    !item.missingDocumentationFlag &&
    !item.icdCptMismatchFlag &&
    !item.ncciEditFlag &&
    !item.lcdNcdEditFlag &&
    !(item.validationErrors ?? []).length &&
    !(item.modifierIssues ?? []).length &&
    !(item.payerSpecificRuleFailures ?? []).length
}

function canCorrectCodingReview(item: CodingReview) {
  return item.scrubStatus !== 'Approved' &&
    !canApproveForClaim(item) &&
    (
      item.scrubStatus === 'Failed' ||
      item.missingDocumentationFlag ||
      item.icdCptMismatchFlag ||
      item.ncciEditFlag ||
      item.lcdNcdEditFlag ||
      Boolean((item.validationErrors ?? []).length) ||
      Boolean((item.modifierIssues ?? []).length) ||
      Boolean((item.payerSpecificRuleFailures ?? []).length)
    )
}

type CodingFailureIssue = {
  id: string
  lineNumber?: number
  field: string
  title: string
  explanation: string
  correction: string
  source: string
}

function buildCodingFailureIssues(review: CodingReview): CodingFailureIssue[] {
  return (review.codingFailureExplanations ?? []).map((issue, index) => ({
    id: `ai-${index}-${issue.lineNumber ?? 'global'}`,
    ...issue,
  }))
}

function getLineNumberFromFinding(value: string) {
  const match = value.match(/(?:charge|claim)?\s*line\s+(\d+)/i)
  return match ? Number(match[1]) : undefined
}

function lineHasIssue(line: ChargeChargeLine, index: number, issues: CodingFailureIssue[], rawFindings: string[]) {
  const lineNumber = line.lineNumber ?? index + 1
  return issues.some((issue) => issue.lineNumber === lineNumber) ||
    rawFindings.some((finding) => getLineNumberFromFinding(finding) === lineNumber)
}

function CodingFailureDetails({ review, charge }: { review: CodingReview; charge?: Charge }) {
  const issues = buildCodingFailureIssues(review)
  const rawFindings = [
    ...(review.validationErrors ?? []),
    ...(review.modifierIssues ?? []),
    ...(review.payerSpecificRuleFailures ?? []),
  ]

  if (!issues.length && !rawFindings.length) {
    return null
  }

  const lineIssues = issues.filter((issue) => issue.lineNumber)
  const globalIssues = issues.filter((issue) => !issue.lineNumber)

  return (
    <div className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]/10 p-5 shadow-sm">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-base font-bold text-[var(--color-text-strong)]">Why this coding review failed</h4>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              The findings below translate scrub errors into coder actions and highlight the affected line.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-danger-text)]">
          {issues.length ? `${issues.length} correction${issues.length === 1 ? '' : 's'}` : 'AI explanation pending'}
        </span>
      </div>

      {charge?.chargeLines?.length ? (
        <div className="mb-4 grid gap-3">
          {charge.chargeLines.map((line, index) => {
            const lineNumber = line.lineNumber ?? index + 1
            const highlighted = lineHasIssue(line, index, issues, rawFindings)

            return (
              <div
                key={`${lineNumber}-${line.cptCode ?? 'empty'}`}
                className={`rounded-md border p-3 ${
                  highlighted
                    ? 'border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]/20'
                    : 'border-[var(--color-border)] bg-[var(--color-surface)]'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                      highlighted
                        ? 'bg-[var(--color-danger-soft)] text-[var(--color-danger-text)]'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                    }`}>
                      Line {lineNumber}
                    </span>
                    <span className="text-sm font-bold text-[var(--color-text-strong)]">
                      {line.cptCode || 'Missing procedure'}
                    </span>
                  </div>
                  {highlighted ? (
                    <span className="text-xs font-semibold text-[var(--color-danger-text)]">Needs correction</span>
                  ) : (
                    <span className="text-xs font-semibold text-[var(--color-success-text)]">No line-level issue</span>
                  )}
                </div>

                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-4">
                  <div>
                    <dt className="font-semibold uppercase text-[var(--color-text-muted)]">ICD</dt>
                    <dd className="mt-0.5 font-medium text-[var(--color-text-strong)]">
                      {(line.icdCodes ?? []).join(', ') || 'Missing'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase text-[var(--color-text-muted)]">Pointers</dt>
                    <dd className="mt-0.5 font-medium text-[var(--color-text-strong)]">
                      {(line.icdPointers ?? []).join(', ') || 'Missing'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase text-[var(--color-text-muted)]">Units</dt>
                    <dd className="mt-0.5 font-medium text-[var(--color-text-strong)]">
                      {typeof line.units === 'number' ? line.units : 'Missing'}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold uppercase text-[var(--color-text-muted)]">Amount</dt>
                    <dd className="mt-0.5 font-medium text-[var(--color-text-strong)]">
                      {typeof line.chargeAmount === 'number' ? `$${line.chargeAmount.toFixed(2)}` : 'Missing'}
                    </dd>
                  </div>
                </dl>
              </div>
            )
          })}
        </div>
      ) : null}

      {issues.length ? (
        <div className="grid gap-3">
          {lineIssues.map((issue) => (
            <FailureIssueCard key={issue.id} issue={issue} />
          ))}
          {globalIssues.map((issue) => (
            <FailureIssueCard key={issue.id} issue={issue} />
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h5 className="text-sm font-bold text-[var(--color-text-strong)]">AI explanation is not available yet</h5>
          <p className="mt-1 text-xs leading-relaxed text-[var(--color-text-muted)]">
            The coding review has scrub findings, but the Agentic explanation has not been saved on this review yet.
          </p>
          <div className="mt-3 space-y-2">
            {rawFindings.map((finding, index) => (
              <div key={`${finding}-${index}`} className="rounded-md border border-[var(--color-danger-border)] bg-[var(--color-danger-soft)]/10 px-3 py-2 text-xs font-medium text-[var(--color-danger-text)]">
                {finding}
              </div>
            ))}
          </div>
        </div>
      )}

      {review.aiSuggestedFixes?.length ? (
        <div className="mt-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
          <div className="mb-2 flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-[var(--color-primary)]" />
            <h5 className="text-sm font-bold text-[var(--color-text-strong)]">AI correction notes</h5>
          </div>
          <ul className="space-y-1">
            {review.aiSuggestedFixes.map((fix, index) => (
              <li key={`${fix}-${index}`} className="text-xs font-medium text-[var(--color-text)]">
                {fix}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function FailureIssueCard({ issue }: { issue: CodingFailureIssue }) {
  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        {issue.lineNumber ? (
          <span className="rounded-full bg-[var(--color-danger-soft)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-danger-text)]">
            Line {issue.lineNumber}
          </span>
        ) : null}
        <span className="rounded-full bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-bold uppercase text-[var(--color-text-muted)]">
          {issue.field}
        </span>
      </div>
      <h5 className="mt-2 text-sm font-bold text-[var(--color-text-strong)]">{issue.title}</h5>
      <p className="mt-1 text-xs leading-relaxed text-[var(--color-text)]">{issue.explanation}</p>
      <div className="mt-3 rounded-md border border-[var(--color-primary-soft)] bg-[var(--color-primary-soft)]/10 p-3">
        <p className="text-[11px] font-bold uppercase text-[var(--color-primary)]">What to correct</p>
        <p className="mt-1 text-xs font-medium leading-relaxed text-[var(--color-text-strong)]">{issue.correction}</p>
      </div>
      <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">Original scrub finding: {issue.source}</p>
    </div>
  )
}

function getCodingReviewSeverity(item: CodingReview): RcmSummarySeverity {
  if (canApproveForClaim(item) || item.scrubStatus === 'Approved') {
    return 'success'
  }

  if (item.scrubStatus === 'Failed' || (item.validationErrors ?? []).length) {
    return 'danger'
  }

  return 'warning'
}

function getPredictionLineKey(prediction: ClaimPrediction) {
  return [
    prediction.chargeId ?? prediction.claimId ?? prediction.encounterId ?? 'prediction',
    prediction.lineNumber ?? 'line',
    prediction.cptCode,
  ].join(':')
}

function uniqueLatestPredictions(predictions: ClaimPrediction[] = []) {
  const predictionMap = new Map<string, ClaimPrediction>()

  for (const prediction of predictions) {
    const key = getPredictionLineKey(prediction)

    if (!predictionMap.has(key)) {
      predictionMap.set(key, prediction)
    }
  }

  return Array.from(predictionMap.values())
}

export function CodingReviewsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null)
  const [approveCodingReview, approveCodingReviewState] = useApproveCodingReviewMutation()
  const [predictForCharge, predictForChargeState] = usePredictForChargeMutation()
  const chargesQuery = useGetChargesQuery(lookupQuery)
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const encountersQuery = useGetEncountersQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)

  const chargesOptions = useMemo(
    () =>
      (chargesQuery.data?.data ?? []).map((item) => ({
        label: [item.serviceDate, item.chargeStatus].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [chargesQuery.data],
  )
  const encountersOptions = useMemo(
    () =>
      (encountersQuery.data?.data ?? []).map((item) => ({
        label: [item.encounterDate, item.visitStatus].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [encountersQuery.data],
  )
  const patientsOptions = useMemo(
    () =>
      (patientsQuery.data?.data ?? []).map((item) => ({
        label: `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        value: item._id,
      })),
    [patientsQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      charges: chargesOptions,
      encounters: encountersOptions,
      patients: patientsOptions,
    }),
    [chargesOptions, encountersOptions, patientsOptions],
  )
  const claimIdByChargeId = useMemo(() => {
    const claimMap = new Map<string, string>()

    for (const claim of claimsQuery.data?.data ?? []) {
      if (!claim.chargeId) {
        continue
      }

      const currentClaimId = claimMap.get(claim.chargeId)

      if (!currentClaimId) {
        claimMap.set(claim.chargeId, claim._id)
      }
    }

    return claimMap
  }, [claimsQuery.data])
  const returnTo = `${location.pathname}${location.search}`

  const crudConfig: CrudPageConfig<
    CodingReview,
    CodingReviewFormValues,
    CodingReviewCreatePayload,
    CodingReviewUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Coding Reviews',
      resourceName: 'Coding Review',
      help: {
        title: 'Coding Reviews',
        intro: 'Validate the AI-assisted coding output and approve clean reviews so the claim can be created.',
        steps: [
          {
            label: 'Open review details',
            icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
            description: 'Review the coding status, coding notes, charge lines, diagnosis/procedure codes, and any AI scrubber insights.',
          },
          {
            label: 'Predict Reimbursement',
            icon: <Wand2 className="h-4 w-4" aria-hidden="true" />,
            description: 'Optionally click Predict Reimbursement to estimate payer reimbursement before approval.',
          },
          {
            label: 'Approve for Claim',
            icon: <Check className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Approve for Claim when coding is ready. The approved review creates or opens the claim for readiness checks.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Coding Review',
      createDialogTitle: 'Add coding review',
      editDialogTitle: 'Edit coding review',
      viewDialogTitle: 'Coding Review details',
      deleteDialogTitle: 'Delete coding review?',
      emptyMessage: 'No coding reviews found.',
      exportFileName: 'coding-reviews',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('codingReview', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'coding-reviews',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getCodingReviewRowLabel(item, referenceOptions),
      table: {
        columns: createCodingReviewTableColumns(referenceOptions),
      },
      form: createCodingReviewFormConfig(referenceOptions),
      api: {
        useListQuery: useGetCodingReviewsQuery,
      },
      mapItemToFormValues: mapCodingReviewToFormValues,
      mapFormValuesToCreatePayload: mapCodingReviewFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapCodingReviewFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="codingReview" context={workflowContext} />
            {workflowFeedback ? (
              <Message severity={workflowFeedback.severity} text={workflowFeedback.text} className="w-full justify-start" />
            ) : null}
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const linkedClaimId = item.chargeId ? claimIdByChargeId.get(item.chargeId) : undefined
          const workflowActions: Array<CrudTableAction<CodingReview>> = [
            {
              label: 'Predict Reimbursement',
              icon: <Wand2 className="h-4 w-4" aria-hidden="true" />,
              loading: predictForChargeState.isLoading,
              onClick: async (codingReview) => {
                setWorkflowFeedback(null)

                if (!codingReview.chargeId) {
                  setWorkflowFeedback({
                    severity: 'warn',
                    text: 'No linked charge found for this review.',
                  })
                  return
                }

                try {
                  const predictions = await predictForCharge(codingReview.chargeId).unwrap()
                  setWorkflowFeedback({
                    severity: 'success',
                    text: `${predictions.length} reimbursement prediction${predictions.length === 1 ? '' : 's'} generated successfully.`,
                  })
                } catch (error) {
                  setWorkflowFeedback({
                    severity: 'error',
                    text: getApiErrorMessage(error),
                  })
                }
              },
            }
          ]

          if (linkedClaimId) {
            workflowActions.push({
              label: 'Go to Claim',
              icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
              onClick: (codingReview) => {
                navigate(
                  `/rcm/claims${buildWorkflowSearch(
                    mergeWorkflowContext(workflowContext, {
                      chargeId: codingReview.chargeId ?? workflowContext.chargeId,
                      encounterId: codingReview.encounterId ?? workflowContext.encounterId,
                      codingReviewId: codingReview._id,
                      claimId: linkedClaimId,
                      returnTo,
                      returnLabel: 'Back to Coding Reviews',
                    }),
                  )}`,
                )
              },
            })
          } else {
            if (item.chargeId && canCorrectCodingReview(item)) {
              workflowActions.push({
                label: 'Correct Charge',
                icon: <PencilLine className="h-4 w-4" aria-hidden="true" />,
                onClick: (codingReview) => {
                  navigate(
                    `/rcm/charges${buildWorkflowSearch(
                      mergeWorkflowContext(workflowContext, {
                        chargeId: codingReview.chargeId ?? workflowContext.chargeId,
                        encounterId: codingReview.encounterId ?? workflowContext.encounterId,
                        codingReviewId: codingReview._id,
                        returnTo,
                        returnLabel: 'Back to Coding Reviews',
                      }),
                    )}`,
                  )
                },
              })
            }

            if (item.scrubStatus !== 'Approved') {
              workflowActions.push({
                label: 'Approve for Claim',
                icon: <Check className="h-4 w-4" aria-hidden="true" />,
                disabled: !canApproveForClaim(item) || approveCodingReviewState.isLoading,
                loading: approveCodingReviewState.isLoading,
                onClick: async (codingReview) => {
                  setWorkflowFeedback(null)

                  try {
                    const result = await approveCodingReview(codingReview._id).unwrap()

                    if (!result.claim) {
                      setWorkflowFeedback({
                        severity: 'success',
                        text: 'Coding review approved. This item was routed outside claim submission.',
                      })
                      return
                    }

                    navigate(
                      `/rcm/claims${buildWorkflowSearch(
                        mergeWorkflowContext(workflowContext, {
                          chargeId: codingReview.chargeId ?? workflowContext.chargeId,
                          encounterId: codingReview.encounterId ?? workflowContext.encounterId,
                          codingReviewId: result.codingReview._id,
                          claimId: result.claim._id,
                          returnTo,
                          returnLabel: 'Back to Coding Reviews',
                        }),
                      )}`,
                    )
                  } catch (error) {
                    setWorkflowFeedback({
                      severity: 'error',
                      text: getApiErrorMessage(error),
                    })
                  }
                },
              })
            }
          }

          return [...workflowActions, ...defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View '))]
        },
        viewContent: (item) => {
          const linkedClaimId = item.chargeId ? claimIdByChargeId.get(item.chargeId) : undefined
          const issueCount =
            (item.validationErrors ?? []).length +
            (item.modifierIssues ?? []).length +
            (item.payerSpecificRuleFailures ?? []).length +
            (item.missingDocumentationFlag ? 1 : 0) +
            (item.icdCptMismatchFlag ? 1 : 0) +
            (item.ncciEditFlag ? 1 : 0) +
            (item.lcdNcdEditFlag ? 1 : 0)

          return (
            <div className="space-y-5">
              <RcmViewSummary
                title="AI coding review workflow"
                subtitle="Explains what the coding AI found and whether this charge can become a claim."
                status={linkedClaimId ? 'Claim created' : item.scrubStatus ?? '-'}
                severity={linkedClaimId ? 'success' : getCodingReviewSeverity(item)}
                facts={[
                  ['Charge', referenceOptions.charges?.find((option) => option.value === item.chargeId)?.label ?? item.chargeId ?? '-'],
                  ['Risk', item.codingRiskLevel ?? '-'],
                  ['Findings', issueCount ? `${issueCount} issue${issueCount === 1 ? '' : 's'}` : 'No blocking issue'],
                  ['Authority', item.approvedCodingSnapshot?.lines?.length ? 'Approved coding snapshot' : 'Pending approval'],
                ]}
                journey={[
                  {
                    label: 'AI scrub',
                    status: item.scrubStatus ?? '-',
                    detail: 'Review scrub status, documentation support, and payer coding edits.',
                    severity: getCodingReviewSeverity(item),
                  },
                  {
                    label: 'Coding risks',
                    status: issueCount ? 'Review needed' : 'Clean',
                    detail: issueCount ? 'Review validation errors, documentation gaps, edits, and payer rules.' : 'No blocking coding risks were found.',
                    severity: issueCount ? 'danger' : 'success',
                  },
                  {
                    label: 'Claim handoff',
                    status: linkedClaimId ? 'Created' : canApproveForClaim(item) ? 'Ready' : 'Blocked',
                    detail: linkedClaimId ? 'Claim is ready for pre-submission review.' : 'Approve for Claim creates the claim when the review passes.',
                    severity: linkedClaimId ? 'success' : canApproveForClaim(item) ? 'warning' : 'danger',
                  },
                  {
                    label: 'Next action',
                    status: linkedClaimId ? 'Open claim' : canApproveForClaim(item) ? 'Approve' : 'Correct charge',
                    detail: linkedClaimId ? 'Continue scrub and submission from Claims.' : canApproveForClaim(item) ? 'Use approve to assemble the claim.' : 'Return to charge or encounter correction before resubmitting.',
                    severity: linkedClaimId || canApproveForClaim(item) ? 'warning' : 'danger',
                  },
                ]}
                alerts={[
                  ...(item.validationErrors ?? []).map((error) => ({ title: 'Validation error', detail: error, severity: 'danger' as const })),
                ]}
                actions={[
                  ...(linkedClaimId
                    ? [
                      {
                        label: 'Open Claim',
                        helper: 'Go to the claim created from this coding review.',
                        icon: <Navigation className="h-3.5 w-3.5" />,
                        onClick: () => {
                          navigate(
                            `/rcm/claims${buildWorkflowSearch(
                              mergeWorkflowContext(workflowContext, {
                                chargeId: item.chargeId ?? workflowContext.chargeId,
                                encounterId: item.encounterId ?? workflowContext.encounterId,
                                codingReviewId: item._id,
                                claimId: linkedClaimId,
                                returnTo,
                                returnLabel: 'Back to Coding Reviews',
                              }),
                            )}`,
                          )
                        },
                      },
                    ]
                    : item.chargeId && canCorrectCodingReview(item)
                      ? [
                        {
                          label: 'Correct Charge',
                          helper: 'Open the linked charge, correct the line coding, then re-run coding review.',
                          icon: <PencilLine className="h-3.5 w-3.5" />,
                          onClick: () => {
                            navigate(
                              `/rcm/charges${buildWorkflowSearch(
                                mergeWorkflowContext(workflowContext, {
                                  chargeId: item.chargeId ?? workflowContext.chargeId,
                                  encounterId: item.encounterId ?? workflowContext.encounterId,
                                  codingReviewId: item._id,
                                  returnTo,
                                  returnLabel: 'Back to Coding Reviews',
                                }),
                              )}`,
                            )
                          },
                        },
                      ]
                      : []),
                  ...(!linkedClaimId && item.scrubStatus !== 'Approved'
                    ? [
                      {
                        label: 'Approve for Claim',
                        helper: canApproveForClaim(item) ? 'Create a claim from this passed coding review.' : 'Resolve coding review findings before claim creation.',
                        icon: <Check className="h-3.5 w-3.5" />,
                        disabled: !canApproveForClaim(item) || approveCodingReviewState.isLoading,
                        onClick: async () => {
                          setWorkflowFeedback(null)
                          try {
                            const result = await approveCodingReview(item._id).unwrap()
                            if (result.claim) {
                              navigate(
                                `/rcm/claims${buildWorkflowSearch(
                                  mergeWorkflowContext(workflowContext, {
                                    chargeId: item.chargeId ?? workflowContext.chargeId,
                                    encounterId: item.encounterId ?? workflowContext.encounterId,
                                    codingReviewId: result.codingReview._id,
                                    claimId: result.claim._id,
                                    returnTo,
                                    returnLabel: 'Back to Coding Reviews',
                                  }),
                                )}`,
                              )
                            }
                          } catch (error) {
                            setWorkflowFeedback({
                              severity: 'error',
                              text: getApiErrorMessage(error),
                            })
                          }
                        },
                      },
                    ]
                    : []),
                  ...(item.chargeId
                    ? [
                      {
                        label: 'Predict Reimbursement',
                        helper: 'Refresh line-level expected allowed, paid, patient responsibility, and risk estimates.',
                        icon: <Wand2 className="h-3.5 w-3.5" />,
                        disabled: predictForChargeState.isLoading,
                        onClick: async () => {
                          setWorkflowFeedback(null)
                          try {
                            const predictions = await predictForCharge(item.chargeId as string).unwrap()
                            setWorkflowFeedback({
                              severity: 'success',
                              text: `${predictions.length} reimbursement prediction${predictions.length === 1 ? '' : 's'} generated successfully.`,
                            })
                          } catch (error) {
                            setWorkflowFeedback({
                              severity: 'error',
                              text: getApiErrorMessage(error),
                            })
                          }
                        },
                      },
                    ]
                    : []),
                ]}
              />
              {item.approvedCodingSnapshot?.lines?.length ? (
                <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
                  <div className="mb-3">
                    <h3 className="text-sm font-semibold text-[var(--color-text-strong)]">Approved final coding snapshot</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Claim creation uses these approved CPT/CDT, modifiers, ICD pointers, POS, units, and rendering-provider values.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="text-[var(--color-text-muted)]">
                        <tr>
                          <th className="px-3 py-2">Line</th>
                          <th className="px-3 py-2">CPT/CDT</th>
                          <th className="px-3 py-2">Modifiers</th>
                          <th className="px-3 py-2">ICD Pointers</th>
                          <th className="px-3 py-2">Units</th>
                          <th className="px-3 py-2">POS</th>
                          <th className="px-3 py-2">Billed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.approvedCodingSnapshot.lines.map((line, index) => (
                          <tr key={`${line.chargeLineId ?? index}`} className="border-t border-[var(--color-border)]">
                            <td className="px-3 py-2">{line.lineNumber ?? index + 1}</td>
                            <td className="px-3 py-2 font-semibold text-[var(--color-text-strong)]">{line.cptCode ?? '-'}</td>
                            <td className="px-3 py-2">{line.modifiers?.join(', ') || '-'}</td>
                            <td className="px-3 py-2">{line.icdPointers?.join(', ') || '-'}</td>
                            <td className="px-3 py-2">{line.units ?? '-'}</td>
                            <td className="px-3 py-2">{line.placeOfService ?? '-'}</td>
                            <td className="px-3 py-2">{typeof line.chargeAmount === 'number' ? `$${line.chargeAmount.toFixed(2)}` : '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
              <CodingReviewInsightsWrapper review={item} />
            </div>
          )
        },
        gridItem: (item) => renderCodingReviewGridItem(item, referenceOptions),
      },
    }),
    [
      approveCodingReview,
      approveCodingReviewState.isLoading,
      claimIdByChargeId,
      navigate,
      referenceOptions,
      returnTo,
      workflowContext,
      workflowFeedback,
      predictForCharge,
      predictForChargeState.isLoading,
    ],
  )

  return <CrudPage key={workflowKey || 'coding-reviews'} config={crudConfig} />
}

function CodingReviewInsightsWrapper({ review }: { review: CodingReview }) {
  const needsExplanationRefresh =
    !review.codingFailureExplanations?.length &&
    Boolean(
      (review.validationErrors ?? []).length ||
      (review.modifierIssues ?? []).length ||
      (review.payerSpecificRuleFailures ?? []).length,
    )
  const { data: refreshedReview } = useGetCodingReviewQuery(review._id, {
    pollingInterval: needsExplanationRefresh ? 3000 : 0,
  })
  const activeReview = refreshedReview ?? review
  const { data: charge } = useGetChargeQuery(activeReview.chargeId || '', { skip: !activeReview.chargeId });

  const { data: predictionsData } = useGetClaimPredictionsQuery({
    page: 1,
    limit: 10,
    sortfield: 'created',
    direction: 'desc',
    criteria: [
      { key: 'chargeId', value: activeReview.chargeId || '', type: 'equals' }
    ]
  }, { skip: !activeReview.chargeId });

  const predictions = uniqueLatestPredictions(predictionsData?.data || []);

  return (
    <div className="space-y-5">
      <CodingFailureDetails review={activeReview} charge={charge} />
      <AiScrubberInsights review={activeReview} predictions={predictions} />
    </div>
  );
}
