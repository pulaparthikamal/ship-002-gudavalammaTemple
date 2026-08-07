import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { TableViewPreference } from '@/types/tableView'

export const tableViewsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTableViewPreference: builder.query<TableViewPreference, string>({
      query: (tableId) => ({
        url: `/tableViews/${encodeURIComponent(tableId)}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<TableViewPreference>(response, 'data'),
      providesTags: (_result, _error, tableId) => [{ type: 'TableView', id: tableId }],
    }),
    updateTableViewPreference: builder.mutation<
      TableViewPreference,
      { tableId: string; data: Omit<TableViewPreference, 'tableId'> }
    >({
      query: ({ tableId, data }) => ({
        url: `/tableViews/${encodeURIComponent(tableId)}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<TableViewPreference>(response, 'data'),
      invalidatesTags: (_result, _error, { tableId }) => [{ type: 'TableView', id: tableId }],
    }),
  }),
})

export const {
  useGetTableViewPreferenceQuery,
  useUpdateTableViewPreferenceMutation,
} = tableViewsApi
