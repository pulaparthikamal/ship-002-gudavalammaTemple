import { ArrowRight, Navigation, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Message } from 'primereact/message'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { WorkflowProgressTracker } from '@/components/rcm/WorkflowProgressTracker'
import { CrudPage } from '@/components/crud/CrudPage'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import type { CrudPageConfig } from '@/types/crud'
import { createAppointmentFormConfig, createAppointmentTableColumns, getAppointmentRowLabel, mapAppointmentFormToPayload, mapAppointmentToFormValues, renderAppointmentDetails, renderAppointmentGridItem } from '@/models/appointmentModel'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useBulkDeleteAppointmentsMutation, useCheckInAppointmentMutation, useCreateAppointmentMutation, useDeleteAppointmentMutation, useGetAppointmentsQuery, useGetAppointmentSummaryQuery, useUpdateAppointmentMutation } from '@/services/api/endpoints/appointmentsApi'
import { useGetEncountersQuery } from '@/services/api/endpoints/encountersApi'
import { useGetEligibilityVerificationsQuery } from '@/services/api/endpoints/eligibilityVerificationsApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetInsurancePoliciesQuery } from '@/services/api/endpoints/insurancePoliciesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPriorAuthorizationsQuery } from '@/services/api/endpoints/priorAuthorizationsApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import { useGetReferralsQuery } from '@/services/api/endpoints/referralsApi'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudTableAction } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { WorkflowFeedback } from '@/types/rcmWorkflow'
import type { Appointment, AppointmentCreatePayload, AppointmentFormValues, AppointmentUpdatePayload } from '@/types/appointment'
import type { EligibilityVerification } from '@/types/eligibilityVerification'
import type { InsurancePolicy } from '@/types/insurancePolicy'
import type { PriorAuthorization } from '@/types/priorAuthorization'
import type { Referral } from '@/types/referral'
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

const APPROVED_AUTHORIZATION_STATUSES = new Set(['approved', 'authorized', 'certified'])
const INVALID_REFERRAL_STATUSES = new Set(['denied', 'cancelled', 'canceled', 'expired', 'closed'])

type CheckInGate = {
  ready: boolean
  reason?: string
}

function normalizeText(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizeDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

function normalizeBusinessDate(value?: string | Date | null) {
  const dateValue = normalizeDate(value)

  if (!dateValue) {
    return null
  }

  return new Date(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate())
}

function isDateOnOrAfter(left?: string | Date | null, right?: string | Date | null) {
  const leftDate = normalizeBusinessDate(left)
  const rightDate = normalizeBusinessDate(right)

  if (!leftDate || !rightDate) {
    return true
  }

  return leftDate.getTime() >= rightDate.getTime()
}

function isDateOnOrBefore(left?: string | Date | null, right?: string | Date | null) {
  const leftDate = normalizeBusinessDate(left)
  const rightDate = normalizeBusinessDate(right)

  if (!leftDate || !rightDate) {
    return true
  }

  return leftDate.getTime() <= rightDate.getTime()
}

function isDateWithinRange(
  target?: string | Date | null,
  start?: string | Date | null,
  end?: string | Date | null,
) {
  const targetDate = normalizeBusinessDate(target)

  if (!targetDate) {
    return false
  }

  return isDateOnOrAfter(targetDate, start) && isDateOnOrBefore(targetDate, end)
}

function getAppointmentServiceDate(item: Appointment) {
  return normalizeBusinessDate(item.appointmentStart ?? item.appointmentDate) ?? normalizeBusinessDate(new Date()) ?? new Date()
}

function isAppointmentCheckInStatusEligible(appointment: Appointment) {
  return !['Cancelled', 'No Show', 'Checked In', 'In Progress', 'Completed'].includes(appointment.appointmentStatus ?? '')
}

function canEditAppointment(item: Appointment, linkedEncounterId?: string) {
  return !linkedEncounterId && !['Checked In', 'In Progress', 'Completed', 'Cancelled', 'No Show'].includes(item.appointmentStatus ?? '')
}

function canDeleteAppointment(item: Appointment, linkedEncounterId?: string) {
  return !linkedEncounterId && ['Scheduled', 'Confirmed'].includes(item.appointmentStatus ?? '')
}

function getAppointmentStatusSeverity(item: Appointment, linkedEncounterId?: string): RcmSummarySeverity {
  if (linkedEncounterId || item.appointmentStatus === 'Completed') {
    return 'success'
  }

  if (['Cancelled', 'No Show'].includes(item.appointmentStatus ?? '')) {
    return 'danger'
  }

  if (['Checked In', 'In Progress'].includes(item.appointmentStatus ?? '')) {
    return 'warning'
  }

  return 'neutral'
}

function resolvePrimaryPolicy(policies: InsurancePolicy[], appointment: Appointment) {
  const serviceDate = getAppointmentServiceDate(appointment)
  return policies
    .filter((policy) => {
      if (policy.patientId !== appointment.patientId || !policy.active) {
        return false
      }

      if (normalizeText(policy.coverageType).toLowerCase() === 'self pay') {
        return false
      }

      const policyStatus = normalizeText(policy.policyStatus).toLowerCase()

      if (policyStatus && ['inactive', 'terminated', 'cancelled', 'canceled'].includes(policyStatus)) {
        return false
      }
      return (
        isDateOnOrAfter(serviceDate, policy.effectiveDate)
        && isDateOnOrAfter(policy.terminationDate, serviceDate)
      )
    })
    .sort((left, right) => {
      const leftOrder = left.coordinationOfBenefitsOrder ?? Number.MAX_SAFE_INTEGER
      const rightOrder = right.coordinationOfBenefitsOrder ?? Number.MAX_SAFE_INTEGER

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder
      }

      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
    })[0]
}

