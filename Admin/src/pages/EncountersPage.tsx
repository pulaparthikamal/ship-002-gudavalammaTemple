import { Check, Navigation, PencilLine, Play, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { WorkflowReturnButton } from '@/components/rcm/WorkflowReturnButton'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createEncounterFormConfig, createEncounterTableColumns, DEFAULT_EDIT_CLINICAL_NOTES, formatDate, getEncounterRowLabel, mapEncounterFormToPayload, mapEncounterToFormValues, parseStringList, renderEncounterDetails, renderEncounterGridItem } from '@/models/encounterModel'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetChargesQuery } from '@/services/api/endpoints/chargesApi'
import {
  useCompleteEncounterMutation,
  useCreateEncounterMutation,
  useGetEncountersQuery,
  useSuggestEncounterAiCodesMutation,
  useUpdateEncounterMutation,
} from '@/services/api/endpoints/encountersApi'
import { useGetAppointmentsQuery } from '@/services/api/endpoints/appointmentsApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { CrudFormField, CrudTableAction } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { WorkflowFeedback } from '@/types/rcmWorkflow'
import type { Encounter, EncounterCreatePayload, EncounterFormValues, EncounterUpdatePayload } from '@/types/encounter'
import { buildWorkflowCriteria, buildWorkflowSearch, mergeWorkflowContext, readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

const appointmentLookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'appointmentStart',
  direction: 'asc' as const,
  criteria: [],
}

function canStartEncounter(item: Encounter) {
  return ['Created', 'Patient Arrived', 'In Progress'].includes(item.visitStatus ?? '')
}

function canCompleteEncounter(item: Encounter) {
  const hasClinicalNotes = Boolean(item.clinicalNotes?.trim())
  const hasDiagnosisCodes = (item.diagnosisCodes ?? []).some((code) => Boolean(code?.trim()))
  const hasProcedureCodes = (item.procedureCodes ?? []).some((code) => Boolean(code?.trim()))
  const hasEndTime = Boolean(item.endTime)

  return item.visitStatus !== 'Completed' && hasClinicalNotes && hasDiagnosisCodes && hasProcedureCodes && hasEndTime
}

function canEditEncounter(item: Encounter, linkedChargeId?: string) {
  return !linkedChargeId && !['Completed', 'Checked Out', 'Ready for Charge Capture'].includes(item.visitStatus ?? '')
}

function getEncounterStatusSeverity(item: Encounter, linkedChargeId?: string): RcmSummarySeverity {
  if (linkedChargeId || ['Completed', 'Checked Out', 'Ready for Charge Capture'].includes(item.visitStatus ?? '')) {
    return 'success'
  }

  if (canCompleteEncounter(item)) {
    return 'warning'
  }

  return 'neutral'
}

function normalizeCodeValue(value?: string) {
  return value?.trim().toUpperCase() ?? ''
}

function uniqueCodeValues(values: string[] = []) {
  const seenCodes = new Set<string>()
  const uniqueValues: string[] = []

  for (const value of values) {
    const normalizedValue = normalizeCodeValue(value)

    if (!normalizedValue || seenCodes.has(normalizedValue)) {
      continue
    }

    seenCodes.add(normalizedValue)
    uniqueValues.push(normalizedValue)
  }

  return uniqueValues
}

function normalizeProcedureCodeUnits(value?: Record<string, number>) {
  if (!value) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([code, units]) => [normalizeCodeValue(code), units] as const)
      .filter(([code, units]) => code && Number.isFinite(units) && units > 0),
  )
}

function mergeProcedureCodeUnits(
  existingUnits: Record<string, number> | undefined,
  procedureSuggestions: Array<{ code: string; units?: number }>,
  mergedProcedureCodes: string[],
) {
  const mergedUnits = {
    ...normalizeProcedureCodeUnits(existingUnits),
  }

  for (const suggestion of procedureSuggestions) {
    const normalizedCode = normalizeCodeValue(suggestion.code)

    if (!normalizedCode || !mergedProcedureCodes.includes(normalizedCode)) {
      continue
    }

    mergedUnits[normalizedCode] = typeof suggestion.units === 'number' && suggestion.units > 0 ? suggestion.units : 1
  }

  return Object.fromEntries(
    Object.entries(mergedUnits)
      .filter(([code, units]) => mergedProcedureCodes.includes(code) && Number.isFinite(units) && units > 0),
  )
}

