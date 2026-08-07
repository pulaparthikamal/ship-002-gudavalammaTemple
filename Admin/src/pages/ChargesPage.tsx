import { ArrowRight, FileText, Navigation } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { AiScrubberInsights } from '@/components/rcm/AiScrubberInsights'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createChargeFormConfig, createChargeTableColumns, getChargeRowLabel, mapChargeFormToPayload, mapChargeToFormValues, renderChargeDetails, renderChargeGridItem } from '@/models/chargeModel'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetCodingReviewsQuery } from '@/services/api/endpoints/codingReviewsApi'
import { useGetChargeMastersQuery } from '@/services/api/endpoints/chargeMastersApi'
import { useGetClaimsQuery } from '@/services/api/endpoints/claimsApi'
import { useCreateChargeFromEncounterMutation, useCreateChargeMutation, useGetChargesQuery, useSubmitChargeForReviewMutation, useUpdateChargeMutation } from '@/services/api/endpoints/chargesApi'
import { useGetEncountersQuery } from '@/services/api/endpoints/encountersApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { CrudTableAction } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { WorkflowFeedback } from '@/types/rcmWorkflow'
import type { Charge, ChargeCreatePayload, ChargeFormValues, ChargeUpdatePayload } from '@/types/charge'
import type { CodingReview } from '@/types/codingReview'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

const chargeMasterLookupQuery = {
  ...lookupQuery,
  limit: 1000,
  sortfield: 'cptCode',
  direction: 'asc' as const,
}

function hasValidChargeLine(item: Charge['chargeLines'][number]) {
  return Boolean(item.cptCode?.trim()) &&
    (item.icdCodes ?? []).some((code) => Boolean(code?.trim())) &&
    (item.icdPointers ?? []).length > 0 &&
    typeof item.units === 'number' &&
    item.units > 0 &&
    typeof item.chargeAmount === 'number' &&
    item.chargeAmount > 0 &&
    Boolean(item.renderingProviderId?.trim())
}

function canSubmitForCodingReview(item: Charge) {
  return item.chargeStatus !== 'Approved' &&
    item.codingReviewStatus !== 'Approved for Claim' &&
    Boolean(item.serviceDate) &&
    Boolean(item.placeOfService?.trim()) &&
    item.chargeLines.length > 0 &&
    item.chargeLines.every(hasValidChargeLine)
}

function canEditCharge(item: Charge, linkedCodingReviewId?: string) {
  return (!linkedCodingReviewId || item.codingReviewStatus === 'Failed') &&
    item.chargeStatus !== 'Approved' &&
    item.codingReviewStatus !== 'Approved for Claim'
}

function getChargeStatusSeverity(item: Charge, linkedCodingReviewId?: string): RcmSummarySeverity {
  if (linkedCodingReviewId || item.codingReviewStatus === 'Approved for Claim' || item.chargeStatus === 'Approved') {
    return 'success'
  }

  if ((item.validationErrors ?? []).length || item.codingReviewStatus === 'Failed') {
    return 'danger'
  }

  if (canSubmitForCodingReview(item)) {
    return 'warning'
  }

  return 'neutral'
}