function resolveSelfPayPolicy(policies: InsurancePolicy[], appointment: Appointment) {
  const serviceDate = getAppointmentServiceDate(appointment)
  return policies
    .filter((policy) => {
      if (policy.patientId !== appointment.patientId || !policy.active) {
        return false
      }

      if (normalizeText(policy.coverageType).toLowerCase() !== 'self pay') {
        return false
      }

      const policyStatus = normalizeText(policy.policyStatus).toLowerCase()

      if (policyStatus && ['inactive', 'terminated', 'cancelled', 'canceled'].includes(policyStatus)) {
        return false
      }

      return (
        isDateOnOrAfter(serviceDate, policy.effectiveDate)
        && isDateOnOrAfter(policy.terminationDate, serviceDate)
      )
    })
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0]
}

function resolveLatestEligibility(
  eligibilities: EligibilityVerification[],
  appointment: Appointment,
  insurancePolicy?: InsurancePolicy,
) {
  return eligibilities
    .filter((item) => item.active && item.patientId === appointment.patientId && item.insuranceId === insurancePolicy?._id)
    .sort((left, right) => {
      const leftDate = normalizeDate(left.checkedAt ?? left.updatedAt)?.getTime() ?? 0
      const rightDate = normalizeDate(right.checkedAt ?? right.updatedAt)?.getTime() ?? 0
      return rightDate - leftDate
    })[0]
}

function hasApprovedAuthorization(
  priorAuthorizations: PriorAuthorization[],
  appointment: Appointment,
  insurancePolicy: InsurancePolicy,
) {
  const serviceDate = getAppointmentServiceDate(appointment)

  return priorAuthorizations.some((authorization) => {
    const status = normalizeText(authorization.authorizationStatus).toLowerCase()
    return (
      authorization.active
      && authorization.patientId === appointment.patientId
      && authorization.insuranceId === insurancePolicy._id
      && APPROVED_AUTHORIZATION_STATUSES.has(status)
      && Boolean(normalizeText(authorization.authNumber))
      && isDateOnOrAfter(authorization.expirationDate, serviceDate)
    )
  })
}

function hasValidReferral(
  referrals: Referral[],
  appointment: Appointment,
  insurancePolicy: InsurancePolicy,
) {
  const serviceDate = getAppointmentServiceDate(appointment)
  const appointmentReferralNumber = normalizeText(appointment.referral?.referralNumber)

  if (
    appointment.referral?.required
    && appointmentReferralNumber
    && isDateWithinRange(serviceDate, appointment.referral?.validFrom, appointment.referral?.validTo)
  ) {
    return true
  }

  return referrals.some((referral) => {
    const referralStatus = normalizeText(referral.referralStatus).toLowerCase()
    const payerMatches =
      !normalizeText(referral.payerId)
      || normalizeText(referral.payerId) === normalizeText(insurancePolicy.payerId)

    return (
      referral.active
      && referral.patientId === appointment.patientId
      && payerMatches
      && Boolean(normalizeText(referral.referralNumber))
      && (!referral.appointmentId || referral.appointmentId === appointment._id)
      && (typeof referral.remainingVisits !== 'number' || referral.remainingVisits > 0)
      && !INVALID_REFERRAL_STATUSES.has(referralStatus)
      && isDateWithinRange(serviceDate, referral.startDate, referral.endDate)
    )
  })
}

