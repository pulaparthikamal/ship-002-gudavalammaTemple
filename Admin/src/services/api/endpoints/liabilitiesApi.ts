import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { liabilityApiDetails } from '@/models/liabilityModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Liability, LiabilityCreatePayload, LiabilityUpdatePayload } from '@/types/liability'

const liabilityListDataPaths = [
  liabilityApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const liabilityListTotalPaths = [
  liabilityApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeLiabilityListResponse(response: unknown, query: CrudListQuery): CrudListResponse<Liability> {
  return normalizeCrudListResponse<Liability>({
    response,
    query,
    dataPaths: liabilityListDataPaths,
    totalPaths: liabilityListTotalPaths,
  })
}

export const liabilitiesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getLiabilities: builder.query<CrudListResponse<Liability>, CrudListQuery>({
      query: (query) => ({
        url: liabilityApiDetails.endpoint,
        method: 'GET',
        params: {
          [liabilityApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeLiabilityListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((liability) => ({ type: 'Liability' as const, id: liability._id })),
              { type: 'Liability' as const, id: 'LIST' },
            ]
          : [{ type: 'Liability' as const, id: 'LIST' }],
    }),
    getLiability: builder.query<Liability, EntityId>({
      query: (id) => ({
        url: `${liabilityApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Liability>(response, liabilityApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Liability', id }],
    }),
    createLiability: builder.mutation<Liability, LiabilityCreatePayload>({
      query: (payload) => ({
        url: liabilityApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Liability>(response, liabilityApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'Liability', id: 'LIST' }],
    }),
    updateLiability: builder.mutation<Liability, { id: EntityId; data: LiabilityUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${liabilityApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Liability>(response, liabilityApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Liability', id },
        { type: 'Liability', id: 'LIST' },
      ],
    }),
    deleteLiability: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${liabilityApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Liability', id },
        { type: 'Liability', id: 'LIST' },
      ],
    }),
    bulkDeleteLiabilities: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${liabilityApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Liability' as const, id })),
        { type: 'Liability' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetLiabilitiesQuery,
  useGetLiabilityQuery,
  useCreateLiabilityMutation,
  useUpdateLiabilityMutation,
  useDeleteLiabilityMutation,
  useBulkDeleteLiabilitiesMutation,
} = liabilitiesApi
