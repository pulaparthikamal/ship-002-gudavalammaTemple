import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { mediaCategoryApiDetails } from '@/models/mediaCategoryModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { 
  MediaCategory, 
  MediaCategoryCreatePayload, 
  MediaCategoryUpdatePayload 
} from '@/types/mediaCategory'

const categoryListDataPaths = [
  mediaCategoryApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const categoryListTotalPaths = [
  mediaCategoryApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeCategoryListResponse(response: unknown, query: CrudListQuery): CrudListResponse<MediaCategory> {
  return normalizeCrudListResponse<MediaCategory>({
    response,
    query,
    dataPaths: categoryListDataPaths,
    totalPaths: categoryListTotalPaths,
  })
}

export const mediaCategoriesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getMediaCategories: builder.query<CrudListResponse<MediaCategory>, CrudListQuery>({
      query: (query) => ({
        url: mediaCategoryApiDetails.endpoint,
        method: 'GET',
        params: {
          [mediaCategoryApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCategoryListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((category) => ({ type: 'MediaCategory' as const, id: category._id })),
              { type: 'MediaCategory' as const, id: 'LIST' },
            ]
          : [{ type: 'MediaCategory' as const, id: 'LIST' }],
    }),
    getMediaCategory: builder.query<MediaCategory, EntityId>({
      query: (id) => ({
        url: `${mediaCategoryApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<MediaCategory>(response, mediaCategoryApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'MediaCategory', id }],
    }),
    createMediaCategory: builder.mutation<MediaCategory, MediaCategoryCreatePayload>({
      query: (payload) => ({
        url: mediaCategoryApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<MediaCategory>(response, mediaCategoryApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'MediaCategory', id: 'LIST' }],
    }),
    updateMediaCategory: builder.mutation<MediaCategory, { id: EntityId; data: MediaCategoryUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${mediaCategoryApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<MediaCategory>(response, mediaCategoryApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'MediaCategory', id },
        { type: 'MediaCategory', id: 'LIST' },
      ],
    }),
    deleteMediaCategory: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${mediaCategoryApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'MediaCategory', id },
        { type: 'MediaCategory', id: 'LIST' },
      ],
    }),
    bulkDeleteMediaCategories: builder.mutation<EntityId[], { selectedIds: EntityId[] }>({
      query: (payload) => ({
        url: `${mediaCategoryApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.selectedIds,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.selectedIds.map((id) => ({ type: 'MediaCategory' as const, id })),
        { type: 'MediaCategory' as const, id: 'LIST' },
      ],
    }),
    generateMediaCategoryContent: builder.mutation<MediaCategory, EntityId>({
      query: (id) => ({
        url: `${mediaCategoryApiDetails.endpoint}/${id}/generate`,
        method: 'POST',
        timeout: 180_000, // 3 minutes for AI generation
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<MediaCategory>(response, mediaCategoryApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, id) => [
        { type: 'MediaCategory', id },
        { type: 'MediaCategory', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteMediaCategoriesMutation,
  useCreateMediaCategoryMutation,
  useDeleteMediaCategoryMutation,
  useGetMediaCategoryQuery,
  useGetMediaCategoriesQuery,
  useUpdateMediaCategoryMutation,
  useGenerateMediaCategoryContentMutation,
} = mediaCategoriesApi
