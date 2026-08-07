import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { denialApiDetails } from '@/models/denialModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Denial, DenialCreatePayload, DenialUpdatePayload } from '@/types/denial'

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

function normalizeDenial(response: unknown): Denial | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    denialId:
      typeof item.denialId === 'string'
        ? item.denialId
        : typeof item.denialId === 'object' && item.denialId !== null && '_id' in item.denialId
          ? String((item.denialId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeOptionalString(item.claimId),
    claimLineId: normalizeOptionalString(item.claimLineId),
    paymentPostingId: normalizeOptionalString(item.paymentPostingId),
    relatedPaymentPostingIds: normalizeStringArray(item.relatedPaymentPostingIds),
    eraEobProcessingId: normalizeOptionalString(item.eraEobProcessingId),
    adjustmentId: normalizeOptionalString(item.adjustmentId),
    appealId: normalizeOptionalString(item.appealId),
    correctedClaimId: normalizeOptionalString(item.correctedClaimId),
    arWorkItemId: normalizeOptionalString(item.arWorkItemId),
    patientId: normalizeOptionalString(item.patientId),
    payerId: normalizeOptionalString(item.payerId),
    cptCode: normalizeOptionalString(item.cptCode),
    denialCode: normalizeOptionalString(item.denialCode),
    carcCodes: normalizeStringArray(item.carcCodes),
    rarcCodes: normalizeStringArray(item.rarcCodes),
    denialReason: normalizeOptionalString(item.denialReason),
    payerDenialReason: normalizeOptionalString(item.payerDenialReason),
    denialCategory: normalizeOptionalString(item.denialCategory),
    classificationExplanation: normalizeOptionalString(item.classificationExplanation),
    denialSource: normalizeOptionalString(item.denialSource),
    denialDate: normalizeDateString(item.denialDate),
    denialAmount: normalizeOptionalNumber(item.denialAmount),
    adjustmentAmount: normalizeOptionalNumber(item.adjustmentAmount),
    denialBalance: normalizeOptionalNumber(item.denialBalance),
    lineBilledAmount: normalizeOptionalNumber(item.lineBilledAmount),
    linePaidAmount: normalizeOptionalNumber(item.linePaidAmount),
    lineAllowedAmount: normalizeOptionalNumber(item.lineAllowedAmount),
    resolvedAmount: normalizeOptionalNumber(item.resolvedAmount),
    remainingDeniedBalance: normalizeOptionalNumber(item.remainingDeniedBalance),
    matchConfidence: normalizeOptionalNumber(item.matchConfidence),
    matchedBy: normalizeStringArray(item.matchedBy),
    allocationAmount: normalizeOptionalNumber(item.allocationAmount),
    manualReviewRequired: typeof item.manualReviewRequired === 'boolean' ? item.manualReviewRequired : undefined,
    paymentAllocations: Array.isArray(item.paymentAllocations) ? item.paymentAllocations.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    appealDeadline: normalizeDateString(item.appealDeadline),
    preventableFlag: Boolean(item.preventableFlag),
    rootCause: normalizeOptionalString(item.rootCause),
    owner: normalizeOptionalString(item.owner),
    priority: normalizeOptionalString(item.priority),
    denialStatus: normalizeOptionalString(item.denialStatus),
    reworkType: normalizeOptionalString(item.reworkType),
    recommendedAction: normalizeOptionalString(item.recommendedAction),
    correctionEligible: typeof item.correctionEligible === 'boolean' ? item.correctionEligible : undefined,
    appealEligible: typeof item.appealEligible === 'boolean' ? item.appealEligible : undefined,
    recoveryRecommendation: item.recoveryRecommendation === 'CORRECTED_CLAIM' || item.recoveryRecommendation === 'APPEAL' || item.recoveryRecommendation === 'WRITE_OFF' ? item.recoveryRecommendation : undefined,
    recommendationReason: normalizeOptionalString(item.recommendationReason),
    aiAnalysis: typeof item.aiAnalysis === 'object' && item.aiAnalysis !== null ? item.aiAnalysis as Record<string, unknown> : undefined,
    aiConfidenceScore: normalizeOptionalNumber(item.aiConfidenceScore),
    aiRecommendationSource: normalizeOptionalString(item.aiRecommendationSource),
    aiRecommendationHistory: Array.isArray(item.aiRecommendationHistory) ? item.aiRecommendationHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    resolutionDate: normalizeDateString(item.resolutionDate),
    resolutionNotes: normalizeOptionalString(item.resolutionNotes),
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

const denialListDataPaths = [denialApiDetails.responseDataPath, 'data.data', 'items']
const denialListTotalPaths = [
  denialApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeDenialListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Denial> {
  return normalizeCrudListResponse<unknown, Denial>({
    response,
    query,
    dataPaths: denialListDataPaths,
    totalPaths: denialListTotalPaths,
    mapItem: normalizeDenial,
  })
}

export const denialsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDenials: builder.query<CrudListResponse<Denial>, CrudListQuery>({
      query: (query) => ({
        url: denialApiDetails.endpoint,
        method: 'GET',
        params: {
          [denialApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeDenialListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Denial' as const, id: item._id })),
              { type: 'Denial' as const, id: 'LIST' },
            ]
          : [{ type: 'Denial' as const, id: 'LIST' }],
    }),
    getDenial: builder.query<Denial, EntityId>({
      query: (id) => ({
        url: `${denialApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Denial response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Denial', id }],
    }),
    createDenial: builder.mutation<Denial, DenialCreatePayload>({
      query: (payload) => ({
        url: denialApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Denial response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Denial', id: 'LIST' }],
    }),
    updateDenial: builder.mutation<Denial, { id: EntityId; data: DenialUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${denialApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Denial response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Denial', id },
        { type: 'Denial', id: 'LIST' },
      ],
    }),
    deleteDenial: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${denialApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Denial', id },
        { type: 'Denial', id: 'LIST' },
      ],
    }),
    bulkDeleteDenials: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${denialApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Denial' as const, id })),
        { type: 'Denial' as const, id: 'LIST' },
      ],
    }),
    assignDenialOwner: builder.mutation<Denial, { id: EntityId; owner: string }>({
      query: ({ id, owner }) => ({ url: `${denialApiDetails.endpoint}/${id}/assign-owner`, method: 'PATCH', data: { owner } }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }],
    }),
    changeDenialStatus: builder.mutation<Denial, { id: EntityId; denialStatus: string; resolutionNotes?: string }>({
      query: ({ id, ...data }) => ({ url: `${denialApiDetails.endpoint}/${id}/status`, method: 'PATCH', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }],
    }),
    markDenialReadyForCorrectedClaim: builder.mutation<Denial, EntityId>({
      query: (id) => ({ url: `${denialApiDetails.endpoint}/${id}/ready-corrected-claim`, method: 'POST' }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, id) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }, { type: 'CorrectedClaim', id: 'LIST' }],
    }),
    markDenialReadyForAppeal: builder.mutation<Denial, EntityId>({
      query: (id) => ({ url: `${denialApiDetails.endpoint}/${id}/ready-appeal`, method: 'POST' }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, id) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
    writeOffDenial: builder.mutation<Denial, { id: EntityId; resolutionNotes?: string }>({
      query: ({ id, resolutionNotes }) => ({ url: `${denialApiDetails.endpoint}/${id}/write-off`, method: 'POST', data: { resolutionNotes } }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
    transferDenialToPatient: builder.mutation<Denial, { id: EntityId; resolutionNotes: string }>({
      query: ({ id, resolutionNotes }) => ({ url: `${denialApiDetails.endpoint}/${id}/transfer-to-patient`, method: 'POST', data: { resolutionNotes } }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }, { type: 'PatientBilling', id: 'LIST' }],
    }),
    reopenDenial: builder.mutation<Denial, { id: EntityId; reason: string }>({
      query: ({ id, reason }) => ({ url: `${denialApiDetails.endpoint}/${id}/reopen`, method: 'POST', data: { reason } }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
    runDenialAiAnalysis: builder.mutation<Denial, EntityId>({
      query: (id) => ({ url: `${denialApiDetails.endpoint}/${id}/ai-analysis`, method: 'POST' }),
      transformResponse: (response: unknown) => {
        const item = normalizeDenial(readResponsePath<unknown>(response, denialApiDetails.responseDataPath))
        if (!item) throw new Error('Denial response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, id) => [{ type: 'Denial', id }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
  }),
})

export const {
  useAssignDenialOwnerMutation,
  useBulkDeleteDenialsMutation,
  useChangeDenialStatusMutation,
  useCreateDenialMutation,
  useDeleteDenialMutation,
  useGetDenialQuery,
  useGetDenialsQuery,
  useMarkDenialReadyForAppealMutation,
  useMarkDenialReadyForCorrectedClaimMutation,
  useReopenDenialMutation,
  useRunDenialAiAnalysisMutation,
  useTransferDenialToPatientMutation,
  useUpdateDenialMutation,
  useWriteOffDenialMutation,
} = denialsApi
