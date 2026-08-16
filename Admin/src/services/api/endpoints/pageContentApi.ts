import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { PageContentVersion, ScreenKey, Widget } from '@/types/pageContent'

export const pageContentApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPublishedPageContent: builder.query<Widget[], ScreenKey>({
      query: (screenKey) => ({ url: `/page-content/${screenKey}`, method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<Widget[]>(response, 'widgets') ?? [],
      providesTags: (_result, _error, screenKey) => [{ type: 'PageContent' as const, id: `${screenKey}:published` }],
    }),
    getDraftPageContent: builder.query<Widget[], ScreenKey>({
      query: (screenKey) => ({ url: `/page-content/${screenKey}/draft`, method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<Widget[]>(response, 'widgets') ?? [],
      providesTags: (_result, _error, screenKey) => [{ type: 'PageContent' as const, id: `${screenKey}:draft` }],
    }),
    saveDraftPageContent: builder.mutation<Widget[], { screenKey: ScreenKey; widgets: Widget[] }>({
      query: ({ screenKey, widgets }) => ({
        url: `/page-content/${screenKey}/draft`,
        method: 'PUT',
        data: { widgets },
      }),
      transformResponse: (response: unknown) => readResponsePath<Widget[]>(response, 'widgets') ?? [],
      invalidatesTags: (_result, _error, { screenKey }) => [{ type: 'PageContent' as const, id: `${screenKey}:draft` }],
    }),
    publishPageContent: builder.mutation<Widget[], ScreenKey>({
      query: (screenKey) => ({ url: `/page-content/${screenKey}/publish`, method: 'POST' }),
      transformResponse: (response: unknown) => readResponsePath<Widget[]>(response, 'widgets') ?? [],
      invalidatesTags: (_result, _error, screenKey) => [
        { type: 'PageContent' as const, id: `${screenKey}:published` },
        { type: 'PageContent' as const, id: `${screenKey}:draft` },
        { type: 'PageContent' as const, id: `${screenKey}:versions` },
      ],
    }),
    listPageContentVersions: builder.query<PageContentVersion[], ScreenKey>({
      query: (screenKey) => ({ url: `/page-content/${screenKey}/versions`, method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<PageContentVersion[]>(response, 'versions') ?? [],
      providesTags: (_result, _error, screenKey) => [{ type: 'PageContent' as const, id: `${screenKey}:versions` }],
    }),
    restorePageContentVersion: builder.mutation<Widget[], { screenKey: ScreenKey; versionId: string }>({
      query: ({ screenKey, versionId }) => ({
        url: `/page-content/${screenKey}/versions/${versionId}/restore`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => readResponsePath<Widget[]>(response, 'widgets') ?? [],
      invalidatesTags: (_result, _error, { screenKey }) => [{ type: 'PageContent' as const, id: `${screenKey}:draft` }],
    }),
  }),
})

export const {
  useGetPublishedPageContentQuery,
  useGetDraftPageContentQuery,
  useSaveDraftPageContentMutation,
  usePublishPageContentMutation,
  useListPageContentVersionsQuery,
  useRestorePageContentVersionMutation,
} = pageContentApi
