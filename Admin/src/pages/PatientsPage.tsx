import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CrudPage } from '@/components/crud/CrudPage'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import {
  mapPatientFormToPayload,
  mapPatientToFormValues,
  patientFormConfig,
  patientTableColumns,
  renderPatientDetails,
  renderPatientGridItem,
} from '@/models/patientModel'
import {
  useCreatePatientMutation,
  useGetPatientsQuery,
  useUpdatePatientMutation,
} from '@/services/api/endpoints/patientsApi'
import type { EntityId } from '@/types/common'
import type { CrudPageConfig } from '@/types/crud'
import type {
  Patient,
  PatientCreatePayload,
  PatientFormValues,
  PatientUpdatePayload,
} from '@/types/patient'
import { readWorkflowContext } from '@/utils/rcmWorkflow'

type PatientBulkDeletePayload = {
  ids: EntityId[]
}

function getPatientReadinessSeverity(patient: Patient): RcmSummarySeverity {
  if (patient.duplicateCheckFlag || patient.mergeRequiredFlag) {
    return 'danger'
  }

  if (!patient.mobileNumber || !patient.dateOfBirth || !patient.gender) {
    return 'warning'
  }

  return 'success'
}

function renderPatientWorkflowDetails(patient: Patient) {
  const missingItems = [
    !patient.medicalRecordNumber ? 'MRN' : null,
    !patient.dateOfBirth ? 'date of birth' : null,
    !patient.gender ? 'gender' : null,
    !patient.mobileNumber ? 'mobile number' : null,
    !patient.address?.addressLine1 ? 'address' : null,
  ].filter((value): value is string => Boolean(value))

  return (
    <div className="space-y-5">
      <RcmViewSummary
        title="Patient intake workflow"
        subtitle="Confirms the demographic foundation needed before insurance, eligibility, and appointment work."
        status={patient.patientStatus || 'Registered'}
        severity={getPatientReadinessSeverity(patient)}
        facts={[
          ['MRN', patient.medicalRecordNumber || '-'],
          ['Contact', patient.mobileNumber || patient.email || '-'],
          ['Duplicate check', patient.mergeRequiredFlag ? 'Merge required' : patient.duplicateCheckFlag ? 'Potential duplicate' : 'Clear'],
        ]}
        journey={[
          {
            label: 'Demographics',
            status: missingItems.length ? 'Incomplete' : 'Complete',
            detail: missingItems.length ? `Missing ${missingItems.join(', ')}` : 'Core registration fields are present.',
            severity: missingItems.length ? 'warning' : 'success',
          },
          {
            label: 'Duplicate safety',
            status: patient.mergeRequiredFlag ? 'Merge required' : patient.duplicateCheckFlag ? 'Review' : 'Clear',
            detail: patient.mergeRequiredFlag || patient.duplicateCheckFlag ? 'Resolve duplicate risk before creating downstream work.' : 'No duplicate flag is active.',
            severity: patient.mergeRequiredFlag || patient.duplicateCheckFlag ? 'danger' : 'success',
          },
          {
            label: 'Financial path',
            status: 'Insurance next',
            detail: 'Add active coverage or self-pay policy before eligibility and appointment check-in.',
            severity: 'neutral',
          },
          {
            label: 'Next handoff',
            status: 'Insurance policy',
            detail: 'Coverage, subscriber/dependent, and payer data drive eligibility.',
            severity: missingItems.length ? 'warning' : 'success',
          },
        ]}
        alerts={missingItems.length ? [{ title: 'Registration data is incomplete', detail: `Add ${missingItems.join(', ')} before check-in.`, severity: 'warning' }] : []}
      />
      {renderPatientDetails(patient)}
    </div>
  )
}

const patientsCrudConfig: CrudPageConfig<
  Patient,
  PatientFormValues,
  PatientCreatePayload,
  PatientUpdatePayload,
  PatientBulkDeletePayload
> = {
  title: 'Patients',
  resourceName: 'Patient',
  createButtonLabel: 'Add Patient',
  createDialogTitle: 'Add patient',
  editDialogTitle: 'Edit patient',
  viewDialogTitle: 'Patient details',
  deleteDialogTitle: 'Delete patient?',
  emptyMessage: 'No patients found.',
  exportFileName: 'patients',
  pageSizeOptions: [10, 20, 50],
  defaultQuery: {
    page: 1,
    limit: 20,
    sortfield: 'updated',
    direction: 'desc',
    criteria: [],
  },
  permissions: {
    module: 'Patients',
  },
  getRowId: (patient) => patient._id,
  getRowLabel: (patient) => `${patient.firstName} ${patient.lastName}`,
  table: {
    columns: patientTableColumns,
  },
  form: patientFormConfig,
  api: {
    useListQuery: useGetPatientsQuery,
    useCreateMutation: useCreatePatientMutation,
    useUpdateMutation: useUpdatePatientMutation,
  },
  mapItemToFormValues: mapPatientToFormValues,
  mapFormValuesToCreatePayload: mapPatientFormToPayload,
  mapFormValuesToUpdatePayload: (values) => mapPatientFormToPayload(values),
  slots: {
    viewContent: renderPatientWorkflowDetails,
    gridItem: renderPatientGridItem,
  },
}

export function PatientsPage() {
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const filteredConfig = useMemo<CrudPageConfig<
    Patient,
    PatientFormValues,
    PatientCreatePayload,
    PatientUpdatePayload,
    PatientBulkDeletePayload
  >>(() => {
    const selectedPatientId = workflowContext.patientId || workflowContext.dashboardEntityId

    return {
      ...patientsCrudConfig,
      defaultQuery: {
        ...patientsCrudConfig.defaultQuery,
        criteria: selectedPatientId
          ? [{ key: '_id', value: selectedPatientId, type: 'equals' as const }]
          : patientsCrudConfig.defaultQuery?.criteria ?? [],
      },
    }
  }, [workflowContext.dashboardEntityId, workflowContext.patientId])

  return <CrudPage key={workflowKey || 'patients'} config={filteredConfig} />
}
