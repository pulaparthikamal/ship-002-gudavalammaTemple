import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { appealApiDetails } from '@/models/appealModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Appeal, AppealCreatePayload, AppealDashboard, AppealTimeline, AppealUpdatePayload } from '@/types/appeal'

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

function normalizeAppeal(response: unknown): Appeal | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    appealId:
      typeof item.appealId === 'string'
        ? item.appealId
        : typeof item.appealId === 'object' && item.appealId !== null && '_id' in item.appealId
          ? String((item.appealId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeOptionalString(item.claimId),
    denialId: normalizeOptionalString(item.denialId),
    arWorkItemId: normalizeOptionalString(item.arWorkItemId),
    payerId: normalizeOptionalString(item.payerId),
    denialCode: normalizeOptionalString(item.denialCode),
    appealCategory: normalizeOptionalString(item.appealCategory),
    dueDate: normalizeDateString(item.dueDate),
    owner: normalizeOptionalString(item.owner),
    appealLevel: normalizeOptionalString(item.appealLevel),
    appealReason: normalizeOptionalString(item.appealReason),
    appealDescription: normalizeOptionalString(item.appealDescription),
    supportingDocuments: normalizeStringArray(item.supportingDocuments),
    appealStatus: normalizeOptionalString(item.appealStatus),
    submissionDate: normalizeDateString(item.submissionDate),
    submittedAt: normalizeDateString(item.submittedAt),
    payerReceivedAt: normalizeDateString(item.payerReceivedAt),
    decisionAt: normalizeDateString(item.decisionAt),
    appealDeadline: normalizeDateString(item.appealDeadline),
    submissionMethod: normalizeOptionalString(item.submissionMethod),
    payerResponse: normalizeOptionalString(item.payerResponse),
    resolution: normalizeOptionalString(item.resolution),
    outcome: normalizeOptionalString(item.outcome),
    outcomeDate: normalizeDateString(item.outcomeDate),
    appealOutcomeReason: normalizeOptionalString(item.appealOutcomeReason),
    payerResponseDueAt: normalizeDateString(item.payerResponseDueAt),
    evidenceSubmittedAt: normalizeDateString(item.evidenceSubmittedAt),
    missingDocumentRequests: Array.isArray(item.missingDocumentRequests) ? item.missingDocumentRequests.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    evidenceItems: Array.isArray(item.evidenceItems) ? item.evidenceItems.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    slaStatus: normalizeOptionalString(item.slaStatus),
    escalatedAt: normalizeDateString(item.escalatedAt),
    escalationCount: normalizeOptionalNumber(item.escalationCount),
    escalationReason: normalizeOptionalString(item.escalationReason),
    evidenceSummary: normalizeOptionalString(item.evidenceSummary),
    submittedBy: normalizeOptionalString(item.submittedBy),
    decisionBy: normalizeOptionalString(item.decisionBy),
    decisionNotes: normalizeOptionalString(item.decisionNotes),
    payerReferenceNumber: normalizeOptionalString(item.payerReferenceNumber),
    expectedReprocessBy: normalizeDateString(item.expectedReprocessBy),
    relatedPaymentPostingId: normalizeOptionalString(item.relatedPaymentPostingId),
    relatedEraId: normalizeOptionalString(item.relatedEraId),
    readinessStatus: normalizeOptionalString(item.readinessStatus),
    readinessReview: typeof item.readinessReview === 'object' && item.readinessReview !== null ? item.readinessReview as Record<string, unknown> : undefined,
    packetGenerated: typeof item.packetGenerated === 'boolean' ? item.packetGenerated : undefined,
    packetGeneratedAt: normalizeDateString(item.packetGeneratedAt),
    packetVersion: normalizeOptionalNumber(item.packetVersion),
    packetStatus: normalizeOptionalString(item.packetStatus),
    packetFileReference: normalizeOptionalString(item.packetFileReference),
    packetFileName: normalizeOptionalString(item.packetFileName),
    finalPacketGeneratedAt: normalizeDateString(item.finalPacketGeneratedAt),
    finalPacketVersion: normalizeOptionalNumber(item.finalPacketVersion),
    finalPacketFileReference: normalizeOptionalString(item.finalPacketFileReference),
    finalPacketFileName: normalizeOptionalString(item.finalPacketFileName),
    packetSnapshot: typeof item.packetSnapshot === 'object' && item.packetSnapshot !== null ? item.packetSnapshot as Record<string, unknown> : undefined,
    generatedAppealLetterText: normalizeOptionalString(item.generatedAppealLetterText),
    aiPacketDraft: typeof item.aiPacketDraft === 'object' && item.aiPacketDraft !== null ? item.aiPacketDraft as Record<string, unknown> : undefined,
    aiPacketHistory: Array.isArray(item.aiPacketHistory) ? item.aiPacketHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    diagnosisCodes: normalizeStringArray(item.diagnosisCodes),
    procedureCodes: normalizeStringArray(item.procedureCodes),
    medicalNecessityNotes: normalizeOptionalString(item.medicalNecessityNotes),
    authorizationEvidence: normalizeOptionalString(item.authorizationEvidence),
    eligibilityEvidence: normalizeOptionalString(item.eligibilityEvidence),
    priorPayerResponse: normalizeOptionalString(item.priorPayerResponse),
    supportingDocumentsMetadata: Array.isArray(item.supportingDocumentsMetadata) ? item.supportingDocumentsMetadata.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    correspondenceHistory: Array.isArray(item.correspondenceHistory) ? item.correspondenceHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    submissionChannel: normalizeOptionalString(item.submissionChannel),
    submissionTracking: typeof item.submissionTracking === 'object' && item.submissionTracking !== null ? item.submissionTracking as Record<string, unknown> : undefined,
    submissionProof: typeof item.submissionProof === 'object' && item.submissionProof !== null ? item.submissionProof as Record<string, unknown> : undefined,
    deadlineStatus: normalizeOptionalString(item.deadlineStatus),
    daysRemaining: normalizeOptionalNumber(item.daysRemaining),
    recoveredAmount: normalizeOptionalNumber(item.recoveredAmount),
    payerRecoveredAmount: normalizeOptionalNumber(item.payerRecoveredAmount),
    patientRecoveredAmount: normalizeOptionalNumber(item.patientRecoveredAmount),
    contractualAdjustmentRecoveredAmount: normalizeOptionalNumber(item.contractualAdjustmentRecoveredAmount),
    recoveredAt: normalizeDateString(item.recoveredAt),
    recoveryStatus: normalizeOptionalString(item.recoveryStatus),
    recoveryPercent: normalizeOptionalNumber(item.recoveryPercent),
    statusHistory: Array.isArray(item.statusHistory) ? item.statusHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
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

const appealListDataPaths = [appealApiDetails.responseDataPath, 'data.data', 'items']
const appealListTotalPaths = [
  appealApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeAppealListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Appeal> {
  return normalizeCrudListResponse<unknown, Appeal>({
    response,
    query,
    dataPaths: appealListDataPaths,
    totalPaths: appealListTotalPaths,
    mapItem: normalizeAppeal,
  })
}

export const appealsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAppeals: builder.query<CrudListResponse<Appeal>, CrudListQuery>({
      query: (query) => ({
        url: appealApiDetails.endpoint,
        method: 'GET',
        params: {
          [appealApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeAppealListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Appeal' as const, id: item._id })),
              { type: 'Appeal' as const, id: 'LIST' },
            ]
          : [{ type: 'Appeal' as const, id: 'LIST' }],
    }),
    getAppeal: builder.query<Appeal, EntityId>({
      query: (id) => ({
        url: `${appealApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Appeal response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Appeal', id }],
    }),
    createAppeal: builder.mutation<Appeal, AppealCreatePayload>({
      query: (payload) => ({
        url: appealApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Appeal response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Appeal', id: 'LIST' }],
    }),
    updateAppeal: builder.mutation<Appeal, { id: EntityId; data: AppealUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${appealApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Appeal response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Appeal', id },
        { type: 'Appeal', id: 'LIST' },
      ],
    }),
    deleteAppeal: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${appealApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Appeal', id },
        { type: 'Appeal', id: 'LIST' },
      ],
    }),
    bulkDeleteAppeals: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${appealApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Appeal' as const, id })),
        { type: 'Appeal' as const, id: 'LIST' },
      ],
    }),
    createAppealFromDenial: builder.mutation<Appeal, { denialId: EntityId; appealReason?: string; appealCategory?: string; appealLevel?: string; owner?: string; dueDate?: Date }>({
      query: ({ denialId, ...data }) => ({
        url: `${appealApiDetails.endpoint}/from-denial/${denialId}`,
        method: 'POST',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: [{ type: 'Appeal', id: 'LIST' }, { type: 'Denial', id: 'LIST' }],
    }),
    changeAppealStatus: builder.mutation<Appeal, { id: EntityId; appealStatus: string; submissionDate?: Date; payerResponse?: string; resolution?: string; outcome?: string; reason?: string }>({
      query: ({ id, ...data }) => ({
        url: `${appealApiDetails.endpoint}/${id}/status`,
        method: 'PATCH',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
    generateAppealPacket: builder.mutation<Appeal, { id: EntityId; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/generate-packet`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Appeal', id },
        { type: 'Appeal', id: 'LIST' },
        { type: 'Denial', id: 'LIST' },
        { type: 'ArWorkItem', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    runAppealReadiness: builder.mutation<Appeal, { id: EntityId; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/readiness`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    generateFinalAppealPacket: builder.mutation<Appeal, { id: EntityId; reason?: string; allowBlockedFinalPacket?: boolean; submissionMethod?: string; submissionChannel?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/generate-final-packet`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    generateAppealAiPacket: builder.mutation<Appeal, { id: EntityId; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/generate-ai-packet`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    getAppealTimeline: builder.query<AppealTimeline, EntityId>({
      query: (id) => ({ url: `${appealApiDetails.endpoint}/${id}/timeline`, method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<AppealTimeline>(response, appealApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Appeal', id }],
    }),
    getAppealDashboard: builder.query<AppealDashboard, void>({
      query: () => ({ url: `${appealApiDetails.endpoint}/ops/dashboard`, method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<AppealDashboard>(response, appealApiDetails.responseDataPath),
      providesTags: [{ type: 'Appeal', id: 'LIST' }],
    }),
    addAppealDocument: builder.mutation<Appeal, { id: EntityId; documentType?: string; fileName: string; fileReference?: string; fileUrl?: string; fileSize?: number; fileSizeBytes?: number; mimeType?: string; contentBase64?: string; notes?: string; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/documents`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    replaceAppealDocument: builder.mutation<Appeal, { id: EntityId; documentId: string; documentType?: string; fileName: string; fileReference?: string; fileUrl?: string; fileSize?: number; fileSizeBytes?: number; mimeType?: string; contentBase64?: string; notes?: string; reason?: string }>({
      query: ({ id, documentId, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/documents/${documentId}/replace`, method: 'PATCH', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    removeAppealDocument: builder.mutation<Appeal, { id: EntityId; documentId: string; reason: string }>({
      query: ({ id, documentId, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/documents/${documentId}/remove`, method: 'PATCH', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    recordAppealCorrespondence: builder.mutation<Appeal, { id: EntityId; correspondenceType?: string; status?: string; notes?: string; trackingNumber?: string; confirmationNumber?: string; destination?: string; channel?: string; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/correspondence`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    recordAppealSubmissionProof: builder.mutation<Appeal, { id: EntityId; channel?: string; confirmationNumber?: string; trackingNumber?: string; proofDocumentReference?: string; deliveredAt?: Date; deliveryStatus?: string; destination?: string; notes?: string; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/submission-proof`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    submitAppeal: builder.mutation<Appeal, { id: EntityId; reason?: string; submissionMethod?: string; submissionChannel?: string; trackingNumber?: string; confirmationNumber?: string; destination?: string; deliveryStatus?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/submit`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
    recordAppealPayerReceived: builder.mutation<Appeal, { id: EntityId; payerReferenceNumber?: string; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/record-payer-received`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    requestAppealMoreInfo: builder.mutation<Appeal, { id: EntityId; payerResponse?: string; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/request-more-info`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    submitAppealEvidence: builder.mutation<Appeal, { id: EntityId; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/submit-evidence`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    recordAppealOutcome: builder.mutation<Appeal, { id: EntityId; outcome: 'OVERTURNED' | 'PARTIALLY_OVERTURNED' | 'UPHELD'; decisionNotes?: string; expectedReprocessBy?: Date; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/record-outcome`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }, { type: 'Denial', id: 'LIST' }, { type: 'ArWorkItem', id: 'LIST' }],
    }),
    closeAppeal: builder.mutation<Appeal, { id: EntityId; reason?: string; notes?: string; outcomeCategory?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/close`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
    withdrawAppeal: builder.mutation<Appeal, { id: EntityId; reason?: string }>({
      query: ({ id, ...data }) => ({ url: `${appealApiDetails.endpoint}/${id}/withdraw`, method: 'POST', data }),
      transformResponse: (response: unknown) => {
        const item = normalizeAppeal(readResponsePath<unknown>(response, appealApiDetails.responseDataPath))
        if (!item) throw new Error('Appeal response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [{ type: 'Appeal', id }, { type: 'Appeal', id: 'LIST' }],
    }),
  }),
})

export const {
  useAddAppealDocumentMutation,
  useBulkDeleteAppealsMutation,
  useChangeAppealStatusMutation,
  useCloseAppealMutation,
  useCreateAppealMutation,
  useCreateAppealFromDenialMutation,
  useDeleteAppealMutation,
  useGenerateAppealPacketMutation,
  useGenerateAppealAiPacketMutation,
  useGenerateFinalAppealPacketMutation,
  useGetAppealQuery,
  useGetAppealDashboardQuery,
  useGetAppealTimelineQuery,
  useGetAppealsQuery,
  useRecordAppealCorrespondenceMutation,
  useRecordAppealOutcomeMutation,
  useRecordAppealPayerReceivedMutation,
  useRecordAppealSubmissionProofMutation,
  useRemoveAppealDocumentMutation,
  useReplaceAppealDocumentMutation,
  useRequestAppealMoreInfoMutation,
  useRunAppealReadinessMutation,
  useSubmitAppealEvidenceMutation,
  useSubmitAppealMutation,
  useUpdateAppealMutation,
  useWithdrawAppealMutation,
} = appealsApi
