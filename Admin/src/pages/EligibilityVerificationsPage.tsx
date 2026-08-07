import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Message } from 'primereact/message'
import { CommonForm } from '@/components/crud/CommonForm'
import { CrudPage } from '@/components/crud/CrudPage'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import type { CrudPageConfig } from '@/types/crud'
import {
  createEligibilityVerificationFormConfig,
  createEligibilityVerificationRunFormConfig,
  createEligibilityVerificationTableColumns,
  manualEligibilityVerificationSourceValues,
  mapEligibilityVerificationFormToPayload,
  mapEligibilityVerificationRunFormToPayload,
  mapEligibilityVerificationToFormValues,
  renderEligibilityVerificationDetails,
  renderEligibilityVerificationGridItem,
} from '@/models/eligibilityVerificationModel'
import {
  useCreateEligibilityVerificationMutation,
  useGetEligibilityVerificationsQuery,
  useRunEligibilityVerificationMutation,
  useUpdateEligibilityVerificationMutation,
} from '@/services/api/endpoints/eligibilityVerificationsApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import { useGetAppointmentsQuery } from '@/services/api/endpoints/appointmentsApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetInsurancePoliciesQuery } from '@/services/api/endpoints/insurancePoliciesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type {
  EligibilityVerification,
  EligibilityVerificationCreatePayload,
  EligibilityVerificationFormValues,
  EligibilityVerificationRunFormValues,
  EligibilityVerificationUpdatePayload,
} from '@/types/eligibilityVerification'

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

function getEligibilitySeverity(item: EligibilityVerification): RcmSummarySeverity {
  if (!item.planActive || ['Inactive', 'Rejected', 'Failed'].includes(item.eligibilityStatus ?? '')) {
    return 'danger'
  }

  if (item.authorizationRequired || item.referralRequired) {
    return 'warning'
  }

  return 'success'
}

