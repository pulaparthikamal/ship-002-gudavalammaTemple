import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export type NearbyPlaceCategory = 'heritage' | 'nature' | 'shopping' | 'food' | 'accommodation' | 'other'

export interface NearbyPlace {
  _id: string
  name: string
  description: string
  distanceKm: number
  imageUrl?: string
  category: NearbyPlaceCategory
  mapLink?: string
  active: boolean
}

export interface NearbyPlacePayload {
  name: string
  description?: string
  distanceKm: number
  imageUrl?: string
  category?: NearbyPlaceCategory
  mapLink?: string
  active?: boolean
}

export const nearbyPlacesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getNearbyPlaces: builder.query<NearbyPlace[], void>({
      query: () => ({ url: '/nearby-places', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<NearbyPlace[]>(response, 'nearbyPlaces') ?? [],
      providesTags: [{ type: 'NearbyPlace' as const, id: 'LIST' }],
    }),
    createNearbyPlace: builder.mutation<NearbyPlace, NearbyPlacePayload>({
      query: (payload) => ({ url: '/nearby-places', method: 'POST', data: payload }),
      transformResponse: (response: unknown) => readResponsePath<NearbyPlace>(response, 'nearbyPlace'),
      invalidatesTags: [{ type: 'NearbyPlace' as const, id: 'LIST' }],
    }),
    updateNearbyPlace: builder.mutation<NearbyPlace, { id: EntityId; data: Partial<NearbyPlacePayload> }>({
      query: ({ id, data }) => ({ url: `/nearby-places/${id}`, method: 'PUT', data }),
      transformResponse: (response: unknown) => readResponsePath<NearbyPlace>(response, 'nearbyPlace'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'NearbyPlace' as const, id },
        { type: 'NearbyPlace' as const, id: 'LIST' },
      ],
    }),
    deleteNearbyPlace: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `/nearby-places/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'NearbyPlace' as const, id },
        { type: 'NearbyPlace' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetNearbyPlacesQuery,
  useCreateNearbyPlaceMutation,
  useUpdateNearbyPlaceMutation,
  useDeleteNearbyPlaceMutation,
} = nearbyPlacesApi
