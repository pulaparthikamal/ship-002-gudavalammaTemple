import { apiSlice } from '@/services/api/apiSlice'
import type { Platform, PlatformCreatePayload } from '@/types/platform'
import type { EntityId } from '@/types/common'

export const platformsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPlatforms: builder.query<Platform[], void>({
      query: () => ({
        url: '/platforms',
        method: 'GET',
      }),
      providesTags: ['Platform'],
      transformResponse: (response: any) => response.data || [],
    }),
    createPlatform: builder.mutation<Platform, PlatformCreatePayload>({
      query: (data) => ({
        url: '/platforms',
        method: 'POST',
        data: data,
      }),
      invalidatesTags: ['Platform'],
    }),
    deletePlatform: builder.mutation<void, EntityId>({
      query: (id) => ({
        url: `/platforms/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Platform'],
    }),
  }),
})

export const {
  useGetPlatformsQuery,
  useCreatePlatformMutation,
  useDeletePlatformMutation,
} = platformsApi
