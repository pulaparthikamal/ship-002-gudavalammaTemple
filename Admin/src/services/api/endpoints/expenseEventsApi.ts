import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'

export interface ExpenseEvent {
  _id: string
  name: string
  startDate: string
  endDate?: string
  budget: number
  notes: string
  active: boolean
}

export interface ExpenseEventCreatePayload {
  name: string
  startDate: string
  endDate?: string
  budget: number
  notes?: string
  active?: boolean
}

export type ExpenseEventUpdatePayload = Partial<ExpenseEventCreatePayload>

export const expenseEventsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseEvents: builder.query<ExpenseEvent[], void>({
      query: () => ({
        url: '/expense-events',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ExpenseEvent[]>(response, 'data') ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((event) => ({ type: 'ExpenseEvent' as const, id: event._id })),
              { type: 'ExpenseEvent' as const, id: 'LIST' },
            ]
          : [{ type: 'ExpenseEvent' as const, id: 'LIST' }],
    }),
    createExpenseEvent: builder.mutation<ExpenseEvent, ExpenseEventCreatePayload>({
      query: (payload) => ({
        url: '/expense-events',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ExpenseEvent>(response, 'data'),
      invalidatesTags: [{ type: 'ExpenseEvent' as const, id: 'LIST' }],
    }),
    updateExpenseEvent: builder.mutation<ExpenseEvent, { id: EntityId; data: ExpenseEventUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `/expense-events/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ExpenseEvent>(response, 'data'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ExpenseEvent' as const, id },
        { type: 'ExpenseEvent' as const, id: 'LIST' },
      ],
    }),
    deleteExpenseEvent: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/expense-events/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'ExpenseEvent' as const, id },
        { type: 'ExpenseEvent' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetExpenseEventsQuery,
  useCreateExpenseEventMutation,
  useUpdateExpenseEventMutation,
  useDeleteExpenseEventMutation,
} = expenseEventsApi
