import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export type ReconfigureCatalogKey =
  | 'seva'
  | 'darshan'
  | 'accommodation'
  | 'prasadam'
  | 'donationFund'
  | 'facility'
  | 'nearbyPlace'
  | 'templeEvent'

export interface ReconfigureCatalogInfo {
  key: ReconfigureCatalogKey
  label: string
  count: number
  supportsDefaults: boolean
}

export interface ResetCatalogPayload {
  catalog: ReconfigureCatalogKey
  mode: 'empty' | 'defaults'
}

export interface ResetCatalogResult {
  catalog: ReconfigureCatalogKey
  mode: 'empty' | 'defaults'
  removedCount: number
  currentCount: number
}

export const templeReconfigureApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReconfigureCatalogs: builder.query<ReconfigureCatalogInfo[], void>({
      query: () => ({ url: '/temple-reconfigure/catalogs', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<ReconfigureCatalogInfo[]>(response, 'catalogs') ?? [],
      providesTags: [{ type: 'ReconfigureCatalog' as const, id: 'LIST' }],
    }),
    resetCatalog: builder.mutation<ResetCatalogResult, ResetCatalogPayload>({
      query: (payload) => ({ url: '/temple-reconfigure/reset-catalog', method: 'POST', data: payload }),
      transformResponse: (response: unknown) => readResponsePath<ResetCatalogResult>(response, 'result'),
      invalidatesTags: [
        { type: 'ReconfigureCatalog' as const, id: 'LIST' },
        { type: 'Seva' as const, id: 'LIST' },
        { type: 'DarshanQuota' as const, id: 'LIST' },
        { type: 'AccommodationRoomType' as const, id: 'LIST' },
        { type: 'PrasadamItem' as const, id: 'LIST' },
        { type: 'DonationFund' as const, id: 'LIST' },
        { type: 'Facility' as const, id: 'LIST' },
        { type: 'NearbyPlace' as const, id: 'LIST' },
        { type: 'TempleEvent' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const { useGetReconfigureCatalogsQuery, useResetCatalogMutation } = templeReconfigureApi