export function EligibilityVerificationsPage() {
  const [isRunDialogOpen, setIsRunDialogOpen] = useState(false)
  const [runSuccessMessage, setRunSuccessMessage] = useState<string | null>(null)
  const [runErrorMessage, setRunErrorMessage] = useState<string | null>(null)

  const appointmentsQuery = useGetAppointmentsQuery(lookupQuery)
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const insurancePoliciesQuery = useGetInsurancePoliciesQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)
  const [runEligibilityVerification, runEligibilityVerificationState] = useRunEligibilityVerificationMutation()

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

  const appointmentsOptions = useMemo(
    () =>
      (appointmentsQuery.data?.data ?? []).map((item) => {
        const dateLabel = item.appointmentDate
          ? new Intl.DateTimeFormat('en-US', {
              month: 'short',
              day: '2-digit',
              year: 'numeric',
            }).format(new Date(item.appointmentDate))
          : 'Unknown date'
        const patientLabel = item.patientId ? patientLabelsById.get(item.patientId) : undefined
        const parts = [dateLabel, item.appointmentTime, patientLabel, item.reason].filter(Boolean)

        return {
          label: parts.join(' • ') || item._id,
          value: item._id,
        }
      }),
    [appointmentsQuery.data, patientLabelsById],
  )

  const insurancePoliciesOptions = useMemo(
    () =>
      (insurancePoliciesQuery.data?.data ?? []).map((item) => ({
        label: item.planName || item.memberId || item._id,
        value: item._id,
      })),
    [insurancePoliciesQuery.data],
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
  const payersOptions = useMemo(
    () =>
      (payersQuery.data?.data ?? []).map((item) => ({
        label: item.payerName ? `${item.payerName} (${item.payerId ?? item._id})` : item.payerId ?? item._id,
        value: item.payerId ?? item._id,
      })),
    [payersQuery.data],
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
      insurancePolicies: insurancePoliciesOptions,
      patients: patientsOptions,
      payers: payersOptions,
      providers: providersOptions,
    }),
    [appointmentsOptions, facilitiesOptions, insurancePoliciesOptions, patientsOptions, payersOptions, providersOptions],
  )

  const runFormConfig = useMemo(
    () => createEligibilityVerificationRunFormConfig(referenceOptions),
    [referenceOptions],
  )

  const handleRunEligibility = async (values: EligibilityVerificationRunFormValues) => {
    setRunSuccessMessage(null)
    setRunErrorMessage(null)

    try {
      const item = await runEligibilityVerification(mapEligibilityVerificationRunFormToPayload(values)).unwrap()
      setRunSuccessMessage(
        `Eligibility check completed. Reference: ${item.externalVerificationId ?? item.correlationId ?? item._id}.`,
      )
      setIsRunDialogOpen(false)
    } catch (error) {
      setRunErrorMessage(getApiErrorMessage(error, 'Unable to run eligibility verification.'))
    }
  }

  const manualVerificationSourceSet = useMemo(
    () => new Set<string>(manualEligibilityVerificationSourceValues),
    [],
  )

  const crudConfig: CrudPageConfig<
    EligibilityVerification,
    EligibilityVerificationFormValues,
    EligibilityVerificationCreatePayload,
    EligibilityVerificationUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Eligibility Verifications',
      resourceName: 'Eligibility Verification',
      showCreateButton: true,
      createButtonLabel: 'Add Manual Verification',
      createDialogTitle: 'Add manual eligibility verification',
      editDialogTitle: 'Edit eligibility verification',
      viewDialogTitle: 'Eligibility Verification details',
      deleteDialogTitle: 'Delete eligibility verification?',
      emptyMessage: 'No eligibility verifications found.',
      exportFileName: 'eligibility-verifications',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'eligibility-verifications',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) =>
        [
          item.eligibilityStatus,
          item.coverageStatus,
          referenceOptions.patients?.find((option) => option.value === item.patientId)?.label,
        ].filter(Boolean).join(' / ') || String(item._id),
      table: {
        columns: createEligibilityVerificationTableColumns(referenceOptions),
      },
      form: createEligibilityVerificationFormConfig(referenceOptions),
      api: {
        useCreateMutation: useCreateEligibilityVerificationMutation,
        useListQuery: useGetEligibilityVerificationsQuery,
        useUpdateMutation: useUpdateEligibilityVerificationMutation,
      },
      mapItemToFormValues: mapEligibilityVerificationToFormValues,
      mapFormValuesToCreatePayload: mapEligibilityVerificationFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapEligibilityVerificationFormToPayload(values),
      style: {
        formDialogWidth: 'min(96vw, 68rem)',
        viewDialogWidth: 'min(96vw, 74rem)',
        viewDialogMinHeight: '36rem',
      },
      slots: {
        toolbarRight: () => (
          <Button
            type="button"
            label="Run Real-Time Check"
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            className="flex items-center gap-1 h-8 px-4 text-xs font-bold"
            onClick={() => {
              setRunErrorMessage(null)
              setRunSuccessMessage(null)
              setIsRunDialogOpen(true)
            }}
          />
        ),
        rowActions: (item, defaultActions) => {
          const isRealtimeVerification = Boolean(
            item.rawResponsePayload || item.vendorName || item.correlationId || item.externalVerificationId,
          )
          const isManualVerificationSource = manualVerificationSourceSet.has(item.verificationSource ?? 'Manual')

          return defaultActions.filter((action) => {
            const label = typeof action.label === 'string' ? action.label : ''

            if (label.startsWith('Delete ')) {
              return false
            }

            if (label.startsWith('Edit ') && (isRealtimeVerification || !isManualVerificationSource)) {
              return false
            }

            return true
          })
        },
        viewContent: (item) => (
          <div className="space-y-5">
            <RcmViewSummary
              title="Eligibility workflow"
              subtitle="Explains coverage response and the check-in requirements created by eligibility."
              status={item.coverageStatus || item.eligibilityStatus || '-'}
              severity={getEligibilitySeverity(item)}
              facts={[
                ['Patient', referenceOptions.patients?.find((option) => option.value === item.patientId)?.label ?? item.patientId ?? '-'],
                ['Insurance', referenceOptions.insurancePolicies?.find((option) => option.value === item.insuranceId)?.label ?? item.insuranceId ?? '-'],
                ['Source', item.vendorName || item.verificationSource || 'Manual'],
              ]}
              journey={[
                {
                  label: 'Coverage',
                  status: item.planActive ? 'Active' : 'Inactive',
                  detail: item.coverageStatus || item.eligibilityStatus || 'No coverage status captured.',
                  severity: item.planActive ? 'success' : 'danger',
                },
                {
                  label: 'Patient cost',
                  status: item.deductibleRemaining !== undefined ? `$${item.deductibleRemaining}` : 'Not returned',
                  detail: `Copay ${item.copayAmount ?? 0}, coinsurance ${item.coinsurancePercent ?? 0}%.`,
                  severity: 'neutral',
                },
                {
                  label: 'Auth/referral gate',
                  status: item.authorizationRequired || item.referralRequired ? 'Required' : 'Not required',
                  detail: [
                    item.authorizationRequired ? 'Prior authorization required' : null,
                    item.referralRequired ? 'Referral required' : null,
                  ].filter(Boolean).join(' / ') || 'No additional check-in gate from this response.',
                  severity: item.authorizationRequired || item.referralRequired ? 'warning' : 'success',
                },
                {
                  label: 'Next handoff',
                  status: item.planActive ? 'Appointment check-in' : 'Coverage correction',
                  detail: item.planActive ? 'Check-in can continue once auth/referral requirements are satisfied.' : 'Fix coverage or route to self-pay before check-in.',
                  severity: item.planActive ? 'warning' : 'danger',
                },
              ]}
              alerts={[
                ...(!item.planActive ? [{ title: 'Coverage inactive', detail: 'Patient cannot pass check-in with this eligibility response.', severity: 'danger' as const }] : []),
                ...(item.authorizationRequired ? [{ title: 'Prior authorization required', detail: 'Create/approve prior authorization before check-in or claim submission.', severity: 'warning' as const }] : []),
                ...(item.referralRequired ? [{ title: 'Referral required', detail: 'Capture a valid referral before check-in or claim submission.', severity: 'warning' as const }] : []),
              ]}
            />
            {renderEligibilityVerificationDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderEligibilityVerificationGridItem(item, referenceOptions),
      },
    }),
    [manualVerificationSourceSet, referenceOptions],
  )

  return (
    <div className="space-y-2">
      {runSuccessMessage ? (
        <Message severity="success" text={runSuccessMessage} className="w-full justify-start" />
      ) : null}
      {runErrorMessage ? (
        <Message severity="error" text={runErrorMessage} className="w-full justify-start" />
      ) : null}

      <CrudPage config={crudConfig} />

      <Dialog
        visible={isRunDialogOpen}
        header="Run real-time eligibility"
        modal
        blockScroll
        draggable={false}
        resizable={false}
        className="crud-form-dialog"
        style={{ width: 'min(96vw, 56rem)' }}
        onHide={() => setIsRunDialogOpen(false)}
      >
        <CommonForm
          config={runFormConfig}
          mode="create"
          submitLabel="Run Check"
          isSubmitting={runEligibilityVerificationState.isLoading}
          onCancel={() => setIsRunDialogOpen(false)}
          onSubmit={handleRunEligibility}
        />
      </Dialog>
    </div>
  )
}
