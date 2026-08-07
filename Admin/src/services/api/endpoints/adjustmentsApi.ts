import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { adjustmentApiDetails } from '@/models/adjustmentModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Adjustment, AdjustmentCreatePayload, AdjustmentUpdatePayload } from '@/types/adjustment'

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

function normalizeAdjustment(response: unknown): Adjustment | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    adjustmentId:
      typeof item.adjustmentId === 'string'
        ? item.adjustmentId
        : typeof item.adjustmentId === 'object' && item.adjustmentId !== null && '_id' in item.adjustmentId
          ? String((item.adjustmentId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeOptionalString(item.claimId),
    claimLineId: normalizeOptionalString(item.claimLineId),
    adjustmentType: normalizeOptionalString(item.adjustmentType),
    adjustmentGroupCode: normalizeOptionalString(item.adjustmentGroupCode),
    adjustmentReasonCode: normalizeOptionalString(item.adjustmentReasonCode),
    adjustmentAmount: normalizeOptionalNumber(item.adjustmentAmount),
    writeOffFlag: Boolean(item.writeOffFlag),
    approvedBy: normalizeOptionalString(item.approvedBy),
    adjustmentDate: normalizeDateString(item.adjustmentDate),
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

const adjustmentListDataPaths = [adjustmentApiDetails.responseDataPath, 'data.data', 'items']
const adjustmentListTotalPaths = [
  adjustmentApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeAdjustmentListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Adjustment> {
  return normalizeCrudListResponse<unknown, Adjustment>({
    response,
    query,
    dataPaths: adjustmentListDataPaths,
    totalPaths: adjustmentListTotalPaths,
    mapItem: normalizeAdjustment,
  })
}

export const adjustmentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAdjustments: builder.query<CrudListResponse<Adjustment>, CrudListQuery>({
      query: (query) => ({
        url: adjustmentApiDetails.endpoint,
        method: 'GET',
        params: {
          [adjustmentApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeAdjustmentListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Adjustment' as const, id: item._id })),
              { type: 'Adjustment' as const, id: 'LIST' },
            ]
          : [{ type: 'Adjustment' as const, id: 'LIST' }],
    }),
    getAdjustment: builder.query<Adjustment, EntityId>({
      query: (id) => ({
        url: `${adjustmentApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAdjustment(readResponsePath<unknown>(response, adjustmentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Adjustment response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Adjustment', id }],
    }),
    createAdjustment: builder.mutation<Adjustment, AdjustmentCreatePayload>({
      query: (payload) => ({
        url: adjustmentApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAdjustment(readResponsePath<unknown>(response, adjustmentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Adjustment response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Adjustment', id: 'LIST' }],
    }),
    updateAdjustment: builder.mutation<Adjustment, { id: EntityId; data: AdjustmentUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${adjustmentApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAdjustment(readResponsePath<unknown>(response, adjustmentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Adjustment response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Adjustment', id },
        { type: 'Adjustment', id: 'LIST' },
      ],
    }),
    deleteAdjustment: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${adjustmentApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Adjustment', id },
        { type: 'Adjustment', id: 'LIST' },
      ],
    }),
    bulkDeleteAdjustments: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${adjustmentApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Adjustment' as const, id })),
        { type: 'Adjustment' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteAdjustmentsMutation,
  useCreateAdjustmentMutation,
  useDeleteAdjustmentMutation,
  useGetAdjustmentQuery,
  useGetAdjustmentsQuery,
  useUpdateAdjustmentMutation,
} = adjustmentsApi
