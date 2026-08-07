import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Send, RefreshCw } from 'lucide-react'
import { CrudPage } from '@/components/crud/CrudPage'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import type { CrudPageConfig, CrudTableAction } from '@/types/crud'
import { createPriorAuthorizationFormConfig, createPriorAuthorizationTableColumns, mapPriorAuthorizationFormToPayload, mapPriorAuthorizationToFormValues, renderPriorAuthorizationDetails, renderPriorAuthorizationGridItem } from '@/models/priorAuthorizationModel'
import { useBulkDeletePriorAuthorizationsMutation, useCheckPriorAuthorizationPayerStatusMutation, useCreatePriorAuthorizationMutation, useDeletePriorAuthorizationMutation, useGeneratePriorAuthorizationPacketMutation, useGetPriorAuthorizationsQuery, useSubmitPriorAuthorizationPacketMutation, useUpdatePriorAuthorizationMutation } from '@/services/api/endpoints/priorAuthorizationsApi'
import { useGetFacilitiesQuery } from '@/services/api/endpoints/facilitiesApi'
import { useGetInsurancePoliciesQuery } from '@/services/api/endpoints/insurancePoliciesApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PriorAuthorization, PriorAuthorizationCreatePayload, PriorAuthorizationFormValues, PriorAuthorizationUpdatePayload } from '@/types/priorAuthorization'
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

function getAuthorizationSeverity(item: PriorAuthorization): RcmSummarySeverity {
  const status = item.authorizationStatus?.toLowerCase()

  if (status && ['approved', 'authorized', 'certified'].includes(status)) {
    return 'success'
  }

  if (status && ['denied', 'cancelled', 'canceled', 'expired'].includes(status)) {
    return 'danger'
  }

  return item.authorizationRequired ? 'warning' : 'neutral'
}

