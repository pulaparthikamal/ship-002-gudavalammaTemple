import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { claimAiReviewApiDetails } from '@/models/claimAiReviewModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ClaimAiReview, ClaimAiReviewCreatePayload, ClaimAiReviewUpdatePayload } from '@/types/claimAiReview'

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

function normalizeClaimAiReview(response: unknown): ClaimAiReview | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  const denialPrediction = typeof item.denialPrediction === 'object' && item.denialPrediction !== null ? (item.denialPrediction as Record<string, unknown>) : {}

  return {
    _id: item._id,
    claimAiReviewId:
      typeof item.claimAiReviewId === 'string'
        ? item.claimAiReviewId
        : typeof item.claimAiReviewId === 'object' && item.claimAiReviewId !== null && '_id' in item.claimAiReviewId
          ? String((item.claimAiReviewId as { _id?: string })._id ?? '')
          : '',
    claimId:
      typeof item.claimId === 'string'
        ? item.claimId
        : typeof item.claimId === 'object' && item.claimId !== null && '_id' in item.claimId
          ? String((item.claimId as { _id?: string })._id ?? '')
          : undefined,
    reviewStatus: normalizeOptionalString(item.reviewStatus),
    blockingReasons: normalizeStringArray(item.blockingReasons),
    overrideReason: normalizeOptionalString(item.overrideReason),
    overriddenBy:
      typeof item.overriddenBy === 'string'
        ? item.overriddenBy
        : typeof item.overriddenBy === 'object' && item.overriddenBy !== null && '_id' in item.overriddenBy
          ? String((item.overriddenBy as { _id?: string })._id ?? '')
          : undefined,
    overriddenAt: normalizeDateString(item.overriddenAt),
    denialPrediction: {
      riskScore: normalizeOptionalNumber(denialPrediction.riskScore),
      riskLevel: normalizeOptionalString(denialPrediction.riskLevel),
      predictedReasons: normalizeStringArray(denialPrediction.predictedReasons),
      recommendedFixes: normalizeStringArray(denialPrediction.recommendedFixes),
      modelVersion: normalizeOptionalString(denialPrediction.modelVersion),
      predictedAt: normalizeDateString(denialPrediction.predictedAt),
      confidenceScore: normalizeOptionalNumber(denialPrediction.confidenceScore),
      reviewRequired: Boolean(denialPrediction.reviewRequired),
    },
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

const claimAiReviewListDataPaths = [claimAiReviewApiDetails.responseDataPath, 'data.data', 'items']
const claimAiReviewListTotalPaths = [
  claimAiReviewApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeClaimAiReviewListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<ClaimAiReview> {
  return normalizeCrudListResponse<unknown, ClaimAiReview>({
    response,
    query,
    dataPaths: claimAiReviewListDataPaths,
    totalPaths: claimAiReviewListTotalPaths,
    mapItem: normalizeClaimAiReview,
  })
}

export const claimAiReviewsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClaimAiReviews: builder.query<CrudListResponse<ClaimAiReview>, CrudListQuery>({
      query: (query) => ({
        url: claimAiReviewApiDetails.endpoint,
        method: 'GET',
        params: {
          [claimAiReviewApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeClaimAiReviewListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ClaimAiReview' as const, id: item._id })),
              { type: 'ClaimAiReview' as const, id: 'LIST' },
            ]
          : [{ type: 'ClaimAiReview' as const, id: 'LIST' }],
    }),
    getClaimAiReview: builder.query<ClaimAiReview, EntityId>({
      query: (id) => ({
        url: `${claimAiReviewApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimAiReview(readResponsePath<unknown>(response, claimAiReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim AI Review response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'ClaimAiReview', id }],
    }),
    createClaimAiReview: builder.mutation<ClaimAiReview, ClaimAiReviewCreatePayload>({
      query: (payload) => ({
        url: claimAiReviewApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimAiReview(readResponsePath<unknown>(response, claimAiReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim AI Review response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'ClaimAiReview', id: 'LIST' }],
    }),
    updateClaimAiReview: builder.mutation<ClaimAiReview, { id: EntityId; data: ClaimAiReviewUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${claimAiReviewApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimAiReview(readResponsePath<unknown>(response, claimAiReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim AI Review response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ClaimAiReview', id },
        { type: 'ClaimAiReview', id: 'LIST' },
      ],
    }),
    deleteClaimAiReview: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${claimAiReviewApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'ClaimAiReview', id },
        { type: 'ClaimAiReview', id: 'LIST' },
      ],
    }),
    bulkDeleteClaimAiReviews: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${claimAiReviewApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'ClaimAiReview' as const, id })),
        { type: 'ClaimAiReview' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteClaimAiReviewsMutation,
  useCreateClaimAiReviewMutation,
  useDeleteClaimAiReviewMutation,
  useGetClaimAiReviewQuery,
  useGetClaimAiReviewsQuery,
  useUpdateClaimAiReviewMutation,
} = claimAiReviewsApi
