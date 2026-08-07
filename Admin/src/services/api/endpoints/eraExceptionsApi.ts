import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { eraExceptionApiDetails } from '@/models/eraExceptionModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { EraException, EraExceptionCreatePayload, EraExceptionUpdatePayload } from '@/types/eraException'

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeEraException(response: unknown): EraException | null {
  if (typeof response !== 'object' || response === null) return null
  const item = response as Record<string, unknown>
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    eraExceptionId: typeof item.eraExceptionId === 'string' ? item.eraExceptionId : '',
    exceptionType: typeof item.exceptionType === 'string' ? item.exceptionType : '',
    severity: normalizeOptionalString(item.severity),
    status: normalizeOptionalString(item.status),
    assignedTo: normalizeOptionalString(item.assignedTo),
    resolutionNotes: normalizeOptionalString(item.resolutionNotes),
    ignoredReason: normalizeOptionalString(item.ignoredReason),
    relatedClaim: normalizeOptionalString(item.relatedClaim),
    relatedERA: normalizeOptionalString(item.relatedERA),
    relatedPaymentPosting: normalizeOptionalString(item.relatedPaymentPosting),
    relatedDenial: normalizeOptionalString(item.relatedDenial),
    relatedARWorkItem: normalizeOptionalString(item.relatedARWorkItem),
    aiAnalysis: typeof item.aiAnalysis === 'object' && item.aiAnalysis !== null ? item.aiAnalysis as Record<string, unknown> : undefined,
    aiRecommendationHistory: Array.isArray(item.aiRecommendationHistory) ? item.aiRecommendationHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : [],
    actionHistory: Array.isArray(item.actionHistory) ? item.actionHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : [],
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt: normalizeDateString(item.createdAt) ?? normalizeDateString(item.created) ?? new Date().toISOString(),
    updatedAt: normalizeDateString(item.updatedAt) ?? normalizeDateString(item.updated) ?? new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
  }
}

function normalizeEraExceptionListResponse(response: unknown, query: CrudListQuery): CrudListResponse<EraException> {
  return normalizeCrudListResponse<unknown, EraException>({
    response,
    query,
    dataPaths: [eraExceptionApiDetails.responseDataPath, 'data.data', 'items'],
    totalPaths: [eraExceptionApiDetails.responseTotalPath, 'meta.totalRecords', 'data.total', 'total'],
    mapItem: normalizeEraException,
  })
}

export const eraExceptionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEraExceptions: builder.query<CrudListResponse<EraException>, CrudListQuery>({
      query: (query) => ({
        url: eraExceptionApiDetails.endpoint,
        method: 'GET',
        params: { [eraExceptionApiDetails.filterQueryParam]: JSON.stringify(query) },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeEraExceptionListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'EraException' as const, id: item._id })),
              { type: 'EraException' as const, id: 'LIST' },
            ]
          : [{ type: 'EraException' as const, id: 'LIST' }],
    }),
    createEraException: builder.mutation<EraException, EraExceptionCreatePayload>({
      query: (payload) => ({ url: eraExceptionApiDetails.endpoint, method: 'POST', data: payload }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraException(readResponsePath<unknown>(response, eraExceptionApiDetails.responseDataPath))
        if (!item) throw new Error('ERA exception response is invalid.')
        return item
      },
      invalidatesTags: [{ type: 'EraException', id: 'LIST' }],
    }),
    updateEraException: builder.mutation<EraException, { id: EntityId; data: EraExceptionUpdatePayload }>({
      query: ({ id, data }) => ({ url: `${eraExceptionApiDetails.endpoint}/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraException(readResponsePath<unknown>(response, eraExceptionApiDetails.responseDataPath))
        if (!item) throw new Error('ERA exception response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'EraException', id }, { type: 'EraException', id: 'LIST' }],
    }),
    deleteEraException: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `${eraExceptionApiDetails.endpoint}/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [{ type: 'EraException', id }, { type: 'EraException', id: 'LIST' }],
    }),
    eraExceptionAction: builder.mutation<EraException, { id: EntityId; action: string; data?: Record<string, unknown> }>({
      query: ({ id, action, data }) => ({ url: `${eraExceptionApiDetails.endpoint}/${id}/actions/${action}`, method: 'POST', data: data ?? {} }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraException(readResponsePath<unknown>(response, eraExceptionApiDetails.responseDataPath))
        if (!item) throw new Error('ERA exception response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'EraException', id },
        { type: 'EraException', id: 'LIST' },
        { type: 'ArWorkItem', id: 'LIST' },
        { type: 'Denial', id: 'LIST' },
      ],
    }),
    explainEraExceptionWithAi: builder.mutation<EraException, EntityId>({
      query: (id) => ({ url: `${eraExceptionApiDetails.endpoint}/${id}/ai-explain`, method: 'POST' }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraException(readResponsePath<unknown>(response, eraExceptionApiDetails.responseDataPath))
        if (!item) throw new Error('ERA exception response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, id) => [{ type: 'EraException', id }, { type: 'EraException', id: 'LIST' }],
    }),
  }),
})

export const {
  useCreateEraExceptionMutation,
  useDeleteEraExceptionMutation,
  useEraExceptionActionMutation,
  useExplainEraExceptionWithAiMutation,
  useGetEraExceptionsQuery,
  useUpdateEraExceptionMutation,
} = eraExceptionsApi
