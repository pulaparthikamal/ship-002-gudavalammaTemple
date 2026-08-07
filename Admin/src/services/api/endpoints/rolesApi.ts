import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { normalizeRolePermissions, roleApiDetails } from '@/models/roleModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Role, RoleCreatePayload, RoleUpdatePayload } from '@/types/role'

function normalizeRole(response: unknown): Role | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const role = response as Record<string, unknown>

  if (typeof role._id !== 'string' || typeof role.role !== 'string') {
    return null
  }

  return {
    _id: role._id,
    role: role.role,
    roleType:
      typeof role.roleType === 'string' && role.roleType.trim()
        ? (role.roleType.trim() as Role['roleType'])
        : 'User',
    status:
      typeof role.status === 'string' && role.status.trim()
        ? (role.status.trim() as Role['status'])
        : 'Active',
    active: typeof role.active === 'boolean' ? role.active : undefined,
    permissions: normalizeRolePermissions(role.permissions),
    createdAt: typeof role.createdAt === 'string' ? role.createdAt : new Date().toISOString(),
    updatedAt: typeof role.updatedAt === 'string' ? role.updatedAt : new Date().toISOString(),
    __v: typeof role.__v === 'number' ? role.__v : undefined,
  }
}

const roleListDataPaths = [
  roleApiDetails.responseDataPath,
  'data.data',
  'items',
]

const roleListTotalPaths = [
  roleApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeRoleListResponse(response: unknown, query: CrudListQuery): CrudListResponse<Role> {
  return normalizeCrudListResponse<unknown, Role>({
    response,
    query,
    dataPaths: roleListDataPaths,
    totalPaths: roleListTotalPaths,
    mapItem: normalizeRole,
  })
}

export const rolesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRoles: builder.query<CrudListResponse<Role>, CrudListQuery>({
      query: (query) => ({
        url: roleApiDetails.endpoint,
        method: 'GET',
        params: {
          [roleApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeRoleListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((role) => ({ type: 'Role' as const, id: role._id })),
              { type: 'Role' as const, id: 'LIST' },
            ]
          : [{ type: 'Role' as const, id: 'LIST' }],
    }),
    getRole: builder.query<Role, EntityId>({
      query: (id) => ({
        url: `${roleApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const role = normalizeRole(readResponsePath<unknown>(response, roleApiDetails.responseDataPath))

        if (!role) {
          throw new Error('Role response is invalid.')
        }

        return role
      },
      providesTags: (_result, _error, id) => [{ type: 'Role', id }],
    }),
    createRole: builder.mutation<Role, RoleCreatePayload>({
      query: (payload) => ({
        url: roleApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const role = normalizeRole(readResponsePath<unknown>(response, roleApiDetails.responseDataPath))

        if (!role) {
          throw new Error('Role response is invalid.')
        }

        return role
      },
      invalidatesTags: [{ type: 'Role', id: 'LIST' }],
    }),
    updateRole: builder.mutation<Role, { id: EntityId; data: RoleUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${roleApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const role = normalizeRole(readResponsePath<unknown>(response, roleApiDetails.responseDataPath))

        if (!role) {
          throw new Error('Role response is invalid.')
        }

        return role
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Role', id },
        { type: 'Role', id: 'LIST' },
      ],
    }),
    deleteRole: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${roleApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Role', id },
        { type: 'Role', id: 'LIST' },
      ],
    }),
    bulkDeleteRoles: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({
        url: `${roleApiDetails.endpoint}/multiDelete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'Role' as const, id })),
        { type: 'Role' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteRolesMutation,
  useCreateRoleMutation,
  useDeleteRoleMutation,
  useGetRoleQuery,
  useGetRolesQuery,
  useUpdateRoleMutation,
} = rolesApi
