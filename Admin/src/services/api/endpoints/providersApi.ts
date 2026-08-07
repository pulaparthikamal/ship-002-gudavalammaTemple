import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { providerApiDetails } from '@/models/providerModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Provider, ProviderCreatePayload, ProviderUpdatePayload } from '@/types/provider'

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function normalizeNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
}

function normalizeProvider(response: unknown): Provider | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    providerId:
      typeof item.providerId === 'string'
        ? item.providerId
        : typeof item.providerId === 'object' && item.providerId !== null && '_id' in item.providerId
          ? String((item.providerId as { _id?: string })._id ?? '')
          : '',
    firstName: normalizeString(item.firstName),
    lastName: normalizeOptionalString(item.lastName),
    credentials: normalizeOptionalString(item.credentials),
    specialty: normalizeOptionalString(item.specialty),
    npi: normalizeOptionalString(item.npi),
    taxonomyCode: normalizeOptionalString(item.taxonomyCode),
    licenseNumber: normalizeOptionalString(item.licenseNumber),
    deaNumber: normalizeOptionalString(item.deaNumber),
    providerType: normalizeOptionalString(item.providerType),
    phone: normalizeOptionalString(item.phone),
    fax: normalizeOptionalString(item.fax),
    email: normalizeOptionalString(item.email),
    activeFlag: Boolean(item.activeFlag),
    billingProviderFlag: Boolean(item.billingProviderFlag),
    renderingProviderFlag: Boolean(item.renderingProviderFlag),
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt:
      normalizeDateString(item.createdAt) ??
      normalizeDateString(item.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(item.updatedAt) ??
      normalizeDateString(item.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const providerListDataPaths = [providerApiDetails.responseDataPath, 'data.data', 'items']
const providerListTotalPaths = [
  providerApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeProviderListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Provider> {
  return normalizeCrudListResponse<unknown, Provider>({
    response,
    query,
    dataPaths: providerListDataPaths,
    totalPaths: providerListTotalPaths,
    mapItem: normalizeProvider,
  })
}

export const providersApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProviders: builder.query<CrudListResponse<Provider>, CrudListQuery>({
      query: (query) => ({
        url: providerApiDetails.endpoint,
        method: 'GET',
        params: {
          [providerApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeProviderListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Provider' as const, id: item._id })),
              { type: 'Provider' as const, id: 'LIST' },
            ]
          : [{ type: 'Provider' as const, id: 'LIST' }],
    }),
    getProvider: builder.query<Provider, EntityId>({
      query: (id) => ({
        url: `${providerApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeProvider(readResponsePath<unknown>(response, providerApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Provider response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Provider', id }],
    }),
    createProvider: builder.mutation<Provider, ProviderCreatePayload>({
      query: (payload) => ({
        url: providerApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeProvider(readResponsePath<unknown>(response, providerApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Provider response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Provider', id: 'LIST' }],
    }),
    updateProvider: builder.mutation<Provider, { id: EntityId; data: ProviderUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${providerApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeProvider(readResponsePath<unknown>(response, providerApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Provider response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Provider', id },
        { type: 'Provider', id: 'LIST' },
      ],
    }),
    deleteProvider: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${providerApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Provider', id },
        { type: 'Provider', id: 'LIST' },
      ],
    }),
    bulkDeleteProviders: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${providerApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Provider' as const, id })),
        { type: 'Provider' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteProvidersMutation,
  useCreateProviderMutation,
  useDeleteProviderMutation,
  useGetProviderQuery,
  useGetProvidersQuery,
  useUpdateProviderMutation,
} = providersApi
