import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { assetApiDetails } from '@/models/assetModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Asset, AssetCreatePayload, AssetUpdatePayload } from '@/types/asset'

const assetListDataPaths = [
  assetApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const assetListTotalPaths = [
  assetApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeAssetListResponse(response: unknown, query: CrudListQuery): CrudListResponse<Asset> {
  return normalizeCrudListResponse<Asset>({
    response,
    query,
    dataPaths: assetListDataPaths,
    totalPaths: assetListTotalPaths,
  })
}

export const assetsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAssets: builder.query<CrudListResponse<Asset>, CrudListQuery>({
      query: (query) => ({
        url: assetApiDetails.endpoint,
        method: 'GET',
        params: {
          [assetApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeAssetListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((asset) => ({ type: 'Asset' as const, id: asset._id })),
              { type: 'Asset' as const, id: 'LIST' },
            ]
          : [{ type: 'Asset' as const, id: 'LIST' }],
    }),
    getAsset: builder.query<Asset, EntityId>({
      query: (id) => ({
        url: `${assetApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Asset>(response, assetApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Asset', id }],
    }),
    createAsset: builder.mutation<Asset, AssetCreatePayload>({
      query: (payload) => ({
        url: assetApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Asset>(response, assetApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'Asset', id: 'LIST' }],
    }),
    updateAsset: builder.mutation<Asset, { id: EntityId; data: AssetUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${assetApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Asset>(response, assetApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Asset', id },
        { type: 'Asset', id: 'LIST' },
      ],
    }),
    deleteAsset: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${assetApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Asset', id },
        { type: 'Asset', id: 'LIST' },
      ],
    }),
    bulkDeleteAssets: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${assetApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Asset' as const, id })),
        { type: 'Asset' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetAssetsQuery,
  useGetAssetQuery,
  useCreateAssetMutation,
  useUpdateAssetMutation,
  useDeleteAssetMutation,
  useBulkDeleteAssetsMutation,
} = assetsApi
