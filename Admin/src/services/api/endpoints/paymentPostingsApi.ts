import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { paymentPostingApiDetails } from '@/models/paymentPostingModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { PaymentPosting, PaymentPostingCreatePayload, PaymentPostingReversePayload, PaymentPostingUpdatePayload } from '@/types/paymentPosting'

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

function normalizePaymentPosting(response: unknown): PaymentPosting | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    paymentId:
      typeof item.paymentId === 'string'
        ? item.paymentId
        : typeof item.paymentId === 'object' && item.paymentId !== null && '_id' in item.paymentId
          ? String((item.paymentId as { _id?: string })._id ?? '')
          : '',
    eraEobProcessingId: normalizeOptionalString(item.eraEobProcessingId),
    claimId: normalizeOptionalString(item.claimId),
    payerId: normalizeOptionalString(item.payerId),
    payerClaimNumber: normalizeOptionalString(item.payerClaimNumber),
    claimControlNumber: normalizeOptionalString(item.claimControlNumber),
    paymentDate: normalizeDateString(item.paymentDate),
    checkNumber: normalizeOptionalString(item.checkNumber),
    eftTraceNumber: normalizeOptionalString(item.eftTraceNumber),
    paymentMethod: normalizeOptionalString(item.paymentMethod),
    sourceType: normalizeOptionalString(item.sourceType),
    idempotencyKey: normalizeOptionalString(item.idempotencyKey),
    receivedAmount: normalizeOptionalNumber(item.receivedAmount),
    postedAmount: normalizeOptionalNumber(item.postedAmount),
    patientResponsibilityAmount: normalizeOptionalNumber(item.patientResponsibilityAmount),
    remainingBalance: normalizeOptionalNumber(item.remainingBalance),
    postingStatus: normalizeOptionalString(item.postingStatus),
    postedBy: normalizeOptionalString(item.postedBy),
    postedAt: normalizeDateString(item.postedAt),
    reversedAt: normalizeDateString(item.reversedAt),
    reversedBy: normalizeOptionalString(item.reversedBy),
    reversalReason: normalizeOptionalString(item.reversalReason),
    financialEventId: normalizeOptionalString(item.financialEventId),
    parentFinancialEventId: normalizeOptionalString(item.parentFinancialEventId),
    reversalOfId: normalizeOptionalString(item.reversalOfId),
    ledgerSequence: normalizeOptionalNumber(item.ledgerSequence),
    financialBalanceSnapshot: typeof item.financialBalanceSnapshot === 'object' && item.financialBalanceSnapshot !== null ? item.financialBalanceSnapshot as Record<string, unknown> : undefined,
    paymentLines: Array.isArray(item.paymentLines)
      ? item.paymentLines
          .filter((child): child is Record<string, unknown> => typeof child === 'object' && child !== null)
          .map((child) => ({
            claimLineId: normalizeOptionalString(child.claimLineId),
            serviceLineControlNumber: normalizeOptionalString(child.serviceLineControlNumber),
            procedureCode: normalizeOptionalString(child.procedureCode),
            serviceDate: normalizeDateString(child.serviceDate),
            billedAmount: normalizeOptionalNumber(child.billedAmount),
            paidAmount: normalizeOptionalNumber(child.paidAmount),
            allowedAmount: normalizeOptionalNumber(child.allowedAmount),
            adjustmentAmount: normalizeOptionalNumber(child.adjustmentAmount),
            patientRespAmount: normalizeOptionalNumber(child.patientRespAmount),
            deniedAmount: normalizeOptionalNumber(child.deniedAmount),
            adjustmentCodes: normalizeStringArray(child.adjustmentCodes),
            remarkCodes: normalizeStringArray(child.remarkCodes),
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

const paymentPostingListDataPaths = [paymentPostingApiDetails.responseDataPath, 'data.data', 'items']
const paymentPostingListTotalPaths = [
  paymentPostingApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePaymentPostingListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<PaymentPosting> {
  return normalizeCrudListResponse<unknown, PaymentPosting>({
    response,
    query,
    dataPaths: paymentPostingListDataPaths,
    totalPaths: paymentPostingListTotalPaths,
    mapItem: normalizePaymentPosting,
  })
}

export const paymentPostingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPaymentPostings: builder.query<CrudListResponse<PaymentPosting>, CrudListQuery>({
      query: (query) => ({
        url: paymentPostingApiDetails.endpoint,
        method: 'GET',
        params: {
          [paymentPostingApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizePaymentPostingListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'PaymentPosting' as const, id: item._id })),
              { type: 'PaymentPosting' as const, id: 'LIST' },
            ]
          : [{ type: 'PaymentPosting' as const, id: 'LIST' }],
    }),
    getPaymentPosting: builder.query<PaymentPosting, EntityId>({
      query: (id) => ({
        url: `${paymentPostingApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePaymentPosting(readResponsePath<unknown>(response, paymentPostingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payment Posting response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'PaymentPosting', id }],
    }),
    createPaymentPosting: builder.mutation<PaymentPosting, PaymentPostingCreatePayload>({
      query: (payload) => ({
        url: paymentPostingApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePaymentPosting(readResponsePath<unknown>(response, paymentPostingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payment Posting response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'PaymentPosting', id: 'LIST' }],
    }),
    updatePaymentPosting: builder.mutation<PaymentPosting, { id: EntityId; data: PaymentPostingUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${paymentPostingApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePaymentPosting(readResponsePath<unknown>(response, paymentPostingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payment Posting response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PaymentPosting', id },
        { type: 'PaymentPosting', id: 'LIST' },
      ],
    }),
    deletePaymentPosting: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${paymentPostingApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'PaymentPosting', id },
        { type: 'PaymentPosting', id: 'LIST' },
      ],
    }),
    reversePaymentPosting: builder.mutation<PaymentPosting, { id: EntityId; data: PaymentPostingReversePayload }>({
      query: ({ id, data }) => ({
        url: `${paymentPostingApiDetails.endpoint}/${id}/reverse`,
        method: 'POST',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePaymentPosting(readResponsePath<unknown>(response, paymentPostingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payment Posting response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PaymentPosting', id },
        { type: 'PaymentPosting', id: 'LIST' },
        { type: 'EraEobProcessing', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useCreatePaymentPostingMutation,
  useDeletePaymentPostingMutation,
  useGetPaymentPostingQuery,
  useGetPaymentPostingsQuery,
  useReversePaymentPostingMutation,
  useUpdatePaymentPostingMutation,
} = paymentPostingsApi
