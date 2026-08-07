import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CrudPage } from '@/components/crud/CrudPage'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import type { CrudPageConfig } from '@/types/crud'
import { createInsurancePolicyFormConfig, createInsurancePolicyTableColumns, mapInsurancePolicyFormToPayload, mapInsurancePolicyToFormValues, renderInsurancePolicyDetails, renderInsurancePolicyGridItem } from '@/models/insurancePolicyModel'
import { useCreateInsurancePolicyMutation, useGetInsurancePoliciesQuery, useUpdateInsurancePolicyMutation } from '@/services/api/endpoints/insurancePoliciesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { InsurancePolicy, InsurancePolicyCreatePayload, InsurancePolicyFormValues, InsurancePolicyUpdatePayload } from '@/types/insurancePolicy'
import { buildWorkflowCriteria, readWorkflowContext } from '@/utils/rcmWorkflow'

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

function getPolicySeverity(item: InsurancePolicy): RcmSummarySeverity {
  if (!item.active || ['Inactive', 'Terminated', 'Cancelled', 'Canceled'].includes(item.policyStatus ?? '')) {
    return 'danger'
  }

  if (!item.insuranceVerifiedFlag || item.dependentValidation?.status === 'Mismatch') {
    return 'warning'
  }

  return 'success'
}

export function InsurancePoliciesPage() {
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)

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

  const referenceOptions: RcmReferenceOptions = useMemo(
    () => ({
      patients: patientsOptions,
      payers: payersOptions,
    }),
    [patientsOptions, payersOptions],
  )

  const crudConfig: CrudPageConfig<
    InsurancePolicy,
    InsurancePolicyFormValues,
    InsurancePolicyCreatePayload,
    InsurancePolicyUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Insurance Policies',
      resourceName: 'Insurance Policy',
      createButtonLabel: 'Add Insurance Policy',
      createDialogTitle: 'Add insurance policy',
      editDialogTitle: 'Edit insurance policy',
      viewDialogTitle: 'Insurance Policy details',
      deleteDialogTitle: 'Delete insurance policy?',
      emptyMessage: 'No insurance policies found.',
      exportFileName: 'insurance-policies',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('insurancePolicy', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'insurance-policies',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => [item.planName, item.memberId].filter(Boolean).join(' / ') || String(item._id),
      table: {
        columns: createInsurancePolicyTableColumns(referenceOptions),
      },
      form: createInsurancePolicyFormConfig(referenceOptions),
      api: {
        useListQuery: useGetInsurancePoliciesQuery,
        useCreateMutation: useCreateInsurancePolicyMutation,
        useUpdateMutation: useUpdateInsurancePolicyMutation,
      },
      mapItemToFormValues: mapInsurancePolicyToFormValues,
      mapFormValuesToCreatePayload: mapInsurancePolicyFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapInsurancePolicyFormToPayload(values),
      slots: {
        viewContent: (item) => (
          <div className="space-y-5">
            <RcmViewSummary
              title="Insurance policy workflow"
              subtitle="Checks coverage identity, subscriber relationship, and verification readiness."
              status={item.policyStatus || item.coverageType || '-'}
              severity={getPolicySeverity(item)}
              facts={[
                ['Patient', referenceOptions.patients?.find((option) => option.value === item.patientId)?.label ?? item.patientId ?? '-'],
                ['Payer', referenceOptions.payers?.find((option) => option.value === item.payerId)?.label ?? item.payerId ?? '-'],
                ['Member', item.memberId ?? item.subscriberId ?? '-'],
              ]}
              journey={[
                {
                  label: 'Coverage',
                  status: item.active ? item.policyStatus || 'Active' : 'Inactive',
                  detail: [item.coveragePriority, item.coverageType, item.network].filter(Boolean).join(' / ') || 'Coverage details not completed.',
                  severity: item.active ? 'success' : 'danger',
                },
                {
                  label: 'Subscriber',
                  status: item.relationshipToSubscriber || '-',
                  detail: item.relationshipToSubscriber === 'Self' ? 'Patient is subscriber.' : 'Subscriber/dependent details must match payer records.',
                  severity: item.relationshipToSubscriber === 'Self' || item.dependentValidation?.status === 'Passed' ? 'success' : 'warning',
                },
                {
                  label: 'Card and payer',
                  status: item.ediPayerId ? 'EDI ready' : 'Needs EDI payer',
                  detail: item.card?.frontImageUrl || item.card?.backImageUrl ? 'Insurance card image is captured.' : 'Insurance card image is not captured.',
                  severity: item.ediPayerId ? 'success' : 'warning',
                },
                {
                  label: 'Next handoff',
                  status: item.insuranceVerifiedFlag ? 'Eligibility' : 'Verify',
                  detail: item.insuranceVerifiedFlag ? 'Run or review eligibility before check-in.' : 'Verify coverage before scheduling/check-in.',
                  severity: item.insuranceVerifiedFlag ? 'warning' : 'danger',
                },
              ]}
              alerts={[
                ...(item.dependentValidation?.issues ?? []).map((issue) => ({ title: 'Dependent validation issue', detail: issue, severity: 'warning' as const })),
                ...(!item.ediPayerId ? [{ title: 'EDI payer ID missing', detail: 'Electronic claim submission will be blocked until payer routing is configured.', severity: 'warning' as const }] : []),
              ]}
            />
            {renderInsurancePolicyDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderInsurancePolicyGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions, workflowContext],
  )

  return <CrudPage key={workflowKey || 'insurance-policies'} config={crudConfig} />
}
