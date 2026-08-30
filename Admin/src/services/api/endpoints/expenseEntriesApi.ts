import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'

export type ExpenseEntryType = 'income' | 'expense'
export type ExpensePaymentMode = 'cash' | 'upi' | 'bank_transfer' | 'cheque' | 'other'

export interface ExpenseEntry {
  _id: string
  date: string
  eventId?: string | null
  category: string
  description: string
  amount: number
  type: ExpenseEntryType
  paymentMode: ExpensePaymentMode
  attachmentRef?: string
  createdBy?: string
}

export interface ExpenseEntryCreatePayload {
  date: string
  eventId?: string | null
  category: string
  description?: string
  amount: number
  type: ExpenseEntryType
  paymentMode: ExpensePaymentMode
  attachmentRef?: string
}

export type ExpenseEntryUpdatePayload = Partial<ExpenseEntryCreatePayload>

export interface ExpenseEntryListQuery extends Partial<CrudListQuery> {
  page: number
  limit: number
  eventId?: string | null
  from?: string
  to?: string
  category?: string
}

export interface ExpenseSummaryQuery {
  eventId?: string | null
  from?: string
  to?: string
}

export interface ExpenseSummary {
  totalIncome: number
  totalExpense: number
  net: number
}

export interface BulkCreateExpenseEntriesPayload {
  entries: Array<Partial<ExpenseEntryCreatePayload>>
}

export interface BulkCreateExpenseEntriesResult {
  created: ExpenseEntry[]
  errors: Array<{ index: number; row: unknown; message: string }>
}

const expenseEntryListDataPaths = ['data', 'data.data', 'data.docs', 'items']
const expenseEntryListTotalPaths = ['meta.total', 'meta.totalRecords', 'data.total', 'data.totalRecords', 'total', 'totalRecords']

function normalizeExpenseEntryListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<ExpenseEntry> {
  return normalizeCrudListResponse<ExpenseEntry>({
    response,
    query,
    dataPaths: expenseEntryListDataPaths,
    totalPaths: expenseEntryListTotalPaths,
  })
}

export const expenseEntriesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseEntries: builder.query<CrudListResponse<ExpenseEntry>, ExpenseEntryListQuery>({
      query: (query) => ({
        url: '/expense-entries',
        method: 'GET',
        params: {
          page: query.page,
          limit: query.limit,
          sortfield: query.sortfield,
          direction: query.direction,
          eventId: query.eventId ?? undefined,
          from: query.from,
          to: query.to,
          category: query.category,
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: ExpenseEntryListQuery) =>
        normalizeExpenseEntryListResponse(response, {
          page: query.page,
          limit: query.limit,
          criteria: query.criteria ?? [],
          sortfield: query.sortfield,
          direction: query.direction,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((entry) => ({ type: 'ExpenseEntry' as const, id: entry._id })),
              { type: 'ExpenseEntry' as const, id: 'LIST' },
            ]
          : [{ type: 'ExpenseEntry' as const, id: 'LIST' }],
    }),
    createExpenseEntry: builder.mutation<ExpenseEntry, ExpenseEntryCreatePayload>({
      query: (payload) => ({
        url: '/expense-entries',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ExpenseEntry>(response, 'data'),
      invalidatesTags: [{ type: 'ExpenseEntry' as const, id: 'LIST' }],
    }),
    updateExpenseEntry: builder.mutation<ExpenseEntry, { id: EntityId; data: ExpenseEntryUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `/expense-entries/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ExpenseEntry>(response, 'data'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ExpenseEntry' as const, id },
        { type: 'ExpenseEntry' as const, id: 'LIST' },
      ],
    }),
    deleteExpenseEntry: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/expense-entries/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'ExpenseEntry' as const, id },
        { type: 'ExpenseEntry' as const, id: 'LIST' },
      ],
    }),
    bulkCreateExpenseEntries: builder.mutation<BulkCreateExpenseEntriesResult, BulkCreateExpenseEntriesPayload>({
      query: (payload) => ({
        url: '/expense-entries/bulk',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<BulkCreateExpenseEntriesResult>(response, 'data'),
      invalidatesTags: [{ type: 'ExpenseEntry' as const, id: 'LIST' }],
    }),
    getExpenseSummary: builder.query<ExpenseSummary, ExpenseSummaryQuery>({
      query: (params) => ({
        url: '/expense-entries/summary',
        method: 'GET',
        params: {
          eventId: params.eventId ?? undefined,
          from: params.from,
          to: params.to,
        },
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ExpenseSummary>(response, 'data'),
      providesTags: [{ type: 'ExpenseEntry' as const, id: 'SUMMARY' }],
    }),
  }),
})

export const {
  useGetExpenseEntriesQuery,
  useCreateExpenseEntryMutation,
  useUpdateExpenseEntryMutation,
  useDeleteExpenseEntryMutation,
  useBulkCreateExpenseEntriesMutation,
  useGetExpenseSummaryQuery,
} = expenseEntriesApi
