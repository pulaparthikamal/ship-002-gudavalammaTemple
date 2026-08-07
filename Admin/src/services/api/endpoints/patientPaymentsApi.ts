import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { patientPaymentApiDetails } from '@/models/patientPaymentModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { PatientPayment, PatientPaymentCreatePayload, PatientPaymentUpdatePayload } from '@/types/patientPayment'

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

function normalizePatientPayment(response: unknown): PatientPayment | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    patientPaymentId:
      typeof item.patientPaymentId === 'string'
        ? item.patientPaymentId
        : typeof item.patientPaymentId === 'object' && item.patientPaymentId !== null && '_id' in item.patientPaymentId
          ? String((item.patientPaymentId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    patientBillingId: normalizeOptionalString(item.patientBillingId),
    claimId: normalizeOptionalString(item.claimId),
    claimLineId: normalizeOptionalString(item.claimLineId),
    paymentDate: normalizeDateString(item.paymentDate),
    paymentMethod: normalizeOptionalString(item.paymentMethod),
    amount: normalizeOptionalNumber(item.amount),
    appliedAmount: normalizeOptionalNumber(item.appliedAmount),
    overpaymentAmount: normalizeOptionalNumber(item.overpaymentAmount),
    referenceNumber: normalizeOptionalString(item.referenceNumber),
    receiptNumber: normalizeOptionalString(item.receiptNumber),
    receiptMetadata:
      typeof item.receiptMetadata === 'object' && item.receiptMetadata !== null
        ? (item.receiptMetadata as Record<string, unknown>)
        : undefined,
    paymentStatus: normalizeOptionalString(item.paymentStatus),
    collectedAtFrontDesk: Boolean(item.collectedAtFrontDesk),
    notes: normalizeOptionalString(item.notes),
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

const patientPaymentListDataPaths = [patientPaymentApiDetails.responseDataPath, 'data.data', 'items']
const patientPaymentListTotalPaths = [
  patientPaymentApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePatientPaymentListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<PatientPayment> {
  return normalizeCrudListResponse<unknown, PatientPayment>({
    response,
    query,
    dataPaths: patientPaymentListDataPaths,
    totalPaths: patientPaymentListTotalPaths,
    mapItem: normalizePatientPayment,
  })
}

export const patientPaymentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPatientPayments: builder.query<CrudListResponse<PatientPayment>, CrudListQuery>({
      query: (query) => ({
        url: patientPaymentApiDetails.endpoint,
        method: 'GET',
        params: {
          [patientPaymentApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizePatientPaymentListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'PatientPayment' as const, id: item._id })),
              { type: 'PatientPayment' as const, id: 'LIST' },
            ]
          : [{ type: 'PatientPayment' as const, id: 'LIST' }],
    }),
    getPatientPayment: builder.query<PatientPayment, EntityId>({
      query: (id) => ({
        url: `${patientPaymentApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientPayment(readResponsePath<unknown>(response, patientPaymentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Payment response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'PatientPayment', id }],
    }),
    createPatientPayment: builder.mutation<PatientPayment, PatientPaymentCreatePayload>({
      query: (payload) => ({
        url: patientPaymentApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientPayment(readResponsePath<unknown>(response, patientPaymentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Payment response is invalid.')
        }

        return item
      },
      invalidatesTags: [
        { type: 'PatientPayment', id: 'LIST' },
        { type: 'PatientBilling', id: 'LIST' },
        { type: 'Refund', id: 'LIST' },
        { type: 'Collection', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    updatePatientPayment: builder.mutation<PatientPayment, { id: EntityId; data: PatientPaymentUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${patientPaymentApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePatientPayment(readResponsePath<unknown>(response, patientPaymentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Patient Payment response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PatientPayment', id },
        { type: 'PatientPayment', id: 'LIST' },
      ],
    }),
    deletePatientPayment: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${patientPaymentApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'PatientPayment', id },
        { type: 'PatientPayment', id: 'LIST' },
      ],
    }),
    bulkDeletePatientPayments: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${patientPaymentApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'PatientPayment' as const, id })),
        { type: 'PatientPayment' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeletePatientPaymentsMutation,
  useCreatePatientPaymentMutation,
  useDeletePatientPaymentMutation,
  useGetPatientPaymentQuery,
  useGetPatientPaymentsQuery,
  useUpdatePatientPaymentMutation,
} = patientPaymentsApi
