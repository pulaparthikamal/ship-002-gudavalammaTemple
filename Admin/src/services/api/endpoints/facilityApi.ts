import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export interface Facility {
  _id: string
  slug: string
  name: string
  description: string
  icon?: string
  active: boolean
}

export interface FacilityPayload {
  slug: string
  name: string
  description: string
  icon?: string
  active?: boolean
}

export const facilityApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFacilities: builder.query<Facility[], void>({
      query: () => ({
        url: '/facilities',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Facility[]>(response, 'facilities') ?? [],
    }),
    getAllFacilities: builder.query<Facility[], void>({
      query: () => ({
        url: '/facilities/all',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Facility[]>(response, 'facilities') ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((facility) => ({ type: 'Facility' as const, id: facility._id })),
              { type: 'Facility' as const, id: 'LIST' },
            ]
          : [{ type: 'Facility' as const, id: 'LIST' }],
    }),
    createFacility: builder.mutation<Facility, FacilityPayload>({
      query: (payload) => ({
        url: '/facilities',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Facility>(response, 'facility'),
      invalidatesTags: [{ type: 'Facility', id: 'LIST' }],
    }),
    updateFacility: builder.mutation<Facility, { id: EntityId; data: Partial<FacilityPayload> }>({
      query: ({ id, data }) => ({
        url: `/facilities/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Facility>(response, 'facility'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Facility', id },
        { type: 'Facility', id: 'LIST' },
      ],
    }),
    deleteFacility: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/facilities/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Facility', id },
        { type: 'Facility', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetFacilitiesQuery,
  useGetAllFacilitiesQuery,
  useCreateFacilityMutation,
  useUpdateFacilityMutation,
  useDeleteFacilityMutation,
} = facilityApi
