import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { codingReviewApiDetails } from '@/models/codingReviewModel'
import { normalizeClaim } from '@/services/api/endpoints/claimsApi'
import { normalizePatientBilling } from '@/services/api/endpoints/patientBillingsApi'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { CodingReview, CodingReviewCreatePayload, CodingReviewUpdatePayload } from '@/types/codingReview'
import type { CodingReviewApproveResult } from '@/types/rcmWorkflow'

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

function normalizeCodingFailureExplanations(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          lineNumber: normalizeOptionalNumber(item.lineNumber),
          field: normalizeString(item.field),
          title: normalizeString(item.title),
          explanation: normalizeString(item.explanation),
          correction: normalizeString(item.correction),
          source: normalizeString(item.source),
        }))
        .filter((item) => item.title && item.explanation && item.correction)
    : []
}

function normalizeApprovedCodingSnapshot(value: unknown) {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }

  const item = value as Record<string, unknown>

  return {
    sourceChargeUpdatedAt: normalizeDateString(item.sourceChargeUpdatedAt),
    snapshotHash: normalizeOptionalString(item.snapshotHash),
    approvedAt: normalizeDateString(item.approvedAt),
    lines: Array.isArray(item.lines)
      ? item.lines
          .filter((line): line is Record<string, unknown> => typeof line === 'object' && line !== null)
          .map((line) => ({
            lineNumber: normalizeOptionalNumber(line.lineNumber),
            chargeLineId: normalizeOptionalString(line.chargeLineId),
            cptCode: normalizeOptionalString(line.cptCode),
            modifiers: normalizeStringArray(line.modifiers),
            icdCodes: normalizeStringArray(line.icdCodes),
            icdPointers: normalizeNumberArray(line.icdPointers),
            units: normalizeOptionalNumber(line.units),
            chargeAmount: normalizeOptionalNumber(line.chargeAmount),
            placeOfService: normalizeOptionalString(line.placeOfService),
            renderingProviderId: normalizeOptionalString(line.renderingProviderId),
            serviceDateFrom: normalizeDateString(line.serviceDateFrom),
            serviceDateTo: normalizeDateString(line.serviceDateTo),
          }))
      : [],
  }
}

export function normalizeCodingReview(response: unknown): CodingReview | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    scrubId:
      typeof item.scrubId === 'string'
        ? item.scrubId
        : typeof item.scrubId === 'object' && item.scrubId !== null && '_id' in item.scrubId
          ? String((item.scrubId as { _id?: string })._id ?? '')
          : '',
    chargeId: normalizeOptionalString(item.chargeId),
    encounterId: normalizeOptionalString(item.encounterId),
    patientId: normalizeOptionalString(item.patientId),
    scrubStatus: normalizeString(item.scrubStatus),
    codingRiskLevel: normalizeOptionalString(item.codingRiskLevel),
    validationErrors: normalizeStringArray(item.validationErrors),
    missingDocumentationFlag: Boolean(item.missingDocumentationFlag),
    modifierIssues: normalizeStringArray(item.modifierIssues),
    icdCptMismatchFlag: Boolean(item.icdCptMismatchFlag),
    ncciEditFlag: Boolean(item.ncciEditFlag),
    lcdNcdEditFlag: Boolean(item.lcdNcdEditFlag),
    payerSpecificRuleFailures: normalizeStringArray(item.payerSpecificRuleFailures),
    aiSuggestedCodes: normalizeStringArray(item.aiSuggestedCodes),
    aiSuggestedFixes: normalizeStringArray(item.aiSuggestedFixes),
    codingFailureExplanations: normalizeCodingFailureExplanations(item.codingFailureExplanations),
    approvedCodingSnapshot: normalizeApprovedCodingSnapshot(item.approvedCodingSnapshot),
    reviewedBy: normalizeOptionalString(item.reviewedBy),
    reviewedAt: normalizeDateString(item.reviewedAt),
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

const codingReviewListDataPaths = [codingReviewApiDetails.responseDataPath, 'data.data', 'items']
const codingReviewListTotalPaths = [
  codingReviewApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeCodingReviewListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<CodingReview> {
  return normalizeCrudListResponse<unknown, CodingReview>({
    response,
    query,
    dataPaths: codingReviewListDataPaths,
    totalPaths: codingReviewListTotalPaths,
    mapItem: normalizeCodingReview,
  })
}

export const codingReviewsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCodingReviews: builder.query<CrudListResponse<CodingReview>, CrudListQuery>({
      query: (query) => ({
        url: codingReviewApiDetails.endpoint,
        method: 'GET',
        params: {
          [codingReviewApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeCodingReviewListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'CodingReview' as const, id: item._id })),
              { type: 'CodingReview' as const, id: 'LIST' },
            ]
          : [{ type: 'CodingReview' as const, id: 'LIST' }],
    }),
    getCodingReview: builder.query<CodingReview, EntityId>({
      query: (id) => ({
        url: `${codingReviewApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCodingReview(readResponsePath<unknown>(response, codingReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Coding Review response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'CodingReview', id }],
    }),
    createCodingReview: builder.mutation<CodingReview, CodingReviewCreatePayload>({
      query: (payload) => ({
        url: codingReviewApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCodingReview(readResponsePath<unknown>(response, codingReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Coding Review response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'CodingReview', id: 'LIST' }],
    }),
    updateCodingReview: builder.mutation<CodingReview, { id: EntityId; data: CodingReviewUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${codingReviewApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCodingReview(readResponsePath<unknown>(response, codingReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Coding Review response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'CodingReview', id },
        { type: 'CodingReview', id: 'LIST' },
      ],
    }),
    deleteCodingReview: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${codingReviewApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'CodingReview', id },
        { type: 'CodingReview', id: 'LIST' },
      ],
    }),
    bulkDeleteCodingReviews: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${codingReviewApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'CodingReview' as const, id })),
        { type: 'CodingReview' as const, id: 'LIST' },
      ],
    }),
    createCodingReviewFromCharge: builder.mutation<CodingReview, EntityId>({
      query: (chargeId) => ({
        url: `${codingReviewApiDetails.endpoint}/from-charge/${chargeId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCodingReview(readResponsePath<unknown>(response, codingReviewApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Coding Review response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'CodingReview', id: 'LIST' }],
    }),
    approveCodingReview: builder.mutation<CodingReviewApproveResult, EntityId>({
      query: (id) => ({
        url: `${codingReviewApiDetails.endpoint}/${id}/approve`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown) => {
        const codingReview = normalizeCodingReview(readResponsePath<unknown>(response, 'data.codingReview'))
        const claim = normalizeClaim(readResponsePath<unknown>(response, 'data.claim'))
        const billing = normalizePatientBilling(readResponsePath<unknown>(response, 'data.billing'))

        if (!codingReview || (!claim && !billing)) {
          throw new Error('Coding Review approval response is invalid.')
        }

        return {
          codingReview,
          claim: claim ?? undefined,
          billing: billing ?? undefined,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'CodingReview', id },
        { type: 'CodingReview', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
        { type: 'PatientBilling', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useApproveCodingReviewMutation,
  useBulkDeleteCodingReviewsMutation,
  useCreateCodingReviewFromChargeMutation,
  useCreateCodingReviewMutation,
  useDeleteCodingReviewMutation,
  useGetCodingReviewQuery,
  useGetCodingReviewsQuery,
  useUpdateCodingReviewMutation,
} = codingReviewsApi
