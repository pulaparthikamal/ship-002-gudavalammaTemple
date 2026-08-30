import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export interface PrasadamItem {
  _id: string
  slug: string
  name: string
  price: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active: boolean
}

export interface PrasadamItemPayload {
  slug: string
  name: string
  price: number
  bookingOpensAt?: string
  bookingClosesAt?: string
  active?: boolean
}

export interface PrasadamOrderLineItem {
  itemId: string
  name: string
  price: number
  qty: number
}

export interface PrasadamOrder {
  _id: string
  devotee: string
  items: PrasadamOrderLineItem[]
  amount: number
  status: string
  paymentStatus: string
}

export interface CreatePrasadamOrderPayload {
  items: Array<{ itemId: string; qty: number }>
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

const PRASADAM_ITEMS_ENDPOINT = '/prasadam-items'
const PRASADAM_ORDERS_ENDPOINT = '/prasadam-orders'
const RESPONSE_DATA_PATH = 'data'

export const prasadamApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getPrasadamItems: builder.query<PrasadamItem[], void>({
      query: () => ({
        url: PRASADAM_ITEMS_ENDPOINT,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<PrasadamItem[]>(response, RESPONSE_DATA_PATH) ?? [],
      providesTags: [{ type: 'PrasadamItem', id: 'LIST' }],
    }),
    createPrasadamOrder: builder.mutation<PrasadamOrder, CreatePrasadamOrderPayload>({
      query: (payload) => ({
        url: PRASADAM_ORDERS_ENDPOINT,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<PrasadamOrder>(response, RESPONSE_DATA_PATH),
      invalidatesTags: [{ type: 'Booking', id: 'LIST' }],
    }),
    createPrasadamItem: builder.mutation<PrasadamItem, PrasadamItemPayload>({
      query: (payload) => ({
        url: PRASADAM_ITEMS_ENDPOINT,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => readResponsePath<PrasadamItem>(response, RESPONSE_DATA_PATH),
      invalidatesTags: [{ type: 'PrasadamItem', id: 'LIST' }],
    }),
    updatePrasadamItem: builder.mutation<PrasadamItem, { id: EntityId; data: Partial<PrasadamItemPayload> }>({
      query: ({ id, data }) => ({
        url: `${PRASADAM_ITEMS_ENDPOINT}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => readResponsePath<PrasadamItem>(response, RESPONSE_DATA_PATH),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'PrasadamItem', id },
        { type: 'PrasadamItem', id: 'LIST' },
      ],
    }),
    deletePrasadamItem: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${PRASADAM_ITEMS_ENDPOINT}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'PrasadamItem', id },
        { type: 'PrasadamItem', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetPrasadamItemsQuery,
  useCreatePrasadamOrderMutation,
  useCreatePrasadamItemMutation,
  useUpdatePrasadamItemMutation,
  useDeletePrasadamItemMutation,
} = prasadamApi
