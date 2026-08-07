import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { claimTrackingApiDetails } from '@/models/claimTrackingModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ClaimTracking, ClaimTrackingCreatePayload, ClaimTrackingUpdatePayload } from '@/types/claimTracking'

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeIdString(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const objectId = (value as { _id?: unknown })._id
    return typeof objectId === 'string' ? objectId : undefined
  }

  return undefined
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

function normalizeClaimTracking(response: unknown): ClaimTracking | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    trackingId:
      typeof item.trackingId === 'string'
        ? item.trackingId
        : typeof item.trackingId === 'object' && item.trackingId !== null && '_id' in item.trackingId
          ? String((item.trackingId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeIdString(item.claimId),
    claimSubmissionId: normalizeIdString(item.claimSubmissionId),
    timestamp: normalizeDateString(item.timestamp),
    source: normalizeOptionalString(item.source),
    trackingSource: item.trackingSource === 'SIMULATED' ? 'SIMULATED' : item.trackingSource === 'REAL' ? 'REAL' : undefined,
    responseType:
      item.responseType === 'SUBMISSION' ||
      item.responseType === 'ACK_999' ||
      item.responseType === 'ACK_277CA' ||
      item.responseType === 'STATUS_UPDATE'
        ? item.responseType
        : undefined,
    eventType:
      typeof item.eventType === 'string'
        ? item.eventType as ClaimTracking['eventType']
        : undefined,
    normalizedStatus:
      item.normalizedStatus === 'DRAFT' ||
      item.normalizedStatus === 'READY' ||
      item.normalizedStatus === 'SUBMITTED' ||
      item.normalizedStatus === 'PENDING' ||
      item.normalizedStatus === 'ACCEPTED' ||
      item.normalizedStatus === 'REJECTED' ||
      item.normalizedStatus === 'FAILED'
        ? item.normalizedStatus
        : undefined,
    rawStatusCode: normalizeOptionalString(item.rawStatusCode),
    summary: normalizeOptionalString(item.summary),
    controlNumber: normalizeOptionalString(item.controlNumber),
    externalSubmissionId: normalizeOptionalString(item.externalSubmissionId),
    claimControlNumber: normalizeOptionalString(item.claimControlNumber),
    clearinghouseTraceNumber: normalizeOptionalString(item.clearinghouseTraceNumber),
    payerClaimNumber: normalizeOptionalString(item.payerClaimNumber),
    acknowledgementType: normalizeOptionalString(item.acknowledgementType),
    statusCode: normalizeOptionalString(item.statusCode),
    statusDescription: normalizeOptionalString(item.statusDescription),
    receivedDate: normalizeDateString(item.receivedDate),
    rejectionLevel: normalizeOptionalString(item.rejectionLevel),
    rejectionSource: normalizeOptionalString(item.rejectionSource),
    rejectionReasonCodes: normalizeStringArray(item.rejectionReasonCodes),
    nextActionRequired: normalizeOptionalString(item.nextActionRequired),
    responsePayloadRedacted: normalizeOptionalString(item.responsePayloadRedacted),
    responseStatusCode: normalizeOptionalNumber(item.responseStatusCode),
    aiRejectionAnalysis: typeof item.aiRejectionAnalysis === 'object' && item.aiRejectionAnalysis !== null ? item.aiRejectionAnalysis as Record<string, unknown> : undefined,
    aiRecommendationHistory: Array.isArray(item.aiRecommendationHistory) ? item.aiRecommendationHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
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

const claimTrackingListDataPaths = [claimTrackingApiDetails.responseDataPath, 'data.data', 'items']
const claimTrackingListTotalPaths = [
  claimTrackingApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeClaimTrackingListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<ClaimTracking> {
  return normalizeCrudListResponse<unknown, ClaimTracking>({
    response,
    query,
    dataPaths: claimTrackingListDataPaths,
    totalPaths: claimTrackingListTotalPaths,
    mapItem: normalizeClaimTracking,
  })
}

export const claimTrackingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClaimTrackings: builder.query<CrudListResponse<ClaimTracking>, CrudListQuery>({
      query: (query) => ({
        url: claimTrackingApiDetails.endpoint,
        method: 'GET',
        params: {
          [claimTrackingApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeClaimTrackingListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ClaimTracking' as const, id: item._id })),
              { type: 'ClaimTracking' as const, id: 'LIST' },
            ]
          : [{ type: 'ClaimTracking' as const, id: 'LIST' }],
    }),
    getClaimTracking: builder.query<ClaimTracking, EntityId>({
      query: (id) => ({
        url: `${claimTrackingApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimTracking(readResponsePath<unknown>(response, claimTrackingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim Tracking response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'ClaimTracking', id }],
    }),
    createClaimTracking: builder.mutation<ClaimTracking, ClaimTrackingCreatePayload>({
      query: (payload) => ({
        url: claimTrackingApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimTracking(readResponsePath<unknown>(response, claimTrackingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim Tracking response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'ClaimTracking', id: 'LIST' }],
    }),
    updateClaimTracking: builder.mutation<ClaimTracking, { id: EntityId; data: ClaimTrackingUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${claimTrackingApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimTracking(readResponsePath<unknown>(response, claimTrackingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim Tracking response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ClaimTracking', id },
        { type: 'ClaimTracking', id: 'LIST' },
      ],
    }),
    deleteClaimTracking: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${claimTrackingApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'ClaimTracking', id },
        { type: 'ClaimTracking', id: 'LIST' },
      ],
    }),
    bulkDeleteClaimTrackings: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${claimTrackingApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'ClaimTracking' as const, id })),
        { type: 'ClaimTracking' as const, id: 'LIST' },
      ],
    }),
    analyzeClaimTrackingRejection: builder.mutation<ClaimTracking, EntityId>({
      query: (id) => ({ url: `${claimTrackingApiDetails.endpoint}/${id}/analyze-rejection`, method: 'POST' }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimTracking(readResponsePath<unknown>(response, claimTrackingApiDetails.responseDataPath))
        if (!item) throw new Error('Claim Tracking response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, id) => [{ type: 'ClaimTracking', id }, { type: 'ClaimTracking', id: 'LIST' }, { type: 'Claim', id: 'LIST' }],
    }),
  }),
})

export const {
  useAnalyzeClaimTrackingRejectionMutation,
  useBulkDeleteClaimTrackingsMutation,
  useCreateClaimTrackingMutation,
  useDeleteClaimTrackingMutation,
  useGetClaimTrackingQuery,
  useGetClaimTrackingsQuery,
  useUpdateClaimTrackingMutation,
} = claimTrackingsApi
