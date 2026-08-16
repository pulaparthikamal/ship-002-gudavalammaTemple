import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export interface Language {
  _id: string
  code: string
  name: string
  nativeName: string
  enabled: boolean
  isDefault: boolean
}

export const languagesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEnabledLanguages: builder.query<Language[], void>({
      query: () => ({ url: '/languages/enabled', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<Language[]>(response, 'languages') ?? [],
      providesTags: [{ type: 'Language' as const, id: 'ENABLED' }],
    }),
    getAllLanguages: builder.query<Language[], void>({
      query: () => ({ url: '/languages', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<Language[]>(response, 'languages') ?? [],
      providesTags: [{ type: 'Language' as const, id: 'LIST' }],
    }),
    setLanguageEnabled: builder.mutation<Language, { code: string; enabled: boolean }>({
      query: ({ code, enabled }) => ({
        url: `/languages/${code}`,
        method: 'PUT',
        data: { enabled },
      }),
      transformResponse: (response: unknown) => readResponsePath<Language>(response, 'language'),
      invalidatesTags: [
        { type: 'Language' as const, id: 'LIST' },
        { type: 'Language' as const, id: 'ENABLED' },
      ],
    }),
  }),
})

export const { useGetEnabledLanguagesQuery, useGetAllLanguagesQuery, useSetLanguageEnabledMutation } = languagesApi
