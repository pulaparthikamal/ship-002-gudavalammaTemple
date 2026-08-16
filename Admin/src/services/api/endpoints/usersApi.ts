import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { userApiDetails } from '@/models/userModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { User, UserCreatePayload, UserUpdatePayload } from '@/types/user'

const userListDataPaths = [
  userApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const userListTotalPaths = [
  userApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeUserListResponse(response: unknown, query: CrudListQuery): CrudListResponse<User> {
  return normalizeCrudListResponse<User>({
    response,
    query,
    dataPaths: userListDataPaths,
    totalPaths: userListTotalPaths,
  })
}

export const usersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getUsers: builder.query<CrudListResponse<User>, CrudListQuery>({
      query: (query) => ({
        url: userApiDetails.endpoint,
        method: 'GET',
        params: {
          [userApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeUserListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((user) => ({ type: 'User' as const, id: user._id })),
              { type: 'User' as const, id: 'LIST' },
            ]
          : [{ type: 'User' as const, id: 'LIST' }],
    }),
    getUser: builder.query<User, EntityId>({
      query: (id) => ({
        url: `${userApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<User>(response, userApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'User', id }],
    }),
    createUser: builder.mutation<User, UserCreatePayload>({
      query: (payload) => ({
        url: userApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<User>(response, userApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'User', id: 'LIST' }],
    }),
    updateUser: builder.mutation<User, { id: EntityId; data: UserUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${userApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<User>(response, userApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
    deleteUser: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${userApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'User', id },
        { type: 'User', id: 'LIST' },
      ],
    }),
    updateOwnProfile: builder.mutation<User, { firstName?: string; lastName?: string; email?: string; phone?: string }>({
      query: (data) => ({
        url: '/users/me',
        method: 'PATCH',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<User>(response, userApiDetails.responseDataPath),
    }),
    bulkDeleteUsers: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({
        url: `${userApiDetails.endpoint}/multiDelete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'User' as const, id })),
        { type: 'User' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteUsersMutation,
  useCreateUserMutation,
  useDeleteUserMutation,
  useGetUserQuery,
  useGetUsersQuery,
  useUpdateUserMutation,
  useUpdateOwnProfileMutation,
} = usersApi
