import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { MaintenanceLog, ServerLogsPayload } from '@/types/serverManagement'

const DATA_PATHS = ['data', 'data.data', 'items']
const TOTAL_PATHS = ['meta.total', 'meta.totalRecords', 'data.total', 'data.totalRecords', 'total', 'totalRecords']

function normalizeServer(response: unknown): MaintenanceLog | null {
    if (typeof response !== 'object' || response === null) return null
    const s = response as Record<string, unknown>
    if (typeof s._id !== 'string') return null
    return s as unknown as MaintenanceLog
}

function normalizeServerListResponse(response: unknown, query: CrudListQuery): CrudListResponse<MaintenanceLog> {
    return normalizeCrudListResponse<unknown, MaintenanceLog>({
        response,
        query,
        dataPaths: DATA_PATHS,
        totalPaths: TOTAL_PATHS,
        mapItem: normalizeServer,
    })
}

export const serverLogsApi = apiSlice.injectEndpoints({
    endpoints: (builder) => ({
        listServerLogs: builder.query<CrudListResponse<MaintenanceLog>, CrudListQuery>({
            async queryFn(query, _queryApi, _extraOptions, fetchWithBQ) {
                const criteria = query.criteria || [];
                const serverCriterion = criteria.find(c => c.key === 'serverSearch' || c.key === 'serverId' || c.key === 'server');
                const serverId = serverCriterion?.value as string | undefined;

                let name, host;

                if (serverId && typeof serverId === 'string' && serverId.length === 24) { // typical length of ObjectId
                    const serversRes = await fetchWithBQ({ url: 'serverAgent/servers/list' });
                    if (serversRes.data) {
                        const servers = (serversRes.data as any).data || serversRes.data;
                        if (Array.isArray(servers)) {
                            const server = servers.find((s: any) => s._id === serverId || s.id === serverId);
                            if (server) {
                                name = server.name;
                                host = server.host;
                            }
                        }
                    }
                }

                const filterQuery: any = { ...query };
                if (name) filterQuery.name = name;
                if (host) filterQuery.host = host;

                const result = await fetchWithBQ({
                    url: 'serverAgent/logs',
                    method: 'GET',
                    params: { filter: JSON.stringify(filterQuery) },
                });

                if (result.error) return { error: result.error as any };
                return { data: normalizeServerListResponse(result.data, query) };
            },
            providesTags: (result) =>
                result
                    ? [
                        ...result.data.map((s) => ({ type: 'Server' as const, id: s._id })),
                        { type: 'Server' as const, id: 'LIST' },
                    ]
                    : [{ type: 'Server' as const, id: 'LIST' }],
        }),

        createServerLogs: builder.mutation<MaintenanceLog, ServerLogsPayload>({
            query: (payload) => ({ url: 'serverAgent/servers', method: 'POST', data: payload }),
            transformResponse: (response: unknown) => {
                const server = normalizeServer(readResponsePath<unknown>(response, 'data'))
                if (!server) throw new Error('Server response is invalid.')
                return server
            },
            invalidatesTags: [{ type: 'Server', id: 'LIST' }],
        }),

        updateServerLogs: builder.mutation<MaintenanceLog, { id: EntityId; data: Partial<ServerLogsPayload> }>({
            query: ({ id, data }) => ({ url: `serverAgent/servers/${id}`, method: 'PUT', data }),
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

        deleteServerLogs: builder.mutation<EntityId, EntityId>({
            query: (id) => ({ url: `serverAgent/servers/${id}`, method: 'DELETE' }),
            transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
            invalidatesTags: (_result, _error, id) => [
                { type: 'Server', id },
                { type: 'Server', id: 'LIST' },
            ],
        }),

        bulkDeleteServerLogs: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
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
    useListServerLogsQuery,
    useCreateServerLogsMutation,
    useUpdateServerLogsMutation,
    useDeleteServerLogsMutation,
    useBulkDeleteServerLogsMutation,
} = serverLogsApi
