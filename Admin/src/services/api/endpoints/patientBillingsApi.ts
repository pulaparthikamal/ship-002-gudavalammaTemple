import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { patientBillingApiDetails } from '@/models/patientBillingModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { PatientBilling, PatientBillingCreatePayload, PatientBillingUpdatePayload } from '@/types/patientBilling'

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function normalizePatientBilling(response: unknown): PatientBilling | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    patientBillingId:
      typeof item.patientBillingId === 'string'
        ? item.patientBillingId
        : typeof item.patientBillingId === 'object' && item.patientBillingId !== null && '_id' in item.patientBillingId
          ? String((item.patientBillingId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    chargeId: normalizeOptionalString(item.chargeId),
    encounterId: normalizeOptionalString(item.encounterId),
    claimId: normalizeOptionalString(item.claimId),
    paymentPostingId: normalizeOptionalString(item.paymentPostingId),
    statementNumber: normalizeOptionalString(item.statementNumber),
    statementDate: normalizeDateString(item.statementDate),
    statementCycle: normalizeOptionalString(item.statementCycle),
    billingCycle: normalizeOptionalString(item.billingCycle),
    originalBalance: normalizeOptionalNumber(item.originalBalance),
    currentBalance: normalizeOptionalNumber(item.currentBalance),
    insurancePaid: normalizeOptionalNumber(item.insurancePaid),
    adjustments: normalizeOptionalNumber(item.adjustments),
    patientPayments: normalizeOptionalNumber(item.patientPayments),
    patientBalance: normalizeOptionalNumber(item.patientBalance),
    amountPaid: normalizeOptionalNumber(item.amountPaid),
    amountDue: normalizeOptionalNumber(item.amountDue),
    dueDate: normalizeDateString(item.dueDate),
    lastStatementSent: normalizeDateString(item.lastStatementSent),
    collectionsFlag: Boolean(item.collectionsFlag),
    writeOffFlag: Boolean(item.writeOffFlag),
    refundFlag: Boolean(item.refundFlag),
    refundAmount: normalizeOptionalNumber(item.refundAmount),
    creditBalanceAmount: normalizeOptionalNumber(item.creditBalanceAmount),
    paymentPlanId: normalizeOptionalString(item.paymentPlanId),
    statementStatus: normalizeOptionalString(item.statementStatus),
    status: normalizeOptionalString(item.status),
    agingBucket: normalizeOptionalString(item.agingBucket),
    lineItems: Array.isArray(item.lineItems)
      ? item.lineItems
          .filter((child): child is Record<string, unknown> => typeof child === 'object' && child !== null)
          .map((child) => ({
            claimLineId: normalizeOptionalString(child.claimLineId),
            procedureCode: normalizeOptionalString(child.procedureCode),
            serviceDate: normalizeDateString(child.serviceDate),
            description: normalizeOptionalString(child.description),
            allowedAmount: normalizeOptionalNumber(child.allowedAmount),
            insurancePaid: normalizeOptionalNumber(child.insurancePaid),
            adjustments: normalizeOptionalNumber(child.adjustments),
            patientResponsibility: normalizeOptionalNumber(child.patientResponsibility),
          }))
      : [],
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt:
      normalizeDateString(item.createdAt) ??
      normalizeDateString(item.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(item.updatedAt) ??
      normalizeDateString(item.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const patientBillingListDataPaths = [patientBillingApiDetails.responseDataPath, 'data.data', 'items']
const patientBillingListTotalPaths = [
  patientBillingApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePatientBillingListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<PatientBilling> {
  return normalizeCrudListResponse<unknown, PatientBilling>({
    response,
    query,
    dataPaths: patientBillingListDataPaths,
    totalPaths: patientBillingListTotalPaths,
    mapItem: normalizePatientBilling,
  })
}

export const patientBillingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPatientBillings: builder.query<CrudListResponse<PatientBilling>, CrudListQuery>({
      query: (query) => ({
        url: patientBillingApiDetails.endpoint,
        method: 'GET',
        params: {
          [patientBillingApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizePatientBillingListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'PatientBilling' as const, id: item._id })),
              { type: 'PatientBilling' as const, id: 'LIST' },
            ]
          : [{ type: 'PatientBilling' as const, id: 'LIST' }],
    }),
    getPatientBilling: builder.query<PatientBilling, EntityId>({
      query: (id) => ({
        url: `${patientBillingApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientBilling(readResponsePath<unknown>(response, patientBillingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Billing response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'PatientBilling', id }],
    }),
    createPatientBilling: builder.mutation<PatientBilling, PatientBillingCreatePayload>({
      query: (payload) => ({
        url: patientBillingApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientBilling(readResponsePath<unknown>(response, patientBillingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Billing response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'PatientBilling', id: 'LIST' }],
    }),
    updatePatientBilling: builder.mutation<PatientBilling, { id: EntityId; data: PatientBillingUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${patientBillingApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientBilling(readResponsePath<unknown>(response, patientBillingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Billing response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PatientBilling', id },
        { type: 'PatientBilling', id: 'LIST' },
      ],
    }),
    deletePatientBilling: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${patientBillingApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'PatientBilling', id },
        { type: 'PatientBilling', id: 'LIST' },
      ],
    }),
    bulkDeletePatientBillings: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${patientBillingApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'PatientBilling' as const, id })),
        { type: 'PatientBilling' as const, id: 'LIST' },
      ],
    }),
    createPatientBillingFromPaymentPosting: builder.mutation<PatientBilling | null, EntityId>({
      query: (paymentPostingId) => ({
        url: `${patientBillingApiDetails.endpoint}/from-payment-posting/${paymentPostingId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => normalizePatientBilling(readResponsePath<unknown>(response, patientBillingApiDetails.responseDataPath)),
      invalidatesTags: [{ type: 'PatientBilling', id: 'LIST' }],
    }),
    runPatientBillingAction: builder.mutation<PatientBilling, { id: EntityId; action: string; data?: Record<string, unknown> }>({
      query: ({ id, action, data }) => ({
        url: `${patientBillingApiDetails.endpoint}/${id}/actions/${action}`,
        method: 'POST',
        data: data ?? {},
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientBilling(readResponsePath<unknown>(response, patientBillingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Billing response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PatientBilling', id },
        { type: 'PatientBilling', id: 'LIST' },
        { type: 'Collection', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeletePatientBillingsMutation,
  useCreatePatientBillingMutation,
  useCreatePatientBillingFromPaymentPostingMutation,
  useDeletePatientBillingMutation,
  useGetPatientBillingQuery,
  useGetPatientBillingsQuery,
  useRunPatientBillingActionMutation,
  useUpdatePatientBillingMutation,
} = patientBillingsApi
