import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { facilityApiDetails } from '@/models/facilityModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Facility, FacilityCreatePayload, FacilityUpdatePayload } from '@/types/facility'

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

function normalizeFacility(response: unknown): Facility | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    facilityId:
      typeof item.facilityId === 'string'
        ? item.facilityId
        : typeof item.facilityId === 'object' && item.facilityId !== null && '_id' in item.facilityId
          ? String((item.facilityId as { _id?: string })._id ?? '')
          : '',
    facilityName: normalizeString(item.facilityName),
    facilityCode: normalizeOptionalString(item.facilityCode),
    npi: normalizeOptionalString(item.npi),
    taxId: normalizeOptionalString(item.taxId),
    placeOfServiceCode: normalizeOptionalString(item.placeOfServiceCode),
    addressLine1: normalizeOptionalString(item.addressLine1),
    addressLine2: normalizeOptionalString(item.addressLine2),
    city: normalizeOptionalString(item.city),
    state: normalizeOptionalString(item.state),
    zipCode: normalizeOptionalString(item.zipCode),
    phone: normalizeOptionalString(item.phone),
    fax: normalizeOptionalString(item.fax),
    activeFlag: Boolean(item.activeFlag),
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

const facilityListDataPaths = [facilityApiDetails.responseDataPath, 'data.data', 'items']
const facilityListTotalPaths = [
  facilityApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeFacilityListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Facility> {
  return normalizeCrudListResponse<unknown, Facility>({
    response,
    query,
    dataPaths: facilityListDataPaths,
    totalPaths: facilityListTotalPaths,
    mapItem: normalizeFacility,
  })
}

export const facilitiesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFacilities: builder.query<CrudListResponse<Facility>, CrudListQuery>({
      query: (query) => ({
        url: facilityApiDetails.endpoint,
        method: 'GET',
        params: {
          [facilityApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeFacilityListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Facility' as const, id: item._id })),
              { type: 'Facility' as const, id: 'LIST' },
            ]
          : [{ type: 'Facility' as const, id: 'LIST' }],
    }),
    getFacility: builder.query<Facility, EntityId>({
      query: (id) => ({
        url: `${facilityApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeFacility(readResponsePath<unknown>(response, facilityApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Facility response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Facility', id }],
    }),
    createFacility: builder.mutation<Facility, FacilityCreatePayload>({
      query: (payload) => ({
        url: facilityApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeFacility(readResponsePath<unknown>(response, facilityApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Facility response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Facility', id: 'LIST' }],
    }),
    updateFacility: builder.mutation<Facility, { id: EntityId; data: FacilityUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${facilityApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeFacility(readResponsePath<unknown>(response, facilityApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Facility response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Facility', id },
        { type: 'Facility', id: 'LIST' },
      ],
    }),
    deleteFacility: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${facilityApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Facility', id },
        { type: 'Facility', id: 'LIST' },
      ],
    }),
    bulkDeleteFacilities: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${facilityApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Facility' as const, id })),
        { type: 'Facility' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteFacilitiesMutation,
  useCreateFacilityMutation,
  useDeleteFacilityMutation,
  useGetFacilityQuery,
  useGetFacilitiesQuery,
  useUpdateFacilityMutation,
} = facilitiesApi
