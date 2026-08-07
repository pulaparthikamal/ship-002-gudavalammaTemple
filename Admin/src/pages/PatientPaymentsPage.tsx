import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CrudPage } from '@/components/crud/CrudPage'
import type { CrudPageConfig } from '@/types/crud'
import { createPatientPaymentFormConfig, createPatientPaymentTableColumns, mapPatientPaymentFormToPayload, mapPatientPaymentToFormValues, renderPatientPaymentDetails, renderPatientPaymentGridItem } from '@/models/patientPaymentModel'
import { useCreatePatientPaymentMutation, useGetPatientPaymentsQuery } from '@/services/api/endpoints/patientPaymentsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPatientBillingsQuery } from '@/services/api/endpoints/patientBillingsApi'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PatientPayment, PatientPaymentCreatePayload, PatientPaymentFormValues, PatientPaymentUpdatePayload } from '@/types/patientPayment'
import { readWorkflowContext } from '@/utils/rcmWorkflow'

const lookupQuery = {
  page: 1,
  limit: 100,
  sortfield: 'updated',
  direction: 'desc' as const,
  criteria: [],
}

export function PatientPaymentsPage() {
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const patientBillingsQuery = useGetPatientBillingsQuery(lookupQuery)

  const patientsOptions = useMemo(
    () =>
      (patientsQuery.data?.data ?? []).map((item) => ({
        label: `${item.firstName} ${item.lastName} (${item.medicalRecordNumber})`,
        value: item._id,
      })),
    [patientsQuery.data],
  )
  const patientBillingsOptions = useMemo(
    () =>
      (patientBillingsQuery.data?.data ?? []).map((item) => ({
        label: [item.statementDate, item.statementStatus, item.amountDue].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [patientBillingsQuery.data],
  )

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      patients: patientsOptions,
      patientBillings: patientBillingsOptions,
    }),
    [patientsOptions, patientBillingsOptions],
  )

  const crudConfig: CrudPageConfig<
    PatientPayment,
    PatientPaymentFormValues,
    PatientPaymentCreatePayload,
    PatientPaymentUpdatePayload
  > = useMemo(
    () => ({
      title: 'Patient Payments',
      resourceName: 'Patient Payment',
      createButtonLabel: 'Record Patient Payment',
      createDialogTitle: 'Record patient payment',
      editDialogTitle: 'Edit patient payment',
      viewDialogTitle: 'Patient payment details',
      deleteDialogTitle: 'Delete patient payment?',
      emptyMessage: 'No patient payments found.',
      exportFileName: 'patient-payments',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: workflowContext.patientBillingId
          ? [{ key: 'patientBillingId', value: workflowContext.patientBillingId, type: 'equals' }]
          : workflowContext.claimId
            ? [{ key: 'claimId', value: workflowContext.claimId, type: 'equals' }]
            : [],
      },
      permissions: {
        module: 'patient-payments',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderPatientPaymentGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createPatientPaymentTableColumns(referenceOptions),
      },
      form: createPatientPaymentFormConfig(referenceOptions),
      api: {
        useListQuery: useGetPatientPaymentsQuery,
        useCreateMutation: useCreatePatientPaymentMutation,
      },
      mapItemToFormValues: mapPatientPaymentToFormValues,
      mapFormValuesToCreatePayload: mapPatientPaymentFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapPatientPaymentFormToPayload(values),
      slots: {
        rowActions: (_item, defaultActions) =>
          defaultActions.filter((action) => typeof action.label === 'string' && action.label.startsWith('View ')),
        viewContent: (item) => renderPatientPaymentDetails(item, referenceOptions),
        gridItem: (item) => renderPatientPaymentGridItem(item, referenceOptions),
      },
      style: {
        formDialogWidth: 'min(96vw, 44rem)',
        viewDialogWidth: 'min(96vw, 52rem)',
      },
    }),
    [referenceOptions, workflowContext],
  )

  return <CrudPage key={workflowKey || 'patient-payments'} config={crudConfig} />
}