function getCheckInGate(
  appointment: Appointment,
  policies: InsurancePolicy[],
  eligibilities: EligibilityVerification[],
  priorAuthorizations: PriorAuthorization[],
  referrals: Referral[],
): CheckInGate {
  if (!isAppointmentCheckInStatusEligible(appointment)) {
    return { ready: false, reason: 'Appointment is not eligible for check-in.' }
  }

  if (!appointment.patientId || !appointment.providerId || !appointment.facilityId) {
    return { ready: false, reason: 'Patient, provider, and facility must be assigned before check-in.' }
  }

  const insurancePolicy = resolvePrimaryPolicy(policies, appointment)

  if (!insurancePolicy) {
    const selfPayPolicy = resolveSelfPayPolicy(policies, appointment)

    if (selfPayPolicy) {
      return { ready: true }
    }

    return {
      ready: false,
      reason: 'No active insured coverage is on file. Correct insurance or route the visit to self-pay before check-in.',
    }
  }

  const latestEligibility = resolveLatestEligibility(eligibilities, appointment, insurancePolicy)

  if (!latestEligibility) {
    return { ready: false, reason: 'Eligibility must be verified before check-in.' }
  }

  if (latestEligibility.planActive === false) {
    return { ready: false, reason: 'Latest eligibility verification shows inactive coverage.' }
  }

  const serviceDate = getAppointmentServiceDate(appointment)
  const nextVerificationDueDate = normalizeBusinessDate(insurancePolicy.verification?.nextVerificationDueDate)

  if (nextVerificationDueDate && nextVerificationDueDate.getTime() < serviceDate.getTime()) {
    return { ready: false, reason: 'Eligibility must be reverified for the date of service.' }
  }

  if (latestEligibility.authorizationRequired && !hasApprovedAuthorization(priorAuthorizations, appointment, insurancePolicy)) {
    return { ready: false, reason: 'An approved prior authorization is required before check-in.' }
  }

  if (latestEligibility.referralRequired && !hasValidReferral(referrals, appointment, insurancePolicy)) {
    return { ready: false, reason: 'A valid referral is required before check-in.' }
  }

  return { ready: true }
}

function AppointmentSummaryCards({ query }: { query: CrudListQuery }) {
  const summaryQuery = useMemo(
    () => ({
      ...query,
      page: 1,
      limit: 1,
    }),
    [query],
  )
  const summaryResult = useGetAppointmentSummaryQuery(summaryQuery)
  const summary = summaryResult.data ?? {
    awaitingArrival: 0,
    inClinic: 0,
    completed: 0,
    exceptions: 0,
    financialHold: 0,
  }
  const valueClassName = summaryResult.isLoading || summaryResult.isFetching
    ? 'mt-2 text-2xl font-bold text-[var(--color-text-muted)]'
    : 'mt-2 text-2xl font-bold text-[var(--color-text-strong)]'
  const warningValueClassName = summaryResult.isLoading || summaryResult.isFetching
    ? 'mt-2 text-2xl font-bold text-[var(--color-warning-text)]/70'
    : 'mt-2 text-2xl font-bold text-[var(--color-warning-text)]'

  return (
    <>
      {summaryResult.error ? (
        <Message severity="error" text={getApiErrorMessage(summaryResult.error, 'Unable to load appointment summary.')} className="w-full justify-start" />
      ) : null}
      <section className="grid gap-3 md:grid-cols-5">
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Awaiting arrival</p>
          <p className={valueClassName}>{summary.awaitingArrival}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Scheduled or confirmed visits in the filtered queue.</p>
        </article>
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">In clinic</p>
          <p className={valueClassName}>{summary.inClinic}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Patients already checked in or actively being seen.</p>
        </article>
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Completed</p>
          <p className={valueClassName}>{summary.completed}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Appointments with a completed operational handoff.</p>
        </article>
        <article className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Exceptions</p>
          <p className={valueClassName}>{summary.exceptions}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Cancelled and no-show appointments in the filtered queue.</p>
        </article>
        <article className="rounded-lg border border-[var(--color-warning-text)]/30 bg-[var(--color-warning-soft)] p-4 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-normal text-[var(--color-warning-text)]">Financial hold</p>
          <p className={warningValueClassName}>{summary.financialHold}</p>
          <p className="mt-1 text-xs text-[var(--color-warning-text)]">Visits blocked by missing eligibility, referral, or prior auth.</p>
        </article>
      </section>
    </>
  )
}