export function PriorAuthorizationsPage() {
  const [searchParams] = useSearchParams()
  const workflowContext = useMemo(() => readWorkflowContext(searchParams), [searchParams])
  const workflowKey = searchParams.toString()
  const facilitiesQuery = useGetFacilitiesQuery(lookupQuery)
  const insurancePoliciesQuery = useGetInsurancePoliciesQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)
  const [generatePacket] = useGeneratePriorAuthorizationPacketMutation()
  const [submitPacket] = useSubmitPriorAuthorizationPacketMutation()
  const [checkPayerStatus] = useCheckPriorAuthorizationPayerStatusMutation()

  const facilitiesOptions = useMemo(
    () =>
      (facilitiesQuery.data?.data ?? []).map((item) => ({
        label: item.facilityName || item.facilityCode || item._id,
        value: item._id,
      })),
    [facilitiesQuery.data],
  )
  const insurancePoliciesOptions = useMemo(
    () =>
      (insurancePoliciesQuery.data?.data ?? []).map((item) => ({
        label: item.planName || item.memberId || item._id,
        value: item._id,
      })),
    [insurancePoliciesQuery.data],
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
      facilities: facilitiesOptions,
      insurancePolicies: insurancePoliciesOptions,
      patients: patientsOptions,
      payers: payersOptions,
      providers: providersOptions,
    }),
    [facilitiesOptions, insurancePoliciesOptions, patientsOptions, payersOptions, providersOptions],
  )

  const crudConfig: CrudPageConfig<
    PriorAuthorization,
    PriorAuthorizationFormValues,
    PriorAuthorizationCreatePayload,
    PriorAuthorizationUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Prior Authorizations',
      resourceName: 'Prior Authorization',
      createButtonLabel: 'Add Prior Authorization',
      createDialogTitle: 'Add prior authorization',
      editDialogTitle: 'Edit prior authorization',
      viewDialogTitle: 'Prior Authorization details',
      deleteDialogTitle: 'Delete prior authorization?',
      emptyMessage: 'No prior authorizations found.',
      exportFileName: 'prior-authorizations',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: buildWorkflowCriteria('priorAuthorization', workflowContext),
        dashboardQueue: workflowContext.dashboardQueue,
        dashboardEntityId: workflowContext.dashboardEntityId,
      },
      permissions: {
        module: 'prior-authorizations',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderPriorAuthorizationGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createPriorAuthorizationTableColumns(referenceOptions),
      },
      form: createPriorAuthorizationFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeletePriorAuthorizationsMutation,
        useListQuery: useGetPriorAuthorizationsQuery,
        useCreateMutation: useCreatePriorAuthorizationMutation,
        useUpdateMutation: useUpdatePriorAuthorizationMutation,
        useDeleteMutation: useDeletePriorAuthorizationMutation,
      },
      mapItemToFormValues: mapPriorAuthorizationToFormValues,
      mapFormValuesToCreatePayload: mapPriorAuthorizationFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapPriorAuthorizationFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected prior authorizations?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'prior authorization' : 'prior authorizations'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'prior authorization' : 'prior authorizations'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => (
          <div className="space-y-5">
            <RcmViewSummary
              title="Prior authorization workflow"
              subtitle="Shows whether the payer authorization gate is cleared for appointment and claim submission."
              status={item.authorizationStatus || (item.authorizationRequired ? 'Required' : 'Not required')}
              severity={getAuthorizationSeverity(item)}
              facts={[
                ['Patient', referenceOptions.patients?.find((option) => option.value === item.patientId)?.label ?? item.patientId ?? '-'],
                ['Payer', referenceOptions.payers?.find((option) => option.value === item.payerId)?.label ?? item.payerId ?? '-'],
                ['Auth #', item.authNumber ?? '-'],
              ]}
              journey={[
                {
                  label: 'Requirement',
                  status: item.authorizationRequired ? 'Required' : 'Not required',
                  detail: [item.authorizationType, item.placeOfService].filter(Boolean).join(' / ') || 'No authorization type captured.',
                  severity: item.authorizationRequired ? 'warning' : 'success',
                },
                {
                  label: 'Packet',
                  status: item.authPacket ? 'Generated' : 'Not generated',
                  detail: item.payerPortalReference || 'Generate packet before payer submission.',
                  severity: item.authPacket ? 'success' : 'warning',
                },
                {
                  label: 'Payer outcome',
                  status: item.authorizationStatus ?? '-',
                  detail: item.denialReason || `${item.approvedUnits ?? 0} of ${item.requestedUnits ?? 0} units approved.`,
                  severity: getAuthorizationSeverity(item),
                },
                {
                  label: 'Next handoff',
                  status: getAuthorizationSeverity(item) === 'success' ? 'Check-in/claim ready' : 'Follow up',
                  detail: getAuthorizationSeverity(item) === 'success' ? 'Auth number and approved window can support check-in and claim validation.' : 'Submit packet, poll status, or resolve denial.',
                  severity: getAuthorizationSeverity(item) === 'success' ? 'success' : 'warning',
                },
              ]}
              alerts={item.denialReason ? [{ title: 'Authorization denial', detail: item.denialReason, severity: 'danger' }] : []}
            />
            {renderPriorAuthorizationDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderPriorAuthorizationGridItem(item, referenceOptions),
        rowActions: (item, defaultActions): Array<CrudTableAction<PriorAuthorization>> => [
          {
            label: 'Generate Auth Packet',
            icon: <ClipboardCheck className="h-4 w-4" aria-hidden="true" />,
            onClick: async () => {
              await generatePacket(item._id).unwrap()
            },
          },
          {
            label: 'Submit Packet',
            icon: <Send className="h-4 w-4" aria-hidden="true" />,
            onClick: async () => {
              await submitPacket(item._id).unwrap()
            },
          },
          {
            label: 'Check Payer Status',
            icon: <RefreshCw className="h-4 w-4" aria-hidden="true" />,
            onClick: async () => {
              await checkPayerStatus(item._id).unwrap()
            },
          },
          ...defaultActions,
        ],
      },
    }),
    [checkPayerStatus, generatePacket, referenceOptions, submitPacket, workflowContext],
  )

  return <CrudPage key={workflowKey || 'prior-authorizations'} config={crudConfig} />
}
