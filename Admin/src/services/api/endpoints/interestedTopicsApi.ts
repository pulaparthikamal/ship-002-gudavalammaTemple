import { apiSlice } from '@/services/api/apiSlice'

export interface InterestTopic {
  _id: string
  category: string
  subTopics: string[]
  active: boolean
  order: number
}

export const interestedTopicsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInterestedTopics: builder.query<InterestTopic[], void>({
      query: () => ({
        url: 'interestedTopics',
        method: 'GET',
        secured: false,
      }),
      transformResponse: (response: any) => response.data || [],
      providesTags: [{ type: 'InterestedTopic' as const, id: 'LIST' }],
    }),
  }),
})

export const { useGetInterestedTopicsQuery } = interestedTopicsApi
