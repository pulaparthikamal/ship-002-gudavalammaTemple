import { useMemo } from 'react'
import { CrudPage } from '@/components/crud/CrudPage'
import { RcmViewSummary, type RcmSummarySeverity } from '@/components/rcm/RcmViewSummary'
import type { CrudPageConfig } from '@/types/crud'
import { createReferralFormConfig, createReferralTableColumns, mapReferralFormToPayload, mapReferralToFormValues, renderReferralDetails, renderReferralGridItem } from '@/models/referralModel'
import { useBulkDeleteReferralsMutation, useCreateReferralMutation, useDeleteReferralMutation, useGetReferralsQuery, useUpdateReferralMutation } from '@/services/api/endpoints/referralsApi'
import { useGetAppointmentsQuery } from '@/services/api/endpoints/appointmentsApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { useGetPayersQuery } from '@/services/api/endpoints/payersApi'
import { useGetProvidersQuery } from '@/services/api/endpoints/providersApi'
import type { EntityId } from '@/types/common'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Referral, ReferralCreatePayload, ReferralFormValues, ReferralUpdatePayload } from '@/types/referral'

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

function getReferralSeverity(item: Referral): RcmSummarySeverity {
  const status = item.referralStatus?.toLowerCase()

  if (status && ['denied', 'cancelled', 'canceled', 'expired', 'closed'].includes(status)) {
    return 'danger'
  }

  if (typeof item.remainingVisits === 'number' && item.remainingVisits <= 0) {
    return 'danger'
  }

  if (item.referralNumber) {
    return 'success'
  }

  return 'warning'
}

export function ReferralsPage() {
  const appointmentsQuery = useGetAppointmentsQuery(lookupQuery)
  const patientsQuery = useGetPatientsQuery(lookupQuery)
  const payersQuery = useGetPayersQuery(lookupQuery)
  const providersQuery = useGetProvidersQuery(lookupQuery)

  const appointmentsOptions = useMemo(
    () =>
      (appointmentsQuery.data?.data ?? []).map((item) => ({
        label: [item.appointmentDate, item.appointmentTime, item.appointmentStatus].filter(Boolean).join(' ') || item._id,
        value: item._id,
      })),
    [appointmentsQuery.data],
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
      patients: patientsOptions,
      payers: payersOptions,
      providers: providersOptions,
    }),
    [appointmentsOptions, patientsOptions, payersOptions, providersOptions],
  )

  const crudConfig: CrudPageConfig<
    Referral,
    ReferralFormValues,
    ReferralCreatePayload,
    ReferralUpdatePayload,
    BulkDeletePayload
  > = useMemo(
    () => ({
      title: 'Referrals',
      resourceName: 'Referral',
      createButtonLabel: 'Add Referral',
      createDialogTitle: 'Add referral',
      editDialogTitle: 'Edit referral',
      viewDialogTitle: 'Referral details',
      deleteDialogTitle: 'Delete referral?',
      emptyMessage: 'No referrals found.',
      exportFileName: 'referrals',
      pageSizeOptions: [10, 20, 50],
      defaultQuery: {
        page: 1,
        limit: 20,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      },
      permissions: {
        module: 'referrals',
      },
      getRowId: (item) => item._id,
      getRowLabel: (item) => renderReferralGridItem(item, referenceOptions) ? String(item._id) : String(item._id),
      table: {
        columns: createReferralTableColumns(referenceOptions),
      },
      form: createReferralFormConfig(referenceOptions),
      api: {
        useBulkDeleteMutation: useBulkDeleteReferralsMutation,
        useListQuery: useGetReferralsQuery,
        useCreateMutation: useCreateReferralMutation,
        useUpdateMutation: useUpdateReferralMutation,
        useDeleteMutation: useDeleteReferralMutation,
      },
      mapItemToFormValues: mapReferralToFormValues,
      mapFormValuesToCreatePayload: mapReferralFormToPayload,
      mapFormValuesToUpdatePayload: (values) => mapReferralFormToPayload(values),
      bulkDelete: {
        buttonLabel: 'Delete Selected',
        confirmTitle: 'Delete selected referrals?',
        confirmLabel: 'Delete Selected',
        confirmMessage: (items) =>
          `This will permanently delete ${items.length} selected ${items.length === 1 ? 'referral' : 'referrals'}.`,
        successMessage: (items) =>
          `${items.length} ${items.length === 1 ? 'referral' : 'referrals'} deleted successfully.`,
        mapSelectedItemsToPayload: (items) => ({
          ids: items.map((item) => item._id),
        }),
      },
      deleteDialogMessage: (item) => `This will permanently delete ${item._id}.`,
      slots: {
        viewContent: (item) => (
          <div className="space-y-5">
            <RcmViewSummary
              title="Referral workflow"
              subtitle="Shows whether referral requirements are satisfied before check-in and claim submission."
              status={item.referralStatus || '-'}
              severity={getReferralSeverity(item)}
              facts={[
                ['Patient', referenceOptions.patients?.find((option) => option.value === item.patientId)?.label ?? item.patientId ?? '-'],
                ['Payer', referenceOptions.payers?.find((option) => option.value === item.payerId)?.label ?? item.payerId ?? '-'],
                ['Referral #', item.referralNumber ?? '-'],
              ]}
              journey={[
                {
                  label: 'Referral identity',
                  status: item.referralNumber ? 'Captured' : 'Missing',
                  detail: item.referralType || 'Referral type not captured.',
                  severity: item.referralNumber ? 'success' : 'danger',
                },
                {
                  label: 'Validity',
                  status: item.referralStatus ?? '-',
                  detail: [item.startDate ? new Date(item.startDate).toLocaleDateString() : null, item.endDate ? new Date(item.endDate).toLocaleDateString() : null].filter(Boolean).join(' - ') || 'No valid date range captured.',
                  severity: getReferralSeverity(item),
                },
                {
                  label: 'Visits',
                  status: typeof item.remainingVisits === 'number' ? `${item.remainingVisits} remaining` : 'Not tracked',
                  detail: `${item.usedVisits ?? 0} used of ${item.approvedVisits ?? 0} approved.`,
                  severity: typeof item.remainingVisits === 'number' && item.remainingVisits <= 0 ? 'danger' : 'success',
                },
                {
                  label: 'Next handoff',
                  status: getReferralSeverity(item) === 'success' ? 'Check-in ready' : 'Resolve referral',
                  detail: getReferralSeverity(item) === 'success' ? 'Referral can support the appointment and claim.' : 'Capture valid referral number, dates, and visit count.',
                  severity: getReferralSeverity(item) === 'success' ? 'success' : 'warning',
                },
              ]}
            />
            {renderReferralDetails(item, referenceOptions)}
          </div>
        ),
        gridItem: (item) => renderReferralGridItem(item, referenceOptions),
      },
    }),
    [referenceOptions],
  )

  return <CrudPage config={crudConfig} />
}
