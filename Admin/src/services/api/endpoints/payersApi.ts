import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { payerApiDetails } from '@/models/payerModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Payer, PayerCreatePayload, PayerUpdatePayload } from '@/types/payer'

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

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

export function normalizeNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
}

function normalizePayer(response: unknown): Payer | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    payerId: normalizeOptionalString(item.payerId),
    payerName: normalizeString(item.payerName),
    ediPayerId: normalizeOptionalString(item.ediPayerId),
    payerType: normalizeOptionalString(item.payerType),
    claimsSubmissionMethod: normalizeOptionalString(item.claimsSubmissionMethod),
    eligibilityApiSupported: Boolean(item.eligibilityApiSupported),
    authPortalUrl: normalizeOptionalString(item.authPortalUrl),
    payerAddressLine1: normalizeOptionalString(item.payerAddressLine1),
    payerAddressLine2: normalizeOptionalString(item.payerAddressLine2),
    city: normalizeOptionalString(item.city),
    state: normalizeOptionalString(item.state),
    zipCode: normalizeOptionalString(item.zipCode),
    phone: normalizeOptionalString(item.phone),
    timelyFilingDays: normalizeOptionalNumber(item.timelyFilingDays),
    appealTimelyFilingDays: normalizeOptionalNumber(item.appealTimelyFilingDays),
    activeFlag: Boolean(item.activeFlag),
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

const payerListDataPaths = [payerApiDetails.responseDataPath, 'data.data', 'items']
const payerListTotalPaths = [
  payerApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePayerListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Payer> {
  return normalizeCrudListResponse<unknown, Payer>({
    response,
    query,
    dataPaths: payerListDataPaths,
    totalPaths: payerListTotalPaths,
    mapItem: normalizePayer,
  })
}

export const payersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPayers: builder.query<CrudListResponse<Payer>, CrudListQuery>({
      query: (query) => ({
        url: payerApiDetails.endpoint,
        method: 'GET',
        params: {
          [payerApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizePayerListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Payer' as const, id: item._id })),
              { type: 'Payer' as const, id: 'LIST' },
            ]
          : [{ type: 'Payer' as const, id: 'LIST' }],
    }),
    getPayer: builder.query<Payer, EntityId>({
      query: (id) => ({
        url: `${payerApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePayer(readResponsePath<unknown>(response, payerApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payer response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Payer', id }],
    }),
    createPayer: builder.mutation<Payer, PayerCreatePayload>({
      query: (payload) => ({
        url: payerApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePayer(readResponsePath<unknown>(response, payerApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payer response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Payer', id: 'LIST' }],
    }),
    updatePayer: builder.mutation<Payer, { id: EntityId; data: PayerUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${payerApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePayer(readResponsePath<unknown>(response, payerApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Payer response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Payer', id },
        { type: 'Payer', id: 'LIST' },
      ],
    }),
    deletePayer: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${payerApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Payer', id },
        { type: 'Payer', id: 'LIST' },
      ],
    }),
    bulkDeletePayers: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${payerApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Payer' as const, id })),
        { type: 'Payer' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeletePayersMutation,
  useCreatePayerMutation,
  useDeletePayerMutation,
  useGetPayerQuery,
  useGetPayersQuery,
  useUpdatePayerMutation,
} = payersApi
