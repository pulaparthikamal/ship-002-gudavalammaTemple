import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { correctedClaimApiDetails } from '@/models/correctedClaimModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { CorrectedClaim, CorrectedClaimCreatePayload, CorrectedClaimUpdatePayload } from '@/types/correctedClaim'

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

function normalizeCorrectedClaim(response: unknown): CorrectedClaim | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    correctedClaimId:
      typeof item.correctedClaimId === 'string'
        ? item.correctedClaimId
        : typeof item.correctedClaimId === 'object' && item.correctedClaimId !== null && '_id' in item.correctedClaimId
          ? String((item.correctedClaimId as { _id?: string })._id ?? '')
          : '',
    originalClaimId: normalizeOptionalString(item.originalClaimId),
    denialId: normalizeOptionalString(item.denialId),
    sourceDenialId: normalizeOptionalString(item.sourceDenialId),
    correctedFromClaimId: normalizeOptionalString(item.correctedFromClaimId),
    clonedClaimId: normalizeOptionalString(item.clonedClaimId),
    correctionReason: normalizeOptionalString(item.correctionReason),
    correctionType: normalizeOptionalString(item.correctionType),
    frequencyCode: normalizeOptionalString(item.frequencyCode),
    resubmissionReason: normalizeOptionalString(item.resubmissionReason),
    correctedFrequencyCode: normalizeOptionalString(item.correctedFrequencyCode),
    correctedClaimStatus: normalizeOptionalString(item.correctedClaimStatus),
    correctedFieldsChanged: normalizeStringArray(item.correctedFieldsChanged),
    correctedFields: Array.isArray(item.correctedFields) ? item.correctedFields.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) : [],
    lineageChain: normalizeStringArray(item.lineageChain),
    correctionAudit: Array.isArray(item.correctionAudit) ? item.correctionAudit.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) : [],
    submittedDate: normalizeDateString(item.submittedDate),
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

const correctedClaimListDataPaths = [correctedClaimApiDetails.responseDataPath, 'data.data', 'items']
const correctedClaimListTotalPaths = [
  correctedClaimApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeCorrectedClaimListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<CorrectedClaim> {
  return normalizeCrudListResponse<unknown, CorrectedClaim>({
    response,
    query,
    dataPaths: correctedClaimListDataPaths,
    totalPaths: correctedClaimListTotalPaths,
    mapItem: normalizeCorrectedClaim,
  })
}

export const correctedClaimsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCorrectedClaims: builder.query<CrudListResponse<CorrectedClaim>, CrudListQuery>({
      query: (query) => ({
        url: correctedClaimApiDetails.endpoint,
        method: 'GET',
        params: {
          [correctedClaimApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeCorrectedClaimListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'CorrectedClaim' as const, id: item._id })),
              { type: 'CorrectedClaim' as const, id: 'LIST' },
            ]
          : [{ type: 'CorrectedClaim' as const, id: 'LIST' }],
    }),
    getCorrectedClaim: builder.query<CorrectedClaim, EntityId>({
      query: (id) => ({
        url: `${correctedClaimApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCorrectedClaim(readResponsePath<unknown>(response, correctedClaimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Corrected Claim response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'CorrectedClaim', id }],
    }),
    createCorrectedClaim: builder.mutation<CorrectedClaim, CorrectedClaimCreatePayload>({
      query: (payload) => ({
        url: correctedClaimApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCorrectedClaim(readResponsePath<unknown>(response, correctedClaimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Corrected Claim response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'CorrectedClaim', id: 'LIST' }],
    }),
    updateCorrectedClaim: builder.mutation<CorrectedClaim, { id: EntityId; data: CorrectedClaimUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${correctedClaimApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCorrectedClaim(readResponsePath<unknown>(response, correctedClaimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Corrected Claim response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CorrectedClaim', id },
        { type: 'CorrectedClaim', id: 'LIST' },
      ],
    }),
    deleteCorrectedClaim: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${correctedClaimApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'CorrectedClaim', id },
        { type: 'CorrectedClaim', id: 'LIST' },
      ],
    }),
    bulkDeleteCorrectedClaims: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${correctedClaimApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'CorrectedClaim' as const, id })),
        { type: 'CorrectedClaim' as const, id: 'LIST' },
      ],
    }),
    createCorrectedClaimFromDenial: builder.mutation<CorrectedClaim, { denialId: EntityId; correctionType?: string; correctionReason?: string }>({
      query: ({ denialId, ...data }) => ({
        url: `${correctedClaimApiDetails.endpoint}/from-denial/${denialId}`,
        method: 'POST',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCorrectedClaim(readResponsePath<unknown>(response, correctedClaimApiDetails.responseDataPath))
        if (!item) throw new Error('Corrected Claim response is invalid.')
        return item
      },
      invalidatesTags: [{ type: 'CorrectedClaim', id: 'LIST' }, { type: 'Claim', id: 'LIST' }, { type: 'Denial', id: 'LIST' }],
    }),
    createCorrectedClaimFromClaim: builder.mutation<CorrectedClaim, { claimId: EntityId; correctionType?: string; correctionReason?: string }>({
      query: ({ claimId, ...data }) => ({
        url: `${correctedClaimApiDetails.endpoint}/from-claim/${claimId}`,
        method: 'POST',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCorrectedClaim(readResponsePath<unknown>(response, correctedClaimApiDetails.responseDataPath))
        if (!item) throw new Error('Corrected Claim response is invalid.')
        return item
      },
      invalidatesTags: [{ type: 'CorrectedClaim', id: 'LIST' }, { type: 'Claim', id: 'LIST' }, { type: 'Denial', id: 'LIST' }],
    }),
    submitCorrectedClaim: builder.mutation<unknown, EntityId>({
      query: (id) => ({ url: `${correctedClaimApiDetails.endpoint}/${id}/submit`, method: 'POST' }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'CorrectedClaim', id },
        { type: 'CorrectedClaim', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
        { type: 'ClaimSubmission', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteCorrectedClaimsMutation,
  useCreateCorrectedClaimFromClaimMutation,
  useCreateCorrectedClaimMutation,
  useCreateCorrectedClaimFromDenialMutation,
  useDeleteCorrectedClaimMutation,
  useGetCorrectedClaimQuery,
  useGetCorrectedClaimsQuery,
  useSubmitCorrectedClaimMutation,
  useUpdateCorrectedClaimMutation,
} = correctedClaimsApi
