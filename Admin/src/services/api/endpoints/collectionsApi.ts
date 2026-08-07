import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { collectionApiDetails } from '@/models/collectionModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Collection, CollectionCreatePayload, CollectionUpdatePayload } from '@/types/collection'

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

function normalizeCollection(response: unknown): Collection | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    collectionId:
      typeof item.collectionId === 'string'
        ? item.collectionId
        : typeof item.collectionId === 'object' && item.collectionId !== null && '_id' in item.collectionId
          ? String((item.collectionId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    patientBillingId: normalizeOptionalString(item.patientBillingId),
    claimId: normalizeOptionalString(item.claimId),
    originalBalance: normalizeOptionalNumber(item.originalBalance),
    currentBalance: normalizeOptionalNumber(item.currentBalance),
    daysPastDue: normalizeOptionalNumber(item.daysPastDue),
    collectionStage: normalizeOptionalString(item.collectionStage),
    status: normalizeOptionalString(item.status),
    owner: normalizeOptionalString(item.owner),
    lastContactDate: normalizeDateString(item.lastContactDate),
    nextContactDate: normalizeDateString(item.nextContactDate),
    contactAttempts: normalizeOptionalNumber(item.contactAttempts),
    resolution: normalizeOptionalString(item.resolution),
    writeOffAmount: normalizeOptionalNumber(item.writeOffAmount),
    settlementAmount: normalizeOptionalNumber(item.settlementAmount),
    actionAudit: Array.isArray(item.actionAudit)
      ? item.actionAudit.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null)
      : [],
    balanceAmount: normalizeOptionalNumber(item.balanceAmount),
    agencyName: normalizeOptionalString(item.agencyName),
    referredDate: normalizeDateString(item.referredDate),
    collectionStatus: normalizeOptionalString(item.collectionStatus),
    recoveredAmount: normalizeOptionalNumber(item.recoveredAmount),
    closeDate: normalizeDateString(item.closeDate),
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

const collectionListDataPaths = [collectionApiDetails.responseDataPath, 'data.data', 'items']
const collectionListTotalPaths = [
  collectionApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeCollectionListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Collection> {
  return normalizeCrudListResponse<unknown, Collection>({
    response,
    query,
    dataPaths: collectionListDataPaths,
    totalPaths: collectionListTotalPaths,
    mapItem: normalizeCollection,
  })
}

export const collectionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCollections: builder.query<CrudListResponse<Collection>, CrudListQuery>({
      query: (query) => ({
        url: collectionApiDetails.endpoint,
        method: 'GET',
        params: {
          [collectionApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeCollectionListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Collection' as const, id: item._id })),
              { type: 'Collection' as const, id: 'LIST' },
            ]
          : [{ type: 'Collection' as const, id: 'LIST' }],
    }),
    getCollection: builder.query<Collection, EntityId>({
      query: (id) => ({
        url: `${collectionApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCollection(readResponsePath<unknown>(response, collectionApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Collection response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Collection', id }],
    }),
    createCollection: builder.mutation<Collection, CollectionCreatePayload>({
      query: (payload) => ({
        url: collectionApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCollection(readResponsePath<unknown>(response, collectionApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Collection response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Collection', id: 'LIST' }],
    }),
    updateCollection: builder.mutation<Collection, { id: EntityId; data: CollectionUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${collectionApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCollection(readResponsePath<unknown>(response, collectionApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Collection response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Collection', id },
        { type: 'Collection', id: 'LIST' },
      ],
    }),
    deleteCollection: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${collectionApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Collection', id },
        { type: 'Collection', id: 'LIST' },
      ],
    }),
    bulkDeleteCollections: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${collectionApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Collection' as const, id })),
        { type: 'Collection' as const, id: 'LIST' },
      ],
    }),
    generateCollections: builder.mutation<unknown, { daysOverdueThreshold?: number; minimumBalance?: number } | void>({
      query: (payload) => ({
        url: `${collectionApiDetails.endpoint}/generate`,
        method: 'POST',
        data: payload ?? {},
      }),
      invalidatesTags: [
        { type: 'Collection' as const, id: 'LIST' },
        { type: 'PatientBilling' as const, id: 'LIST' },
      ],
    }),
    runCollectionAction: builder.mutation<Collection, { id: EntityId; action: string; data?: Record<string, unknown> }>({
      query: ({ id, action, data }) => ({
        url: `${collectionApiDetails.endpoint}/${id}/actions/${action}`,
        method: 'POST',
        data: data ?? {},
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeCollection(readResponsePath<unknown>(response, collectionApiDetails.responseDataPath))
        if (!item) throw new Error('Collection response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Collection', id },
        { type: 'Collection', id: 'LIST' },
        { type: 'PatientBilling', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteCollectionsMutation,
  useCreateCollectionMutation,
  useDeleteCollectionMutation,
  useGenerateCollectionsMutation,
  useGetCollectionQuery,
  useGetCollectionsQuery,
  useRunCollectionActionMutation,
  useUpdateCollectionMutation,
} = collectionsApi
