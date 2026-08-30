import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export type SevaCategory = 'pratyaksha' | 'paroksha' | 'saswata'

export interface Seva {
  _id: string
  slug: string
  name: string
  category: SevaCategory
  timing: string
  price: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active: boolean
}

export interface SevaCatalogPayload {
  slug: string
  name: string
  category: SevaCategory
  timing: string
  price: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active?: boolean
}

export interface SevaBooking {
  _id: string
  devotee: string
  seva: string
  date: string
  amount: number
  status: string
}

export interface CreateSevaBookingPayload {
  sevaId: string
  date?: string
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

export const sevaApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getSevas: builder.query<Seva[], void>({
      query: () => ({
        url: '/sevas',
        method: 'GET',
      }),
      transformResponse: (response: unknown) => readResponsePath<Seva[]>(response, 'data') ?? [],
      providesTags: [{ type: 'Seva' as const, id: 'LIST' }],
    }),
    createSevaBooking: builder.mutation<SevaBooking, CreateSevaBookingPayload>({
      query: (payload) => ({
        url: '/seva-bookings',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<SevaBooking>(response, 'data'),
      invalidatesTags: [{ type: 'Booking' as const, id: 'LIST' }],
    }),
    createSeva: builder.mutation<Seva, SevaCatalogPayload>({
      query: (payload) => ({
        url: '/sevas',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<Seva>(response, 'data'),
      invalidatesTags: [{ type: 'Seva' as const, id: 'LIST' }],
    }),
    updateSeva: builder.mutation<Seva, { id: EntityId; data: Partial<SevaCatalogPayload> }>({
      query: ({ id, data }) => ({
        url: `/sevas/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => readResponsePath<Seva>(response, 'data'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Seva' as const, id },
        { type: 'Seva' as const, id: 'LIST' },
      ],
    }),
    deleteSeva: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/sevas/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Seva' as const, id },
        { type: 'Seva' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetSevasQuery,
  useCreateSevaBookingMutation,
  useCreateSevaMutation,
  useUpdateSevaMutation,
  useDeleteSevaMutation,
} = sevaApi
