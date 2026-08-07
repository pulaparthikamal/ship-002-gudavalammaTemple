import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { chargeApiDetails } from '@/models/chargeModel'
import { normalizeCodingReview } from '@/services/api/endpoints/codingReviewsApi'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Charge, ChargeCreatePayload, ChargeUpdatePayload } from '@/types/charge'
import type { ChargeSubmitForReviewResult } from '@/types/rcmWorkflow'

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

export function normalizeCharge(response: unknown): Charge | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    chargeId:
      typeof item.chargeId === 'string'
        ? item.chargeId
        : typeof item.chargeId === 'object' && item.chargeId !== null && '_id' in item.chargeId
          ? String((item.chargeId as { _id?: string })._id ?? '')
          : '',
    encounterId: normalizeOptionalString(item.encounterId),
    patientId: normalizeOptionalString(item.patientId),
    providerId: normalizeOptionalString(item.providerId),
    facilityId: normalizeOptionalString(item.facilityId),
    serviceDate: normalizeDateString(item.serviceDate),
    placeOfService: normalizeOptionalString(item.placeOfService),
    totalChargeAmount: normalizeOptionalNumber(item.totalChargeAmount),
    chargeStatus: normalizeOptionalString(item.chargeStatus),
    codingReviewStatus: normalizeOptionalString(item.codingReviewStatus),
    documentationComplete: Boolean(item.documentationComplete),
    validationErrors: normalizeStringArray(item.validationErrors),
    createdBy: normalizeOptionalString(item.createdBy),
    reviewedBy: normalizeOptionalString(item.reviewedBy),
    chargeLines: Array.isArray(item.chargeLines)
      ? item.chargeLines
          .filter((child): child is Record<string, unknown> => typeof child === 'object' && child !== null)
          .map((child) => ({
            lineNumber: normalizeOptionalNumber(child.lineNumber),
            cptCode: normalizeOptionalString(child.cptCode),
            icdCodes: normalizeStringArray(child.icdCodes),
            icdPointers: normalizeNumberArray(child.icdPointers),
            modifiers: normalizeStringArray(child.modifiers),
            units: normalizeOptionalNumber(child.units),
            chargeAmount: normalizeOptionalNumber(child.chargeAmount),
            diagnosisLinking: normalizeOptionalString(child.diagnosisLinking),
            renderingProviderId: normalizeOptionalString(child.renderingProviderId),
            expectedAllowedAmount: normalizeOptionalNumber(child.expectedAllowedAmount),
            feeScheduleId: normalizeOptionalString(child.feeScheduleId),
            pricingStatus: normalizeOptionalString(child.pricingStatus),
            pricingMessage: normalizeOptionalString(child.pricingMessage),
            pricingMatchedBy: normalizeOptionalString(child.pricingMatchedBy),
            pricingSource: normalizeOptionalString(child.pricingSource),
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
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const chargeListDataPaths = [chargeApiDetails.responseDataPath, 'data.data', 'items']
const chargeListTotalPaths = [
  chargeApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeChargeListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Charge> {
  return normalizeCrudListResponse<unknown, Charge>({
    response,
    query,
    dataPaths: chargeListDataPaths,
    totalPaths: chargeListTotalPaths,
    mapItem: normalizeCharge,
  })
}

export const chargesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCharges: builder.query<CrudListResponse<Charge>, CrudListQuery>({
      query: (query) => ({
        url: chargeApiDetails.endpoint,
        method: 'GET',
        params: {
          [chargeApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeChargeListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Charge' as const, id: item._id })),
              { type: 'Charge' as const, id: 'LIST' },
            ]
          : [{ type: 'Charge' as const, id: 'LIST' }],
    }),
    getCharge: builder.query<Charge, EntityId>({
      query: (id) => ({
        url: `${chargeApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCharge(readResponsePath<unknown>(response, chargeApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Charge', id }],
    }),
    createCharge: builder.mutation<Charge, ChargeCreatePayload>({
      query: (payload) => ({
        url: chargeApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCharge(readResponsePath<unknown>(response, chargeApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Charge', id: 'LIST' }],
    }),
    updateCharge: builder.mutation<Charge, { id: EntityId; data: ChargeUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${chargeApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCharge(readResponsePath<unknown>(response, chargeApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Charge', id },
        { type: 'Charge', id: 'LIST' },
      ],
    }),
    deleteCharge: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${chargeApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Charge', id },
        { type: 'Charge', id: 'LIST' },
      ],
    }),
    bulkDeleteCharges: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${chargeApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Charge' as const, id })),
        { type: 'Charge' as const, id: 'LIST' },
      ],
    }),
    createChargeFromEncounter: builder.mutation<Charge, EntityId>({
      query: (encounterId) => ({
        url: `${chargeApiDetails.endpoint}/from-encounter/${encounterId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCharge(readResponsePath<unknown>(response, chargeApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Charge', id: 'LIST' }],
    }),
    submitChargeForReview: builder.mutation<ChargeSubmitForReviewResult, EntityId>({
      query: (id) => ({
        url: `${chargeApiDetails.endpoint}/${id}/submit-review`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown) => {
        const charge = normalizeCharge(readResponsePath<unknown>(response, 'data.charge'))
        const codingReview = normalizeCodingReview(readResponsePath<unknown>(response, 'data.codingReview'))

        if (!charge || !codingReview) {
          throw new Error('Charge submit review response is invalid.')
        }

        return {
          charge,
          codingReview,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Charge', id },
        { type: 'Charge', id: 'LIST' },
        { type: 'CodingReview', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteChargesMutation,
  useCreateChargeFromEncounterMutation,
  useCreateChargeMutation,
  useDeleteChargeMutation,
  useGetChargeQuery,
  useGetChargesQuery,
  useSubmitChargeForReviewMutation,
  useUpdateChargeMutation,
} = chargesApi
