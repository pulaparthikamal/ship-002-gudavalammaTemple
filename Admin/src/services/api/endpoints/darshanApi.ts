import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export interface DarshanQuota {
  _id: string
  slug: 'sarva' | 'special' | 'senior' | string
  name: string
  price: number
  dailyCapacity: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active: boolean
}

export interface DarshanQuotaPayload {
  slug: string
  name: string
  price: number
  dailyCapacity?: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active?: boolean
}

export interface DarshanBooking {
  _id: string
  devotee: string
  quota: string
  date: string
  devoteeCount: number
  amount: number
  status: string
}

export interface CreateDarshanBookingPayload {
  quotaId: string
  date: string
  devoteeCount: number
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

export const darshanApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDarshanQuotas: builder.query<DarshanQuota[], void>({
      query: () => ({
        url: '/darshan-quotas',
        method: 'GET',
      }),
      transformResponse: (response: unknown) => readResponsePath<DarshanQuota[]>(response, 'data') ?? [],
      providesTags: [{ type: 'DarshanQuota' as const, id: 'LIST' }],
    }),
    createDarshanBooking: builder.mutation<DarshanBooking, CreateDarshanBookingPayload>({
      query: (payload) => ({
        url: '/darshan-bookings',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<DarshanBooking>(response, 'data'),
      invalidatesTags: [{ type: 'Booking' as const, id: 'LIST' }],
    }),
    createDarshanQuota: builder.mutation<DarshanQuota, DarshanQuotaPayload>({
      query: (payload) => ({
        url: '/darshan-quotas',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<DarshanQuota>(response, 'data'),
      invalidatesTags: [{ type: 'DarshanQuota' as const, id: 'LIST' }],
    }),
    updateDarshanQuota: builder.mutation<DarshanQuota, { id: EntityId; data: Partial<DarshanQuotaPayload> }>({
      query: ({ id, data }) => ({
        url: `/darshan-quotas/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => readResponsePath<DarshanQuota>(response, 'data'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'DarshanQuota' as const, id },
        { type: 'DarshanQuota' as const, id: 'LIST' },
      ],
    }),
    deleteDarshanQuota: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/darshan-quotas/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'DarshanQuota' as const, id },
        { type: 'DarshanQuota' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetDarshanQuotasQuery,
  useCreateDarshanBookingMutation,
  useCreateDarshanQuotaMutation,
  useUpdateDarshanQuotaMutation,
  useDeleteDarshanQuotaMutation,
} = darshanApi
