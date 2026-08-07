import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { priorAuthorizationApiDetails } from '@/models/priorAuthorizationModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { PriorAuthorization, PriorAuthorizationCreatePayload, PriorAuthorizationUpdatePayload } from '@/types/priorAuthorization'

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

function normalizePriorAuthorization(response: unknown): PriorAuthorization | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    authorizationId:
      typeof item.authorizationId === 'string'
        ? item.authorizationId
        : typeof item.authorizationId === 'object' && item.authorizationId !== null && '_id' in item.authorizationId
          ? String((item.authorizationId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    insuranceId: normalizeOptionalString(item.insuranceId),
    payerId: normalizeOptionalString(item.payerId),
    providerId: normalizeOptionalString(item.providerId),
    facilityId: normalizeOptionalString(item.facilityId),
    serviceDate: normalizeDateString(item.serviceDate),
    placeOfService: normalizeOptionalString(item.placeOfService),
    procedureCodes: normalizeStringArray(item.procedureCodes),
    diagnosisCodes: normalizeStringArray(item.diagnosisCodes),
    modifiers: normalizeStringArray(item.modifiers),
    authorizationRequired: Boolean(item.authorizationRequired),
    authorizationType: normalizeOptionalString(item.authorizationType),
    requestDate: normalizeDateString(item.requestDate),
    requestedUnits: normalizeOptionalNumber(item.requestedUnits),
    approvedUnits: normalizeOptionalNumber(item.approvedUnits),
    authNumber: normalizeString(item.authNumber),
    authorizationStatus: normalizeOptionalString(item.authorizationStatus),
    expirationDate: normalizeDateString(item.expirationDate),
    denialReason: normalizeOptionalString(item.denialReason),
    notes: normalizeOptionalString(item.notes),
    automationStatus: normalizeOptionalString(item.automationStatus),
    payerPortalReference: normalizeOptionalString(item.payerPortalReference),
    authPacket: typeof item.authPacket === 'object' && item.authPacket !== null ? item.authPacket as Record<string, unknown> : undefined,
    documentChecklist: Array.isArray(item.documentChecklist) ? item.documentChecklist.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : [],
    statusCheckHistory: Array.isArray(item.statusCheckHistory) ? item.statusCheckHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : [],
    statusHistory: normalizeStringArray(item.statusHistory),
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

const priorAuthorizationListDataPaths = [priorAuthorizationApiDetails.responseDataPath, 'data.data', 'items']
const priorAuthorizationListTotalPaths = [
  priorAuthorizationApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePriorAuthorizationListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<PriorAuthorization> {
  return normalizeCrudListResponse<unknown, PriorAuthorization>({
    response,
    query,
    dataPaths: priorAuthorizationListDataPaths,
    totalPaths: priorAuthorizationListTotalPaths,
    mapItem: normalizePriorAuthorization,
  })
}

export const priorAuthorizationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPriorAuthorizations: builder.query<CrudListResponse<PriorAuthorization>, CrudListQuery>({
      query: (query) => ({
        url: priorAuthorizationApiDetails.endpoint,
        method: 'GET',
        params: {
          [priorAuthorizationApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizePriorAuthorizationListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'PriorAuthorization' as const, id: item._id })),
              { type: 'PriorAuthorization' as const, id: 'LIST' },
            ]
          : [{ type: 'PriorAuthorization' as const, id: 'LIST' }],
    }),
    getPriorAuthorization: builder.query<PriorAuthorization, EntityId>({
      query: (id) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePriorAuthorization(readResponsePath<unknown>(response, priorAuthorizationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Prior Authorization response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'PriorAuthorization', id }],
    }),
    createPriorAuthorization: builder.mutation<PriorAuthorization, PriorAuthorizationCreatePayload>({
      query: (payload) => ({
        url: priorAuthorizationApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePriorAuthorization(readResponsePath<unknown>(response, priorAuthorizationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Prior Authorization response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'PriorAuthorization', id: 'LIST' }],
    }),
    updatePriorAuthorization: builder.mutation<PriorAuthorization, { id: EntityId; data: PriorAuthorizationUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePriorAuthorization(readResponsePath<unknown>(response, priorAuthorizationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Prior Authorization response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PriorAuthorization', id },
        { type: 'PriorAuthorization', id: 'LIST' },
      ],
    }),
    deletePriorAuthorization: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'PriorAuthorization', id },
        { type: 'PriorAuthorization', id: 'LIST' },
      ],
    }),
    bulkDeletePriorAuthorizations: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'PriorAuthorization' as const, id })),
        { type: 'PriorAuthorization' as const, id: 'LIST' },
      ],
    }),
    generatePriorAuthorizationPacket: builder.mutation<PriorAuthorization, EntityId>({
      query: (id) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/${id}/generate-packet`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePriorAuthorization(readResponsePath<unknown>(response, priorAuthorizationApiDetails.responseDataPath))
        if (!item) {
          throw new Error('Prior Authorization response is invalid.')
        }
        return item
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'PriorAuthorization', id },
        { type: 'PriorAuthorization', id: 'LIST' },
      ],
    }),
    submitPriorAuthorizationPacket: builder.mutation<PriorAuthorization, EntityId>({
      query: (id) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/${id}/submit-packet`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePriorAuthorization(readResponsePath<unknown>(response, priorAuthorizationApiDetails.responseDataPath))
        if (!item) {
          throw new Error('Prior Authorization response is invalid.')
        }
        return item
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'PriorAuthorization', id },
        { type: 'PriorAuthorization', id: 'LIST' },
      ],
    }),
    checkPriorAuthorizationPayerStatus: builder.mutation<PriorAuthorization, EntityId>({
      query: (id) => ({
        url: `${priorAuthorizationApiDetails.endpoint}/${id}/check-payer-status`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizePriorAuthorization(readResponsePath<unknown>(response, priorAuthorizationApiDetails.responseDataPath))
        if (!item) {
          throw new Error('Prior Authorization response is invalid.')
        }
        return item
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'PriorAuthorization', id },
        { type: 'PriorAuthorization', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeletePriorAuthorizationsMutation,
  useCreatePriorAuthorizationMutation,
  useDeletePriorAuthorizationMutation,
  useGeneratePriorAuthorizationPacketMutation,
  useGetPriorAuthorizationQuery,
  useGetPriorAuthorizationsQuery,
  useCheckPriorAuthorizationPayerStatusMutation,
  useSubmitPriorAuthorizationPacketMutation,
  useUpdatePriorAuthorizationMutation,
} = priorAuthorizationsApi
