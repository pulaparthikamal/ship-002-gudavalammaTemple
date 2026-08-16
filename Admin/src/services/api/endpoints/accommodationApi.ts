import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export interface AccommodationRoomType {
  _id: string
  slug: string
  name: string
  detail: string
  pricePerNight: number
  totalRooms: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active: boolean
}

export interface AccommodationRoomTypePayload {
  slug: string
  name: string
  detail?: string
  pricePerNight: number
  totalRooms?: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active?: boolean
}

export interface AccommodationBooking {
  _id: string
  devotee: string
  roomTypeId: string
  checkIn: string
  checkOut: string
  guests: number
  amount: number
  status: string
  paymentStatus: string
}

export interface CreateAccommodationBookingPayload {
  roomTypeId: string
  checkIn: string
  checkOut: string
  guests: number
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

const ACCOMMODATION_ROOM_TYPES_ENDPOINT = '/accommodation-room-types'
const ACCOMMODATION_BOOKINGS_ENDPOINT = '/accommodation-bookings'
const RESPONSE_DATA_PATH = 'data'

export const accommodationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getAccommodationRoomTypes: builder.query<AccommodationRoomType[], void>({
      query: () => ({
        url: ACCOMMODATION_ROOM_TYPES_ENDPOINT,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<AccommodationRoomType[]>(response, RESPONSE_DATA_PATH) ?? [],
      providesTags: [{ type: 'AccommodationRoomType', id: 'LIST' }],
    }),
    createAccommodationBooking: builder.mutation<AccommodationBooking, CreateAccommodationBookingPayload>({
      query: (payload) => ({
        url: ACCOMMODATION_BOOKINGS_ENDPOINT,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<AccommodationBooking>(response, RESPONSE_DATA_PATH),
      invalidatesTags: [{ type: 'Booking', id: 'LIST' }],
    }),
    createAccommodationRoomType: builder.mutation<AccommodationRoomType, AccommodationRoomTypePayload>({
      query: (payload) => ({
        url: ACCOMMODATION_ROOM_TYPES_ENDPOINT,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<AccommodationRoomType>(response, RESPONSE_DATA_PATH),
      invalidatesTags: [{ type: 'AccommodationRoomType', id: 'LIST' }],
    }),
    updateAccommodationRoomType: builder.mutation<
      AccommodationRoomType,
      { id: EntityId; data: Partial<AccommodationRoomTypePayload> }
    >({
      query: ({ id, data }) => ({
        url: `${ACCOMMODATION_ROOM_TYPES_ENDPOINT}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<AccommodationRoomType>(response, RESPONSE_DATA_PATH),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'AccommodationRoomType', id },
        { type: 'AccommodationRoomType', id: 'LIST' },
      ],
    }),
    deleteAccommodationRoomType: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${ACCOMMODATION_ROOM_TYPES_ENDPOINT}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'AccommodationRoomType', id },
        { type: 'AccommodationRoomType', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetAccommodationRoomTypesQuery,
  useCreateAccommodationBookingMutation,
  useCreateAccommodationRoomTypeMutation,
  useUpdateAccommodationRoomTypeMutation,
  useDeleteAccommodationRoomTypeMutation,
} = accommodationApi
