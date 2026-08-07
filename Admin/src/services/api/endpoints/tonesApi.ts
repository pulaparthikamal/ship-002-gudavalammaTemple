import { apiSlice } from '@/services/api/apiSlice'
import type { Tone, ToneCreatePayload } from '@/types/tone'
import type { EntityId } from '@/types/common'

export const tonesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTones: builder.query<Tone[], void>({
      query: () => ({
        url: '/tones',
        method: 'GET',
      }),
      providesTags: ['Tone'],
      transformResponse: (response: any) => response.data || [],
    }),
    createTone: builder.mutation<Tone, ToneCreatePayload>({
      query: (data) => ({
        url: '/tones',
        method: 'POST',
        data: data,
      }),
      invalidatesTags: ['Tone'],
    }),
    deleteTone: builder.mutation<void, EntityId>({
      query: (id) => ({
        url: `/tones/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['Tone'],
    }),
  }),
})

export const {
  useGetTonesQuery,
  useCreateToneMutation,
  useDeleteToneMutation,
} = tonesApi
