import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { donorApiDetails } from '@/models/donorModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Donor, DonorCreatePayload, DonorUpdatePayload } from '@/types/donor'

const donorListDataPaths = [
  donorApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const donorListTotalPaths = [
  donorApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeDonorListResponse(response: unknown, query: CrudListQuery): CrudListResponse<Donor> {
  return normalizeCrudListResponse<Donor>({
    response,
    query,
    dataPaths: donorListDataPaths,
    totalPaths: donorListTotalPaths,
  })
}

export const donorsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDonors: builder.query<CrudListResponse<Donor>, CrudListQuery>({
      query: (query) => ({
        url: donorApiDetails.endpoint,
        method: 'GET',
        params: {
          [donorApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeDonorListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((donor) => ({ type: 'Donor' as const, id: donor._id })),
              { type: 'Donor' as const, id: 'LIST' },
            ]
          : [{ type: 'Donor' as const, id: 'LIST' }],
    }),
    getDonor: builder.query<Donor, EntityId>({
      query: (id) => ({
        url: `${donorApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Donor>(response, donorApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Donor', id }],
    }),
    createDonor: builder.mutation<Donor, DonorCreatePayload>({
      query: (payload) => ({
        url: donorApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Donor>(response, donorApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'Donor', id: 'LIST' }],
    }),
    updateDonor: builder.mutation<Donor, { id: EntityId; data: DonorUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${donorApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Donor>(response, donorApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Donor', id },
        { type: 'Donor', id: 'LIST' },
      ],
    }),
    deleteDonor: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${donorApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Donor', id },
        { type: 'Donor', id: 'LIST' },
      ],
    }),
    bulkDeleteDonors: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${donorApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Donor' as const, id })),
        { type: 'Donor' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetDonorsQuery,
  useGetDonorQuery,
  useCreateDonorMutation,
  useUpdateDonorMutation,
  useDeleteDonorMutation,
  useBulkDeleteDonorsMutation,
} = donorsApi
