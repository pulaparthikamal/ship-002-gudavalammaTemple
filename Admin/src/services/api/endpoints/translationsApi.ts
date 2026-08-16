import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export interface TranslateEntriesPayload {
  locale: string
  entries: Array<{ key: string; text: string }>
}

export const translationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    translateEntries: builder.mutation<Record<string, string>, TranslateEntriesPayload>({
      query: ({ locale, entries }) => ({
        url: `/translations/${locale}`,
        method: 'POST',
        data: { entries },
      }),
      transformResponse: (response: unknown) => readResponsePath<Record<string, string>>(response, 'translations') ?? {},
    }),
  }),
})

export const { useTranslateEntriesMutation } = translationsApi
