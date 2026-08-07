import { apiSlice } from '@/services/api/apiSlice'

export interface PublishingFrequency {
  _id: string
  label: string
  value: number
  active: boolean
  order: number
}

export const publishingFrequencyApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPublishingFrequencies: builder.query<PublishingFrequency[], void>({
      query: () => ({
        url: 'publishingFrequencies',
        method: 'GET',
        secured: false,
      }),
      transformResponse: (response: any) => response.data || [],
      providesTags: [{ type: 'PublishingFrequency' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetPublishingFrequenciesQuery } = publishingFrequencyApi