export function AppointmentsPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const [workflowFeedback, setWorkflowFeedback] = useState<WorkflowFeedback | null>(null)
  const [checkInAppointment, checkInState] = useCheckInAppointmentMutation()
  const encountersQuery = useGetEncountersQuery(lookupQuery)
  const eligibilityVerificationsQuery = useGetEligibilityVerificationsQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const insurancePoliciesQuery = useGetInsurancePoliciesQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const priorAuthorizationsQuery = useGetPriorAuthorizationsQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)
  const referralsQuery = useGetReferralsQuery(lookupQuery)

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
      facilities: facilitiesOptions,
      patients: patientsOptions,
      providers: providersOptions,
    }),
    [facilitiesOptions, patientsOptions, providersOptions],
  )
  const policies = insurancePoliciesQuery.data?.data ?? []
  const encounterIdByAppointmentId = useMemo(() => {
    const encounterMap = new Map<string, string>()

    for (const encounter of encountersQuery.data?.data ?? []) {
      if (!encounter.appointmentId) {
        continue
      }

      const currentEncounterId = encounterMap.get(encounter.appointmentId)

      if (!currentEncounterId) {
        encounterMap.set(encounter.appointmentId, encounter._id)
      }
    }

    return encounterMap
  }, [encountersQuery.data])
  const eligibilities = eligibilityVerificationsQuery.data?.data ?? []
  const priorAuthorizations = priorAuthorizationsQuery.data?.data ?? []
  const referrals = referralsQuery.data?.data ?? []
  const returnTo = `${location.pathname}${location.search}`

  const crudConfig: CrudPageConfig<
    Appointment,
    AppointmentFormValues,
    AppointmentCreatePayload,
    AppointmentUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Appointments',
      resourceName: 'Appointment',
      help: {
        title: 'Appointments',
        intro: 'Start the RCM workflow here by scheduling the visit and checking the patient in when all pre-visit gates are ready.',
        steps: [
          {
            label: 'Add Appointment',
            icon: <Plus className="h-4 w-4" aria-hidden="true" />,
            description: 'Click Add Appointment, then select patient JANE DOE (MRN2026123469), provider MEDICAL PROVIDER MD, FACP, facility RCM Demo Dental Clinic, appointment date, and visit details. Create the appointment when these values are set.',
          },
          {
            label: 'Check In',
            icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
            description: 'Use Check In on the appointment row once eligibility, referral, and authorization checks are clear. This creates or opens the encounter.',
          },
          {
            label: 'Go to Encounter',
            icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
            description: 'After check-in, continue to the Encounter screen to document the visit.',
          },
        ],
      },
      createButtonLabel: 'Add Appointment',
      createDialogTitle: 'Add appointment',
      editDialogTitle: 'Edit appointment',
      viewDialogTitle: 'Appointment details',
      deleteDialogTitle: 'Delete appointment?',
      emptyMessage: 'No appointments found.',
      exportFileName: 'appointments',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'appointmentStart',
        direction: 'asc',
        criteria: buildWorkflowCriteria('appointment', workflowContext),
      },
      permissions: {
        module: 'appointments',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => getAppointmentRowLabel(item, referenceOptions),
      table: {
        columns: createAppointmentTableColumns(referenceOptions),
      },
      form: createAppointmentFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteAppointmentsMutation,
        useListQuery: useGetAppointmentsQuery,
        useCreateMutation: useCreateAppointmentMutation,
        useUpdateMutation: useUpdateAppointmentMutation,
        useDeleteMutation: useDeleteAppointmentMutation,
      },
      mapItemToFormValues: mapAppointmentToFormValues,
      mapFormValuesToCreatePayload: mapAppointmentFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapAppointmentFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected appointments?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'appointment' : 'appointments'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'appointment' : 'appointments'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        beforeContent: ({ query }) => {
          return (
            <div className="space-y-3">
              <WorkflowProgressTracker currentStage="appointment" context={workflowContext} />
              {workflowFeedback ? (
                <Message severity={workflowFeedback.severity} text={workflowFeedback.text} className="w-full justify-start" />
              ) : null}
              <AppointmentSummaryCards query={query} />
            </div>
          )
        },
        rowActions: (item, defaultActions) => {
          const gate = getCheckInGate(item, policies, eligibilities, priorAuthorizations, referrals)
          const linkedEncounterId = encounterIdByAppointmentId.get(item._id)
          const safeDefaultActions = defaultActions.filter((action) => {
            const label = typeof action.label === 'string' ? action.label.toLowerCase() : ''

            if (label.includes('edit') && !canEditAppointment(item, linkedEncounterId)) {
              return false
            }

            if (label.includes('delete') && !canDeleteAppointment(item, linkedEncounterId)) {
              return false
            }

            return true
          })

          const workflowActions: Array<CrudTableAction<Appointment>> = linkedEncounterId
            ? [
                {
                  label: 'Go to Encounter',
                  icon: <Navigation className="h-4 w-4" aria-hidden="true" />,
                  onClick: (appointment) => {
                    navigate(
                      `/rcm/encounters${buildWorkflowSearch(
                        mergeWorkflowContext(workflowContext, {
                          appointmentId: appointment._id,
                          encounterId: linkedEncounterId,
                          returnTo,
                          returnLabel: 'Back to Appointments',
                        }),
                      )}`,
                    )
                  },
                },
              ]
            : [
                {
                  label: gate.ready ? 'Check In' : 'Check In Blocked',
                  icon: <ArrowRight className="h-4 w-4" aria-hidden="true" />,
                  disabled: !gate.ready || checkInState.isLoading,
                  loading: checkInState.isLoading,
                  onClick: async (appointment) => {
                    setWorkflowFeedback(null)

                    try {
                      const result = await checkInAppointment(appointment._id).unwrap()
                      navigate(
                        `/rcm/encounters${buildWorkflowSearch(
                          mergeWorkflowContext(workflowContext, {
                            appointmentId: result.appointment._id,
                            encounterId: result.encounter._id,
                            returnTo,
                            returnLabel: 'Back to Appointments',
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
          const gate = getCheckInGate(item, policies, eligibilities, priorAuthorizations, referrals)
          const linkedEncounterId = encounterIdByAppointmentId.get(item._id)

          return (
            <div className="space-y-5">
              <RcmViewSummary
                title="Appointment workflow"
                subtitle="Validates financial readiness before the visit moves into encounter documentation."
                status={linkedEncounterId ? 'Encounter created' : item.appointmentStatus ?? 'Scheduled'}
                severity={getAppointmentStatusSeverity(item, linkedEncounterId)}
                facts={[
                  ['Patient', referenceOptions.patients?.find((option) => option.value === item.patientId)?.label ?? item.patientId ?? '-'],
                  ['Visit', [item.appointmentType, item.visitType].filter(Boolean).join(' / ') || '-'],
                  ['Check-in gate', gate.ready ? 'Ready' : 'Blocked'],
                ]}
                journey={[
                  {
                    label: 'Front desk',
                    status: item.appointmentStatus ?? '-',
                    detail: item.checkInStatus ?? 'Not checked in',
                    severity: getAppointmentStatusSeverity(item, linkedEncounterId),
                  },
                  {
                    label: 'Coverage gate',
                    status: gate.ready ? 'Passed' : 'Blocked',
                    detail: gate.reason ?? 'Eligibility, referral, and authorization checks are satisfied.',
                    severity: gate.ready ? 'success' : 'danger',
                  },
                  {
                    label: 'Encounter',
                    status: linkedEncounterId ? 'Started' : 'Not created',
                    detail: linkedEncounterId ? 'Clinical documentation can continue from the encounter screen.' : 'Check in creates the encounter.',
                    severity: linkedEncounterId ? 'success' : 'neutral',
                  },
                  {
                    label: 'Next handoff',
                    status: linkedEncounterId ? 'Document visit' : 'Check in patient',
                    detail: linkedEncounterId ? 'Complete the encounter when clinical notes and codes are ready.' : 'Use the Check In action when the gate passes.',
                    severity: linkedEncounterId ? 'warning' : gate.ready ? 'neutral' : 'danger',
                  },
                ]}
                alerts={gate.ready ? [] : [{ title: 'Check-in is blocked', detail: gate.reason, severity: 'danger' }]}
                actions={linkedEncounterId ? [
                  {
                    label: 'Open Encounter',
                    helper: 'Go to the linked encounter for clinical documentation.',
                    onClick: () => {
                      navigate(
                        `/rcm/encounters${buildWorkflowSearch(
                          mergeWorkflowContext(workflowContext, {
                            appointmentId: item._id,
                            encounterId: linkedEncounterId,
                            returnTo,
                            returnLabel: 'Back to Appointments',
                          }),
                        )}`,
                      )
                    },
                  },
                ] : []}
              />
              {renderAppointmentDetails(item, referenceOptions)}
            </div>
          )
        },
        gridItem: (item) => renderAppointmentGridItem(item, referenceOptions),
      },
    }),
    [
      checkInAppointment,
      checkInState.isLoading,
      eligibilities,
      navigate,
      encounterIdByAppointmentId,
      policies,
      priorAuthorizations,
      referenceOptions,
      referrals,
      returnTo,
      workflowContext,
      workflowFeedback,
    ],
  )

  return (
    <>
      <CrudPage key={workflowKey || 'appointments'} config={crudConfig} />
    </>
  )
}
