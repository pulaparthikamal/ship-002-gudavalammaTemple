import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { refundApiDetails } from '@/models/refundModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Refund, RefundCreatePayload, RefundUpdatePayload } from '@/types/refund'

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

function normalizeRefund(response: unknown): Refund | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    refundId:
      typeof item.refundId === 'string'
        ? item.refundId
        : typeof item.refundId === 'object' && item.refundId !== null && '_id' in item.refundId
          ? String((item.refundId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    claimId: normalizeOptionalString(item.claimId),
    patientBillingId: normalizeOptionalString(item.patientBillingId),
    patientPaymentId: normalizeOptionalString(item.patientPaymentId),
    refundType: normalizeOptionalString(item.refundType),
    refundReason: normalizeOptionalString(item.refundReason),
    refundAmount: normalizeOptionalNumber(item.refundAmount),
    refundMethod: normalizeOptionalString(item.refundMethod),
    requestedDate: normalizeDateString(item.requestedDate),
    approvedDate: normalizeDateString(item.approvedDate),
    processedDate: normalizeDateString(item.processedDate),
    refundStatus: normalizeOptionalString(item.refundStatus),
    approvedBy: normalizeOptionalString(item.approvedBy),
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

const refundListDataPaths = [refundApiDetails.responseDataPath, 'data.data', 'items']
const refundListTotalPaths = [
  refundApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeRefundListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Refund> {
  return normalizeCrudListResponse<unknown, Refund>({
    response,
    query,
    dataPaths: refundListDataPaths,
    totalPaths: refundListTotalPaths,
    mapItem: normalizeRefund,
  })
}

export const refundsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRefunds: builder.query<CrudListResponse<Refund>, CrudListQuery>({
      query: (query) => ({
        url: refundApiDetails.endpoint,
        method: 'GET',
        params: {
          [refundApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeRefundListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Refund' as const, id: item._id })),
              { type: 'Refund' as const, id: 'LIST' },
            ]
          : [{ type: 'Refund' as const, id: 'LIST' }],
    }),
    getRefund: builder.query<Refund, EntityId>({
      query: (id) => ({
        url: `${refundApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeRefund(readResponsePath<unknown>(response, refundApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Refund response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Refund', id }],
    }),
    createRefund: builder.mutation<Refund, RefundCreatePayload>({
      query: (payload) => ({
        url: refundApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeRefund(readResponsePath<unknown>(response, refundApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Refund response is invalid.')
        }

        return item
      },
      invalidatesTags: [
        { type: 'Refund', id: 'LIST' },
        { type: 'PatientBilling', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    updateRefund: builder.mutation<Refund, { id: EntityId; data: RefundUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${refundApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeRefund(readResponsePath<unknown>(response, refundApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Refund response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Refund', id },
        { type: 'Refund', id: 'LIST' },
      ],
    }),
    deleteRefund: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${refundApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Refund', id },
        { type: 'Refund', id: 'LIST' },
      ],
    }),
    bulkDeleteRefunds: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${refundApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Refund' as const, id })),
        { type: 'Refund' as const, id: 'LIST' },
      ],
    }),
    runRefundAction: builder.mutation<Refund, { id: EntityId; action: string; data: { reason: string; notes?: string } }>({
      query: ({ id, action, data }) => ({
        url: `${refundApiDetails.endpoint}/${id}/actions/${action}`,
        method: 'POST',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeRefund(readResponsePath<unknown>(response, refundApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Refund response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Refund', id },
        { type: 'Refund', id: 'LIST' },
        { type: 'PatientBilling', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteRefundsMutation,
  useCreateRefundMutation,
  useDeleteRefundMutation,
  useGetRefundQuery,
  useGetRefundsQuery,
  useRunRefundActionMutation,
  useUpdateRefundMutation,
} = refundsApi
