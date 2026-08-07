import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ServerConnection, ConnectServerPayload } from '@/types/serverManagement'

const DATA_PATHS = ['data', 'data.data', 'items']
const TOTAL_PATHS = ['meta.total', 'meta.totalRecords', 'data.total', 'data.totalRecords', 'total', 'totalRecords']

function normalizeServer(response: unknown): ServerConnection | null {
  if (typeof response !== 'object' || response === null) return null
  const s = response as Record<string, unknown>
  if (typeof s._id !== 'string') return null
  return s as unknown as ServerConnection
}

function normalizeServerListResponse(response: unknown, query: CrudListQuery): CrudListResponse<ServerConnection> {
  return normalizeCrudListResponse<unknown, ServerConnection>({
    response,
    query,
    dataPaths: DATA_PATHS,
    totalPaths: TOTAL_PATHS,
    mapItem: normalizeServer,
  })
}

function hasPemFile(payload: Partial<ConnectServerPayload>): payload is Partial<ConnectServerPayload> & { pemFile: File } {
  return payload.pemFile instanceof File
}

function toServerFormData(payload: Partial<ConnectServerPayload>) {
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return
    if (key === 'pemFile' && value instanceof File) {
      formData.append('pemFile', value)
      return
    }
    if (key === 'scanDirectories' && Array.isArray(value)) {
      formData.append(key, value.join(','))
      return
    }
    if (key !== 'pemFile') {
      formData.append(key, String(value))
    }
  })
  return formData
}

function withoutPemFile<T extends Partial<ConnectServerPayload>>(payload: T): Omit<T, 'pemFile'> {
  const { pemFile: _pemFile, ...rest } = payload
  return rest
}

export const serversApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listServers: builder.query<CrudListResponse<ServerConnection>, CrudListQuery>({
      query: (query) => ({
        url: 'serverAgent/servers/list',
        method: 'GET',
        params: { filter: JSON.stringify(query) },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeServerListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((s) => ({ type: 'Server' as const, id: s._id })),
              { type: 'Server' as const, id: 'LIST' },
            ]
          : [{ type: 'Server' as const, id: 'LIST' }],
    }),

    createServer: builder.mutation<ServerConnection, ConnectServerPayload>({
      query: (payload) =>
        hasPemFile(payload)
          ? { url: 'serverAgent/servers/connect/upload', method: 'POST', data: toServerFormData(payload) }
          : { url: 'serverAgent/servers/connect', method: 'POST', data: withoutPemFile(payload) },
      transformResponse: (response: unknown) => {
        const server = normalizeServer(readResponsePath<unknown>(response, 'data'))
        if (!server) throw new Error('Server response is invalid.')
        return server
      },
      invalidatesTags: [{ type: 'Server', id: 'LIST' }],
    }),

    updateServer: builder.mutation<ServerConnection, { id: EntityId; data: Partial<ConnectServerPayload> }>({
      query: ({ id, data }) =>
        hasPemFile(data)
          ? { url: `serverAgent/servers/${id}/upload`, method: 'PUT', data: toServerFormData(data) }
          : { url: `serverAgent/servers/${id}`, method: 'PUT', data: withoutPemFile(data) },
      transformResponse: (response: unknown) => {
        const server = normalizeServer(readResponsePath<unknown>(response, 'data'))
        if (!server) throw new Error('Server response is invalid.')
        return server
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Server', id },
        { type: 'Server', id: 'LIST' },
      ],
    }),

    deleteServer: builder.mutation<EntityId, EntityId>({
      query: (id) => ({ url: `serverAgent/servers/${id}`, method: 'DELETE' }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Server', id },
        { type: 'Server', id: 'LIST' },
      ],
    }),

    bulkDeleteServers: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({ url: 'serverAgent/servers/multiDelete', method: 'POST', data: payload }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'Server' as const, id })),
        { type: 'Server' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useListServersQuery,
  useCreateServerMutation,
  useUpdateServerMutation,
  useDeleteServerMutation,
  useBulkDeleteServersMutation,
} = serversApi
