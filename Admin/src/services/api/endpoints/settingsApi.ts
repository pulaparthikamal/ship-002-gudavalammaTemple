import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { Setting, SettingUpdatePayload } from '@/types/settings'

export const settingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSettings: builder.query<Setting[], void>({
      query: () => ({
        url: '/settings',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Setting[]>(response, 'data'),
      providesTags: (result) =>
        result
          ? [
            ...result.map((setting) => ({ type: 'Settings' as const, id: setting.key })),
            { type: 'Settings' as const, id: 'LIST' },
          ]
          : [{ type: 'Settings' as const, id: 'LIST' }],
    }),
    getSettingByKey: builder.query<Setting, string>({
      query: (key) => ({
        url: `/settings/${key}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Setting>(response, 'data'),
      providesTags: (_result, _error, key) => [{ type: 'Settings', id: key }],
    }),
    updateSetting: builder.mutation<Setting, { key: string; data: SettingUpdatePayload }>({
      query: ({ key, data }) => ({
        url: `/settings/${key}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Setting>(response, 'data'),
      invalidatesTags: (_result, _error, { key }) => [
        { type: 'Settings', id: key },
        { type: 'Settings', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetSettingsQuery,
  useGetSettingByKeyQuery,
  useUpdateSettingMutation,
} = settingsApi
