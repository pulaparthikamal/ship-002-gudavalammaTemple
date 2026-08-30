import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export type NavTabKey =
  | 'home'
  | 'darshan'
  | 'seva'
  | 'accommodation'
  | 'prasadam'
  | 'donations'
  | 'events'
  | 'live'
  | 'bookings'
  | 'facilities'
  | 'nearbyPlaces'

export type NavTabRole = 'GUEST' | 'USER'

export interface NavTab {
  _id: string
  key: NavTabKey
  route: string
  allowedRoles: NavTabRole[]
  isDefault: boolean
  guestLocked: boolean
}

export const navTabsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    // `cacheKey` isn't sent to the server — it only exists so RTK Query
    // caches the anonymous-guest response separately from the logged-in-
    // devotee response across a login/logout transition. The server always
    // derives the real effective role from the auth header itself.
    getEnabledNavTabs: builder.query<NavTab[], 'guest' | 'user'>({
      query: () => ({ url: '/nav-tabs/enabled', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<NavTab[]>(response, 'navTabs') ?? [],
      providesTags: [{ type: 'NavTab' as const, id: 'ENABLED' }],
    }),
    getAllNavTabs: builder.query<NavTab[], void>({
      query: () => ({ url: '/nav-tabs', method: 'GET' }),
      transformResponse: (response: unknown) => readResponsePath<NavTab[]>(response, 'navTabs') ?? [],
      providesTags: [{ type: 'NavTab' as const, id: 'LIST' }],
    }),
    setNavTabAllowedRoles: builder.mutation<NavTab, { key: NavTabKey; allowedRoles: NavTabRole[] }>({
      query: ({ key, allowedRoles }) => ({
        url: `/nav-tabs/${key}`,
        method: 'PUT',
        data: { allowedRoles },
      }),
      transformResponse: (response: unknown) => readResponsePath<NavTab>(response, 'navTab'),
      invalidatesTags: [
        { type: 'NavTab' as const, id: 'LIST' },
        { type: 'NavTab' as const, id: 'ENABLED' },
      ],
    }),
  }),
})

export const { useGetEnabledNavTabsQuery, useGetAllNavTabsQuery, useSetNavTabAllowedRolesMutation } = navTabsApi