export function ChargesPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null)
  const [analysisReview, setAnalysisReview] = useState<CodingReview | null>(null)
  const [showAnalysis, setShowAnalysis] = useState(false)
  const [createChargeFromEncounter, createChargeFromEncounterState] = useCreateChargeFromEncounterMutation()
  const [submitChargeForReview, submitChargeForReviewState] = useSubmitChargeForReviewMutation()
  const codingReviewsQuery = useGetCodingReviewsQuery(lookupQuery)
  const chargeMastersQuery = useGetChargeMastersQuery(chargeMasterLookupQuery)
  const claimsQuery = useGetClaimsQuery(lookupQuery)
  const encountersQuery = useGetEncountersQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)

  const encountersOptions = useMemo(
    () =>
      (encountersQuery.data?.data ?? []).map((item) => ({
        label: [item.encounterDate, item.visitStatus].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [encountersQuery.data],
  )
  const facilitiesOptions = useMemo(
    () =>
      (facilitiesQuery.data?.data ?? []).map((item) => ({
        label: item.facilityName || item.facilityCode || item._id,
        value: item._id,
      })),
    [facilitiesQuery.data],
  )
  const patientsOptions = useMemo(
    () =>
      (patientsQuery.data?.data ?? []).map((item) => ({
        label: `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        value: item._id,
      })),
    [patientsQuery.data],
  )
  const providersOptions = useMemo(
    () =>
      (providersQuery.data?.data ?? []).map((item) => ({
        label: [item.firstName, item.lastName, item.credentials].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [providersQuery.data],
  )
  const chargeMasterCodeOptions = useMemo(
    () => {
      const optionMap = new Map<string, { label: string; value: string }>()

      for (const item of chargeMastersQuery.data?.data ?? []) {
        if (!item.cptCode) {
          continue
        }

        optionMap.set(item.cptCode, {
          label: [item.cptCode, item.description].filter(Boolean).join(' - '),
          value: item.cptCode,
        })
      }

      return Array.from(optionMap.values()).sort((left, right) => left.value.localeCompare(right.value))
    },
    [chargeMastersQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      encounters: encountersOptions,
      facilities: facilitiesOptions,
      patients: patientsOptions,
      providers: providersOptions,
      chargeMasterCodes: chargeMasterCodeOptions,
    }),
    [chargeMasterCodeOptions, encountersOptions, facilitiesOptions, patientsOptions, providersOptions],
  )
  const codingReviewIdByChargeId = useMemo(() => {
    const reviewMap = new Map<string, string>()

    for (const review of codingReviewsQuery.data?.data ?? []) {
      if (!review.chargeId) {
        continue
      }

      const currentReviewId = reviewMap.get(review.chargeId)

      if (!currentReviewId) {
        reviewMap.set(review.chargeId, review._id)
      }
    }

    return reviewMap
  }, [codingReviewsQuery.data])
  const claimIdByChargeId = useMemo(() => {
    const claimMap = new Map<string, string>()

    for (const claim of claimsQuery.data?.data ?? []) {
      if (!claim.chargeId || claimMap.has(claim.chargeId)) {
        continue
      }

      claimMap.set(claim.chargeId, claim._id)
    }

    return claimMap
  }, [claimsQuery.data])
  const returnTo = `${location.pathname}${location.search}`

  const handleAiAnalysis = useCallback(
    async (charge: Charge) => {
      if (!canSubmitForCodingReview(charge)) {
        setWorkflowFeedback({
          severity: 'warn',
          text: 'Complete valid CPT/CDT, diagnosis linkage, units, ChargeMaster amount, and rendering provider before AI coding verification.',
        })
        return
      }

      setWorkflowFeedback({
        severity: 'warn',
        text: 'AI Verification in progress... Please wait.',
      })

      try {
        const result = await submitChargeForReview(charge._id).unwrap()
        setAnalysisReview(result.codingReview)
        setShowAnalysis(true)
        setWorkflowFeedback(null)
      } catch (error) {
        setWorkflowFeedback({
          severity: 'error',
          text: getApiErrorMessage(error),
        })
      }
    },
    [submitChargeForReview],
  )

  const crudConfig: CrudPageConfig<
    Charge,
    ChargeFormValues,
    ChargeCreatePayload,
    ChargeUpdatePayload,
    unknown
  > = useMemo(
    () => ({
      title: 'Charges',
      resourceName: 'Charge',
      help: {
        title: 'Charges',
        intro: 'Review the charge produced from the completed encounter and submit it for coding validation.',
        steps: [
          {
            label: 'Review charge details',
            icon: <FileText className="h-4 w-4" aria-hidden="true" />,
            description: 'Open the charge details and confirm the patient, encounter, service date, charge lines, CPT codes, modifiers, and billed totals.',
          },
          {
            label: 'Submit for Coding Review',
            icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Submit for Coding Review on the charge row. The system creates a coding review and routes you to Coding Reviews.',
          },
          {
            label: 'Go to Coding Review',
            icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
            description: 'Use Go to Coding Review when a review already exists and continue approval from that screen.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Charge',
      createDialogTitle: 'Add charge',
      editDialogTitle: 'Edit charge',
      viewDialogTitle: 'Charge details',
      deleteDialogTitle: 'Delete charge?',
      emptyMessage: 'No charges found.',
      exportFileName: 'charges',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'serviceDate',
        direction: 'desc',
        criteria: buildWorkflowCriteria('charge', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'charges',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getChargeRowLabel(item, referenceOptions),
      table: {
        columns: createChargeTableColumns(referenceOptions, handleAiAnalysis),
      },
      form: createChargeFormConfig(referenceOptions),
      api: {
        useListQuery: useGetChargesQuery,
        useCreateMutation: useCreateChargeMutation,
        useUpdateMutation: useUpdateChargeMutation,
      },
      mapItemToFormValues: mapChargeToFormValues,
      mapFormValuesToCreatePayload: mapChargeFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapChargeFormToPayload(values),
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="charge" context={workflowContext} />
            {workflowFeedback ? (
              <Message severity={workflowFeedback.severity} text={workflowFeedback.text} className="w-full justify-start" />
            ) : null}
          </div>
        ),
        toolbarRight: () => (
          <div className="flex items-center gap-2">
            {workflowContext.encounterId && !workflowContext.chargeId ? (
              <Button
                type="button"
                label="Generate Charge"
                icon={<FileText className="h-3.5 w-3.5" />}
                className="h-8 px-3 text-xs font-semibold"
                loading={createChargeFromEncounterState.isLoading}
                disabled={createChargeFromEncounterState.isLoading}
                onClick={async () => {
                  setWorkflowFeedback(null)

                  try {
                    const charge = await createChargeFromEncounter(workflowContext.encounterId as string).unwrap()
                    navigate(
                      `/rcm/charges${buildWorkflowSearch(
                        mergeWorkflowContext(workflowContext, {
                          chargeId: charge._id,
                          encounterId: charge.encounterId ?? workflowContext.encounterId,
                          returnTo,
                          returnLabel: 'Back to Charges',
                        }),
                      )}`,
                    )
                  } catch (error) {
                    setWorkflowFeedback({
                      severity: 'error',
                      text: getApiErrorMessage(error),
                    })
                  }
                }}
              />
            ) : null}
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const linkedCodingReviewId = codingReviewIdByChargeId.get(item._id)
          const linkedClaimId = claimIdByChargeId.get(item._id)
          const safeDefaultActions = defaultActions.filter((action) => {
            const label = typeof action.label === 'string' ? action.label.toLowerCase() : ''

            if (label.includes('edit') && (!canEditCharge(item, linkedCodingReviewId) || linkedClaimId)) {
              return false
            }

            return true
          })
          const submitAction: CrudTableAction<Charge> = {
            label: linkedCodingReviewId ? 'Re-run Coding Review' : 'Submit for Coding Review',
            icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
            disabled: !canSubmitForCodingReview(item) || submitChargeForReviewState.isLoading,
            loading: submitChargeForReviewState.isLoading,
            onClick: async (charge) => {
              setWorkflowFeedback(null)

              try {
                const result = await submitChargeForReview(charge._id).unwrap()
                navigate(
                  `/rcm/coding-reviews${buildWorkflowSearch(
                    mergeWorkflowContext(workflowContext, {
                      encounterId: charge.encounterId ?? workflowContext.encounterId,
                      chargeId: result.charge._id,
                      codingReviewId: result.codingReview._id,
                      returnTo,
                      returnLabel: 'Back to Charges',
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
          }
          const workflowActions: Array<CrudTableAction<Charge>> = [
            submitAction,
            ...(linkedCodingReviewId
              ? [
                {
                  label: 'Go to Coding Review',
                  icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
                    onClick: (charge: Charge) => {
                      navigate(
                        `/rcm/coding-reviews${buildWorkflowSearch(
                          mergeWorkflowContext(workflowContext, {
                            encounterId: charge.encounterId ?? workflowContext.encounterId,
                            chargeId: charge._id,
                            codingReviewId: linkedCodingReviewId,
                            returnTo,
                            returnLabel: 'Back to Charges',
                          }),
                        )}`,
                      )
                    },
                  },
                ]
              : []),
          ]

          return [...workflowActions, ...safeDefaultActions]
        },
        viewContent: (item) => {
          const linkedCodingReviewId = codingReviewIdByChargeId.get(item._id)
          const linkedClaimId = claimIdByChargeId.get(item._id)
          const invalidLines = item.chargeLines.filter((line) => !hasValidChargeLine(line)).length

          return (
            <div className="space-y-5">
              <RcmViewSummary
                title="Charge capture workflow"
                subtitle="Checks charge completeness before AI coding review and claim creation."
                status={linkedClaimId ? 'Locked - claim created' : linkedCodingReviewId ? 'Coding review created' : item.chargeStatus ?? '-'}
                severity={getChargeStatusSeverity(item, linkedCodingReviewId)}
                facts={[
                  ['Encounter', referenceOptions.encounters?.find((option) => option.value === item.encounterId)?.label ?? item.encounterId ?? '-'],
                  ['Charge lines', `${item.chargeLines.length}`],
                  ['Total charge', typeof item.totalChargeAmount === 'number' ? `$${item.totalChargeAmount.toFixed(2)}` : '-'],
                  ['Pricing source', 'ChargeMaster billed; Fee Schedule expected allowed after claim pricing'],
                  ['Lock state', linkedClaimId || item.codingReviewStatus === 'Approved for Claim' ? 'Locked' : 'Editable before approval'],
                ]}
                journey={[
                  {
                    label: 'Charge',
                    status: item.chargeStatus ?? '-',
                    detail: item.documentationComplete ? 'Documentation marked complete.' : 'Documentation is incomplete.',
                    severity: item.documentationComplete ? 'success' : 'danger',
                  },
                  {
                    label: 'Line validation',
                    status: invalidLines ? `${invalidLines} issue${invalidLines === 1 ? '' : 's'}` : 'Passed',
                    detail: invalidLines ? 'Resolve incomplete or unsupported charge lines before coding review.' : 'Charge lines are structurally ready.',
                    severity: invalidLines ? 'danger' : 'success',
                  },
                  {
                    label: 'AI coding',
                    status: linkedCodingReviewId ? 'Created' : canSubmitForCodingReview(item) ? 'Ready' : 'Waiting',
                    detail: linkedCodingReviewId ? 'Review AI coding findings before claim creation.' : 'Submit for coding review to capture any blocking code issues.',
                    severity: linkedCodingReviewId ? 'success' : canSubmitForCodingReview(item) ? 'warning' : 'neutral',
                  },
                  {
                    label: 'Next handoff',
                    status: linkedCodingReviewId ? 'Coding review' : 'Submit review',
                    detail: linkedCodingReviewId ? 'Approve passed reviews to create a claim.' : 'AI review detects coding and documentation risks.',
                    severity: linkedCodingReviewId ? 'warning' : canSubmitForCodingReview(item) ? 'warning' : 'danger',
                  },
                ]}
                alerts={[
                  ...(linkedClaimId || item.codingReviewStatus === 'Approved for Claim'
                    ? [{
                        title: 'Charge lines locked',
                        detail: 'Approved coding or claim creation has locked CPT/CDT, modifiers, ICD pointers, units, and billed amounts.',
                        severity: 'warning' as const,
                      }]
                    : []),
                  ...(item.validationErrors ?? []).map((error) => ({ title: 'Charge validation issue', detail: error, severity: 'danger' as const })),
                ]}
                actions={linkedCodingReviewId ? [
                  {
                    label: 'Open Coding Review',
                    helper: 'Review AI coding findings for this charge.',
                    onClick: () => {
                      navigate(
                        `/rcm/coding-reviews${buildWorkflowSearch(
                          mergeWorkflowContext(workflowContext, {
                            encounterId: item.encounterId ?? workflowContext.encounterId,
                            chargeId: item._id,
                            codingReviewId: linkedCodingReviewId,
                            returnTo,
                            returnLabel: 'Back to Charges',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []}
              />
              {renderChargeDetails(item, referenceOptions)}
            </div>
          )
        },
        gridItem: (item) => renderChargeGridItem(item, referenceOptions),
      },
    }),
    [
      codingReviewIdByChargeId,
      claimIdByChargeId,
      createChargeFromEncounter,
      createChargeFromEncounterState.isLoading,
      navigate,
      referenceOptions,
      returnTo,
      submitChargeForReviewState.isLoading,
      workflowContext,
      workflowFeedback,
      handleAiAnalysis,
    ],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'charges'} config={crudConfig} />
      <Dialog
        header="AI Coding Analysis & Verification"
        visible={showAnalysis}
        onHide={() => setShowAnalysis(false)}
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="crud-view-dialog"
        maskClassName="crud-form-dialog-mask"
        style={{ width: 'min(96vw, 64rem)' }}
      >
        {analysisReview ? <AiScrubberInsights review={analysisReview} /> : null}
      </Dialog>
    </>
  )
}
