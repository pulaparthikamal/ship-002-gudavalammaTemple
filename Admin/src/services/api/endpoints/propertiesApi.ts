import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { propertyApiDetails } from '@/models/propertyModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Property, PropertyCreatePayload, PropertyUpdatePayload } from '@/types/property'

const propertyListDataPaths = [
  propertyApiDetails.responseDataPath,
  'data.data',
  'data.docs',
  'items',
]

const propertyListTotalPaths = [
  propertyApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizePropertyListResponse(response: unknown, query: CrudListQuery): CrudListResponse<Property> {
  return normalizeCrudListResponse<Property>({
    response,
    query,
    dataPaths: propertyListDataPaths,
    totalPaths: propertyListTotalPaths,
  })
}

export const propertiesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProperties: builder.query<CrudListResponse<Property>, CrudListQuery>({
      query: (query) => ({
        url: propertyApiDetails.endpoint,
        method: 'GET',
        params: {
          [propertyApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizePropertyListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((property) => ({ type: 'Property' as const, id: property._id })),
              { type: 'Property' as const, id: 'LIST' },
            ]
          : [{ type: 'Property' as const, id: 'LIST' }],
    }),
    getProperty: builder.query<Property, EntityId>({
      query: (id) => ({
        url: `${propertyApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Property>(response, propertyApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Property', id }],
    }),
    createProperty: builder.mutation<Property, PropertyCreatePayload>({
      query: (payload) => ({
        url: propertyApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Property>(response, propertyApiDetails.responseDataPath),
      invalidatesTags: [{ type: 'Property', id: 'LIST' }],
    }),
    updateProperty: builder.mutation<Property, { id: EntityId; data: PropertyUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${propertyApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Property>(response, propertyApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Property', id },
        { type: 'Property', id: 'LIST' },
      ],
    }),
    deleteProperty: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${propertyApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Property', id },
        { type: 'Property', id: 'LIST' },
      ],
    }),
    bulkDeleteProperties: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${propertyApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Property' as const, id })),
        { type: 'Property' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetPropertiesQuery,
  useGetPropertyQuery,
  useCreatePropertyMutation,
  useUpdatePropertyMutation,
  useDeletePropertyMutation,
  useBulkDeletePropertiesMutation,
} = propertiesApi
