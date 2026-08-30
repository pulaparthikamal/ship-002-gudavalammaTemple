import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'

export type BookingType = 'darshan' | 'seva' | 'accommodation' | 'prasadam' | 'donation'
export type BookingStatus = 'confirmed' | 'pending' | 'completed' | 'cancelled'
export type BookingPaymentStatus = 'pending' | 'paid' | 'waived'
export type BookingFilter = 'all' | 'upcoming' | 'past'

export interface Booking {
  _id: string
  devotee: string
  type: BookingType
  refId: string
  refModel: string
  title: string
  amount: number
  date: string
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  paymentReference?: string
}

export interface BookingReceipt {
  bookingId: string
  type: BookingType
  title: string
  amount: number
  date: string
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  issuedAt: string
}

export interface BookingLedgerEntry {
  _id: string
  devotee?: { _id: string; firstName: string; lastName: string; email: string; phone?: string } | null
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  type: BookingType
  refId: string
  refModel: string
  title: string
  amount: number
  date: string
  status: BookingStatus
  paymentStatus: BookingPaymentStatus
  paymentReference?: string
}

export interface BookingLedgerListQuery extends Partial<CrudListQuery> {
  page: number
  limit: number
  type?: string
  status?: string
  paymentStatus?: string
  from?: string
  to?: string
}

const bookingLedgerListDataPaths = ['data', 'data.data', 'data.docs', 'items']
const bookingLedgerListTotalPaths = ['meta.total', 'meta.totalRecords', 'data.total', 'data.totalRecords', 'total', 'totalRecords']

function normalizeBookingLedgerListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<BookingLedgerEntry> {
  return normalizeCrudListResponse<BookingLedgerEntry>({
    response,
    query,
    dataPaths: bookingLedgerListDataPaths,
    totalPaths: bookingLedgerListTotalPaths,
  })
}

export const bookingApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getBookingLedger: builder.query<CrudListResponse<BookingLedgerEntry>, BookingLedgerListQuery>({
      query: (query) => ({
        url: '/bookings/all',
        method: 'GET',
        params: {
          page: query.page,
          limit: query.limit,
          sortfield: query.sortfield,
          direction: query.direction,
          type: query.type || undefined,
          status: query.status || undefined,
          paymentStatus: query.paymentStatus || undefined,
          from: query.from,
          to: query.to,
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: BookingLedgerListQuery) =>
        normalizeBookingLedgerListResponse(response, {
          page: query.page,
          limit: query.limit,
          criteria: query.criteria ?? [],
          sortfield: query.sortfield,
          direction: query.direction,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((entry) => ({ type: 'Booking' as const, id: entry._id })),
              { type: 'Booking' as const, id: 'LIST' },
            ]
          : [{ type: 'Booking' as const, id: 'LIST' }],
    }),
    getBookings: builder.query<Booking[], { filter?: BookingFilter } | void>({
      query: (args) => ({
        url: '/bookings',
        method: 'GET',
        params: { filter: args?.filter ?? 'all' },
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Booking[]>(response, 'bookings') ?? [],
    }),
    cancelBooking: builder.mutation<Booking, string>({
      query: (id) => ({
        url: `/bookings/${id}/cancel`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Booking>(response, 'booking'),
    }),
    getBookingReceipt: builder.query<BookingReceipt, string>({
      query: (id) => ({
        url: `/bookings/${id}/receipt`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<BookingReceipt>(response, 'receipt'),
    }),
    // Public — no auth, works for guest checkout too. Looked up by refId (the
    // domain booking/order/donation's own _id, already known right after
    // creation), not the ledger row's own id — see server's booking.route.ts.
    submitBookingPaymentReference: builder.mutation<Booking, { refId: string; paymentReference: string }>({
      query: ({ refId, paymentReference }) => ({
        url: `/bookings/by-ref/${refId}/payment-reference`,
        method: 'PATCH',
        data: { paymentReference },
      }),
      transformResponse: (response: unknown) => readResponsePath<Booking>(response, 'booking'),
    }),
    markBookingPaid: builder.mutation<BookingLedgerEntry, { id: string; paymentReference?: string }>({
      query: ({ id, paymentReference }) => ({
        url: `/bookings/${id}/mark-paid`,
        method: 'PATCH',
        data: { paymentReference },
      }),
      transformResponse: (response: unknown) => readResponsePath<BookingLedgerEntry>(response, 'booking'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Booking' as const, id },
        { type: 'Booking' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetBookingsQuery,
  useCancelBookingMutation,
  useLazyGetBookingReceiptQuery,
  useGetBookingLedgerQuery,
  useSubmitBookingPaymentReferenceMutation,
  useMarkBookingPaidMutation,
} = bookingApi
