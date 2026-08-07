import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { chargeMasterApiDetails } from '@/models/chargeMasterModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ChargeMaster, ChargeMasterCreatePayload, ChargeMasterUpdatePayload } from '@/types/chargeMaster'

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

function normalizeChargeMaster(response: unknown): ChargeMaster | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    chargeMasterId:
      typeof item.chargeMasterId === 'string'
        ? item.chargeMasterId
        : typeof item.chargeMasterId === 'object' && item.chargeMasterId !== null && '_id' in item.chargeMasterId
          ? String((item.chargeMasterId as { _id?: string })._id ?? '')
          : '',
    cptCode: normalizeString(item.cptCode),
    description: normalizeOptionalString(item.description),
    revenueCode: normalizeOptionalString(item.revenueCode),
    defaultChargeAmount: normalizeOptionalNumber(item.defaultChargeAmount),
    defaultAllowedAmount: normalizeOptionalNumber(item.defaultAllowedAmount),
    placeOfService: normalizeOptionalString(item.placeOfService),
    modifiersAllowed: normalizeStringArray(item.modifiersAllowed),
    diagnosisRestrictions: normalizeStringArray(item.diagnosisRestrictions),
    effectiveDate: normalizeDateString(item.effectiveDate),
    terminationDate: normalizeDateString(item.terminationDate),
    activeFlag: Boolean(item.activeFlag),
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

const chargeMasterListDataPaths = [chargeMasterApiDetails.responseDataPath, 'data.data', 'items']
const chargeMasterListTotalPaths = [
  chargeMasterApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeChargeMasterListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<ChargeMaster> {
  return normalizeCrudListResponse<unknown, ChargeMaster>({
    response,
    query,
    dataPaths: chargeMasterListDataPaths,
    totalPaths: chargeMasterListTotalPaths,
    mapItem: normalizeChargeMaster,
  })
}

export const chargeMastersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getChargeMasters: builder.query<CrudListResponse<ChargeMaster>, CrudListQuery>({
      query: (query) => ({
        url: chargeMasterApiDetails.endpoint,
        method: 'GET',
        params: {
          [chargeMasterApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeChargeMasterListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ChargeMaster' as const, id: item._id })),
              { type: 'ChargeMaster' as const, id: 'LIST' },
            ]
          : [{ type: 'ChargeMaster' as const, id: 'LIST' }],
    }),
    getChargeMaster: builder.query<ChargeMaster, EntityId>({
      query: (id) => ({
        url: `${chargeMasterApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeChargeMaster(readResponsePath<unknown>(response, chargeMasterApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge Master response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'ChargeMaster', id }],
    }),
    createChargeMaster: builder.mutation<ChargeMaster, ChargeMasterCreatePayload>({
      query: (payload) => ({
        url: chargeMasterApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeChargeMaster(readResponsePath<unknown>(response, chargeMasterApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge Master response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'ChargeMaster', id: 'LIST' }],
    }),
    updateChargeMaster: builder.mutation<ChargeMaster, { id: EntityId; data: ChargeMasterUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${chargeMasterApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeChargeMaster(readResponsePath<unknown>(response, chargeMasterApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Charge Master response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ChargeMaster', id },
        { type: 'ChargeMaster', id: 'LIST' },
      ],
    }),
    deleteChargeMaster: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${chargeMasterApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'ChargeMaster', id },
        { type: 'ChargeMaster', id: 'LIST' },
      ],
    }),
    bulkDeleteChargeMasters: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${chargeMasterApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'ChargeMaster' as const, id })),
        { type: 'ChargeMaster' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteChargeMastersMutation,
  useCreateChargeMasterMutation,
  useDeleteChargeMasterMutation,
  useGetChargeMasterQuery,
  useGetChargeMastersQuery,
  useUpdateChargeMasterMutation,
} = chargeMastersApi