function formatCodeField(values: string[]) {
  return values.join('\n')
}

function buildEncounterPayloadWithProcedureUnits(values: EncounterFormValues, item: Encounter) {
  const payload = mapEncounterFormToPayload(values)
  const procedureCodes = payload.procedureCodes ?? parseStringList(values.procedureCodes) ?? []
  const procedureCodeSet = new Set(procedureCodes.map((code) => normalizeCodeValue(code)))
  const savedProcedureCodeUnits = {
    ...normalizeProcedureCodeUnits(item.procedureCodeUnits),
    ...normalizeProcedureCodeUnits(values.procedureCodeUnits),
  }
  const procedureCodeUnits = Object.fromEntries(
    Object.entries(savedProcedureCodeUnits)
      .filter(([code]) => procedureCodeSet.has(code)),
  )

  return {
    ...payload,
    procedureCodeUnits: Object.keys(procedureCodeUnits).length ? procedureCodeUnits : undefined,
  }
}

export function EncountersPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null)
  const [completeEncounter, completeEncounterState] = useCompleteEncounterMutation()
  const [suggestEncounterAiCodes, suggestEncounterAiCodesState] = useSuggestEncounterAiCodesMutation()
  const appointmentsQuery = useGetAppointmentsQuery(appointmentLookupQuery)
  const chargesQuery = useGetChargesQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)

  const patientLabelsById = useMemo(
    () =>
      new Map(
        (patientsQuery.data?.data ?? []).map((item) => [
          item._id,
          `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        ]),
      ),
    [patientsQuery.data],
  )

  const providerLabelsById = useMemo(
    () =>
      new Map(
        (providersQuery.data?.data ?? []).map((item) => [
          item._id,
          [item.firstName, item.lastName, item.credentials].filter(Boolean).join(' ') || item._id,
        ]),
      ),
    [providersQuery.data],
  )

  const appointmentsOptions = useMemo(
    () =>
      (appointmentsQuery.data?.data ?? []).map((item) => ({
        label:
          [
            patientLabelsById.get(item.patientId ?? ''),
            formatDate(item.appointmentDate),
            item.appointmentTime,
            providerLabelsById.get(item.providerId ?? ''),
            item.appointmentStatus,
          ]
            .filter(Boolean)
            .join(' / ') || item._id,
        value: item._id,
      })),
    [appointmentsQuery.data, patientLabelsById, providerLabelsById],
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

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      appointments: appointmentsOptions,
      facilities: facilitiesOptions,
      patients: patientsOptions,
      providers: providersOptions,
    }),
    [appointmentsOptions, facilitiesOptions, patientsOptions, providersOptions],
  )
  const chargeIdByEncounterId = useMemo(() => {
    const chargeMap = new Map<string, string>()

    for (const charge of chargesQuery.data?.data ?? []) {
      if (!charge.encounterId) {
        continue
      }

      const currentChargeId = chargeMap.get(charge.encounterId)

      if (!currentChargeId) {
        chargeMap.set(charge.encounterId, charge._id)
      }
    }

    return chargeMap
  }, [chargesQuery.data])
  const returnTo = `${location.pathname}${location.search}`
  const encounterFormConfig = useMemo(() => {
    const formConfig = createEncounterFormConfig(referenceOptions)
    const aiCodingField: CrudFormField<EncounterFormValues> = {
      name: '_id',
      label: 'AI Coding Assist',
      type: 'action',
      fullWidth: true,
      hideOnAddForm: true,
      action: {
        label: 'Generate coding suggestions',
        icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
        loading: suggestEncounterAiCodesState.isLoading,
        className: 'rcm-ai-code-button',
        helperText: 'Uses the current clinical notes and active charge master candidates. Suggestions stay in this form until you save the encounter.',
        hiddenWhen: ({ values }) => !values.clinicalNotes?.trim(),
        disabledWhen: ({ values }) => !values._id || !values.clinicalNotes?.trim(),
        onClick: async ({ values, getValues, reset }) => {
          const encounterId = values._id?.trim()

          if (!encounterId || !values.clinicalNotes.trim()) {
            setWorkflowFeedback({
              severity: 'warn',
              text: 'Clinical notes are required before AI can suggest diagnosis and procedure codes.',
            })
            return
          }

          setWorkflowFeedback(null)

          try {
            const result = await suggestEncounterAiCodes({
              id: encounterId,
              data: {
                ...mapEncounterFormToPayload(values),
                diagnosisCodes: parseStringList(values.diagnosisCodes) ?? [],
                procedureCodes: parseStringList(values.procedureCodes) ?? [],
                procedureCodeUnits: values.procedureCodeUnits,
                applySuggestions: false,
              },
            }).unwrap()
            const diagnosisCount = result.suggestions.diagnosisCodes.length
            const procedureCount = result.suggestions.procedureCodes.length
            const summaryText = result.suggestions.summary?.trim()
            const suggestedFixesText = result.suggestions.suggestedFixes.join(' ')

            if (!diagnosisCount && !procedureCount) {
              setWorkflowFeedback({
                severity: 'warn',
                text: summaryText
                  ? `${summaryText} ${suggestedFixesText}`.trim()
                  : suggestedFixesText || 'AI reviewed the encounter but could not support a confident code suggestion yet.',
              })
              return
            }

            const currentValues = getValues()
            const mergedDiagnosisCodes = result.suggestions.appliedDiagnosisCodes.length
              ? uniqueCodeValues(result.suggestions.appliedDiagnosisCodes)
              : uniqueCodeValues([
                  ...(parseStringList(currentValues.diagnosisCodes) ?? []),
                  ...result.suggestions.diagnosisCodes.map((suggestion) => suggestion.code),
                ])
            const mergedProcedureCodes = result.suggestions.appliedProcedureCodes.length
              ? uniqueCodeValues(result.suggestions.appliedProcedureCodes)
              : uniqueCodeValues([
                  ...(parseStringList(currentValues.procedureCodes) ?? []),
                  ...result.suggestions.procedureCodes.map((suggestion) => suggestion.code),
                ])
            const mergedProcedureCodeUnits = mergeProcedureCodeUnits(
              currentValues.procedureCodeUnits,
              result.suggestions.procedureCodes,
              mergedProcedureCodes,
            )

            reset({
              ...currentValues,
              diagnosisCodes: formatCodeField(mergedDiagnosisCodes),
              procedureCodes: formatCodeField(mergedProcedureCodes),
              procedureCodeUnits: mergedProcedureCodeUnits,
            })
            setWorkflowFeedback({
              severity: 'success',
              text: summaryText
                ? `${summaryText} Suggested codes were placed into the form. Review them, adjust if needed, then save the encounter.`
                : 'Suggested codes were placed into the form. Review them, adjust if needed, then save the encounter.',
            })
          } catch (error) {
            setWorkflowFeedback({
              severity: 'error',
              text: getApiErrorMessage(error),
            })
          }
        },
      },
    }
    const clinicalNotesIndex = formConfig.fields.findIndex((field) => field.name === 'clinicalNotes')
    const nextFields = [...formConfig.fields]

    nextFields.splice(clinicalNotesIndex >= 0 ? clinicalNotesIndex + 1 : nextFields.length, 0, aiCodingField)

    return {
      ...formConfig,
      fields: nextFields,
      // Scoped to the Encounter edit screen: clear the pre-filled codes whenever
      // the user edits clinical notes away from the default suggestion text.
      onValuesChange: (values: EncounterFormValues, prevValues: Partial<EncounterFormValues>, setValue: (field: keyof EncounterFormValues, value: string) => void) => {
        const currentNotes = values.clinicalNotes?.trim() ?? ''
        const prevNotes = prevValues.clinicalNotes?.trim() ?? ''
        if (currentNotes === prevNotes) return
        if (currentNotes !== DEFAULT_EDIT_CLINICAL_NOTES) {
          setValue('diagnosisCodes', '')
          setValue('procedureCodes', '')
        }
      },
    }
  }, [
    referenceOptions,
    suggestEncounterAiCodes,
    suggestEncounterAiCodesState.isLoading,
  ])

  const crudConfig: CrudPageConfig<
    Encounter,
    EncounterFormValues,
    EncounterCreatePayload,
    EncounterUpdatePayload
  > = useMemo(
    () => ({
      title: 'Encounters',
      resourceName: 'Encounter',
      help: {
        title: 'Encounters',
        intro: 'Document the checked-in visit, generate AI coding suggestions, save the encounter, and complete it to create charges.',
        steps: [
          {
            label: 'Start Encounter',
            icon: <Play className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Start Encounter or edit the checked-in encounter to open the clinical documentation form.',
          },
          {
            label: 'Fill clinical details',
            icon: <PencilLine className="h-4 w-4" aria-hidden="true" />,
            description: 'Enter the end time, clinical notes, diagnosis codes, procedure codes, and units required for charge creation.',
          },
          {
            label: 'Generate AI suggestions',
            icon: <Sparkles className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Generate AI in the clinical notes area to suggest diagnosis and procedure codes, then review the results.',
          },
          {
            label: 'Save and Complete Encounter',
            icon: <Check className="h-4 w-4" aria-hidden="true" />,
            description: 'Save the encounter, then click Complete Encounter to generate the charge and move to the Charges screen.',
          },
        ],
      },
      showCreateButton: false,
      createButtonLabel: 'Add Encounter',
      createDialogTitle: 'Add encounter',
      editDialogTitle: 'Edit encounter',
      viewDialogTitle: 'Encounter details',
      emptyMessage: 'No encounters found.',
      exportFileName: 'encounters',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'encounterDate',
        direction: 'desc',
        criteria: buildWorkflowCriteria('encounter', workflowContext),
      },
      permissions: {
        module: 'encounters',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getEncounterRowLabel(item, referenceOptions),
      table: {
        columns: createEncounterTableColumns(referenceOptions),
      },
      form: encounterFormConfig,
      api: {
        useListQuery: useGetEncountersQuery,
        useCreateMutation: useCreateEncounterMutation,
        useUpdateMutation: useUpdateEncounterMutation,
      },
      mapItemToFormValues: mapEncounterToFormValues,
      mapFormValuesToCreatePayload: mapEncounterFormToPayload,
      mapFormValuesToUpdatePayload: buildEncounterPayloadWithProcedureUnits,
      slots: {
        beforeContent: () => (
          <div className="space-y-3">
            <WorkflowReturnButton context={workflowContext} />
            <WorkflowProgressTracker currentStage="encounter" context={workflowContext} />
            {workflowFeedback ? (
              <Message severity={workflowFeedback.severity} text={workflowFeedback.text} className="w-full justify-start" />
            ) : null}
          </div>
        ),
        rowActions: (item, defaultActions) => {
          const editAction = defaultActions.find((action) => typeof action.label === 'string' && action.label.toLowerCase().includes('edit'))
          const linkedChargeId = chargeIdByEncounterId.get(item._id)
          const safeDefaultActions = defaultActions.filter((action) => {
            const label = typeof action.label === 'string' ? action.label.toLowerCase() : ''

            if (label.includes('edit') && !canEditEncounter(item, linkedChargeId)) {
              return false
            }

            return true
          })
          const workflowActions: Array<CrudTableAction<Encounter>> = linkedChargeId
            ? [
              {
                label: 'Go to Charge Capture',
                icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
                onClick: (encounter) => {
                  navigate(
                    `/rcm/charges${buildWorkflowSearch(
                      mergeWorkflowContext(workflowContext, {
                        appointmentId: encounter.appointmentId ?? workflowContext.appointmentId,
                        encounterId: encounter._id,
                        chargeId: linkedChargeId,
                        returnTo,
                        returnLabel: 'Back to Encounters',
                      }),
                    )}`,
                  )
                },
              },
            ]
            : [
              {
                label: 'Start Encounter',
                icon: <Play className="h-4 w-4" aria-hidden="true" />,
                disabled: !editAction || !canStartEncounter(item),
                onClick: (encounter) => editAction?.onClick(encounter),
              },
              {
                label: 'Complete Encounter',
                icon: <Check className="h-4 w-4" aria-hidden="true" />,
                disabled: !canCompleteEncounter(item) || completeEncounterState.isLoading,
                loading: completeEncounterState.isLoading,
                onClick: async (encounter) => {
                  setWorkflowFeedback(null)

                  try {
                    const result = await completeEncounter(encounter._id).unwrap()
                    navigate(
                      `/rcm/charges${buildWorkflowSearch(
                        mergeWorkflowContext(workflowContext, {
                          appointmentId: encounter.appointmentId ?? workflowContext.appointmentId,
                          encounterId: result.encounter._id,
                          chargeId: result.charge._id,
                          returnTo,
                          returnLabel: 'Back to Encounters',
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
              },
            ]

          return [...workflowActions, ...safeDefaultActions]
        },
        viewContent: (item) => {
          const linkedChargeId = chargeIdByEncounterId.get(item._id)
          const missingItems = [
            !item.clinicalNotes?.trim() ? 'clinical notes' : null,
            !(item.diagnosisCodes ?? []).some((code) => Boolean(code?.trim())) ? 'diagnosis code' : null,
            !(item.procedureCodes ?? []).some((code) => Boolean(code?.trim())) ? 'procedure code' : null,
            !item.endTime ? 'end time' : null,
          ].filter((value): value is string => Boolean(value))

          return (
            <div className="space-y-5">
              <RcmViewSummary
                title="Encounter workflow"
                subtitle="Confirms the clinical record is complete before charge capture is generated."
                status={linkedChargeId ? 'Charge created' : item.visitStatus ?? '-'}
                severity={getEncounterStatusSeverity(item, linkedChargeId)}
                facts={[
                  ['Patient', referenceOptions.patients?.find((option) => option.value === item.patientId)?.label ?? item.patientId ?? '-'],
                  ['Codes', `${(item.diagnosisCodes ?? []).length} ICD / ${(item.procedureCodes ?? []).length} CPT`],
                  ['Charge handoff', linkedChargeId ? 'Created' : 'Pending'],
                ]}
                journey={[
                  {
                    label: 'Visit',
                    status: item.visitStatus ?? '-',
                    detail: item.chiefComplaint || 'Chief complaint not documented',
                    severity: getEncounterStatusSeverity(item, linkedChargeId),
                  },
                  {
                    label: 'Documentation',
                    status: missingItems.length ? 'Incomplete' : 'Complete',
                    detail: missingItems.length ? `Missing ${missingItems.join(', ')}` : 'Notes, diagnosis, procedure, and end time are present.',
                    severity: missingItems.length ? 'danger' : 'success',
                  },
                  {
                    label: 'Charge capture',
                    status: linkedChargeId ? 'Generated' : canCompleteEncounter(item) ? 'Ready' : 'Waiting',
                    detail: linkedChargeId ? 'Charge is available for coding review.' : 'Complete Encounter generates the charge.',
                    severity: linkedChargeId ? 'success' : canCompleteEncounter(item) ? 'warning' : 'neutral',
                  },
                  {
                    label: 'Next handoff',
                    status: linkedChargeId ? 'Review charge' : 'Complete encounter',
                    detail: linkedChargeId ? 'Validate charge lines and submit for AI coding review.' : 'Use Complete Encounter once documentation is ready.',
                    severity: linkedChargeId ? 'warning' : missingItems.length ? 'danger' : 'warning',
                  },
                ]}
                alerts={missingItems.length ? [{ title: 'Encounter is not ready for completion', detail: `Add ${missingItems.join(', ')}.`, severity: 'danger' }] : []}
                actions={linkedChargeId ? [
                  {
                    label: 'Open Charge',
                    helper: 'Go to charge capture for this encounter.',
                    onClick: () => {
                      navigate(
                        `/rcm/charges${buildWorkflowSearch(
                          mergeWorkflowContext(workflowContext, {
                            encounterId: item._id,
                            chargeId: linkedChargeId,
                            returnTo,
                            returnLabel: 'Back to Encounters',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []}
              />
              {renderEncounterDetails(item, referenceOptions)}
            </div>
          )
        },
        gridItem: (item) => renderEncounterGridItem(item, referenceOptions),
      },
    }),
    [
      chargeIdByEncounterId,
      completeEncounter,
      completeEncounterState.isLoading,
      encounterFormConfig,
      navigate,
      referenceOptions,
      returnTo,
      workflowContext,
      workflowFeedback,
    ],
  )

  return (
    <CrudPage key={workflowKey || 'encounters'} config={crudConfig} />
  )
}
