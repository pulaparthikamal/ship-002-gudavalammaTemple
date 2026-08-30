import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'

export interface DonationFund {
  _id: string
  slug: string
  name: string
  description: string
  active: boolean
}

export interface DonationFundPayload {
  slug: string
  name: string
  description: string
  active?: boolean
}

export interface Donation {
  _id: string
  devotee: string
  fundId: string
  amount: number
  paymentStatus: 'pending' | 'paid' | 'waived'
  paymentReference?: string
  status: 'confirmed' | 'cancelled'
  receiptNo: string
  created: string
}

export interface CreateDonationPayload {
  fundId: string
  amount: number
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  preferredLocale?: string
}

export interface DonationLedgerEntry {
  _id: string
  devotee?: { _id: string; firstName: string; lastName: string; email: string; phone?: string } | null
  donorId?: { _id: string; name: string; phone?: string; email?: string } | null
  fundId: { _id: string; name: string; slug: string } | null
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  amount: number
  paymentStatus: 'pending' | 'paid' | 'waived'
  paymentReference?: string
  status: 'confirmed' | 'cancelled'
  receiptNo: string
  created: string
}

export interface DonationLedgerListQuery extends Partial<CrudListQuery> {
  page: number
  limit: number
  fundId?: string
  status?: string
  paymentStatus?: string
  from?: string
  to?: string
}

const donationLedgerListDataPaths = ['data', 'data.data', 'data.docs', 'items']
const donationLedgerListTotalPaths = ['meta.total', 'meta.totalRecords', 'data.total', 'data.totalRecords', 'total', 'totalRecords']

function normalizeDonationLedgerListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<DonationLedgerEntry> {
  return normalizeCrudListResponse<DonationLedgerEntry>({
    response,
    query,
    dataPaths: donationLedgerListDataPaths,
    totalPaths: donationLedgerListTotalPaths,
  })
}

export const donationApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDonationLedger: builder.query<CrudListResponse<DonationLedgerEntry>, DonationLedgerListQuery>({
      query: (query) => ({
        url: '/donations',
        method: 'GET',
        params: {
          page: query.page,
          limit: query.limit,
          sortfield: query.sortfield,
          direction: query.direction,
          fundId: query.fundId || undefined,
          status: query.status || undefined,
          paymentStatus: query.paymentStatus || undefined,
          from: query.from,
          to: query.to,
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: DonationLedgerListQuery) =>
        normalizeDonationLedgerListResponse(response, {
          page: query.page,
          limit: query.limit,
          criteria: query.criteria ?? [],
          sortfield: query.sortfield,
          direction: query.direction,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((entry) => ({ type: 'Donation' as const, id: entry._id })),
              { type: 'Donation' as const, id: 'LIST' },
            ]
          : [{ type: 'Donation' as const, id: 'LIST' }],
    }),
    getDonationFunds: builder.query<DonationFund[], void>({
      query: () => ({
        url: '/donation-funds',
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<DonationFund[]>(response, 'funds') ?? [],
      providesTags: (result) =>
        result
          ? [
              ...result.map((fund) => ({ type: 'DonationFund' as const, id: fund._id })),
              { type: 'DonationFund' as const, id: 'LIST' },
            ]
          : [{ type: 'DonationFund' as const, id: 'LIST' }],
    }),
    createDonationFund: builder.mutation<DonationFund, DonationFundPayload>({
      query: (payload) => ({
        url: '/donation-funds',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<DonationFund>(response, 'data'),
      invalidatesTags: [{ type: 'DonationFund', id: 'LIST' }],
    }),
    updateDonationFund: builder.mutation<DonationFund, { id: EntityId; data: Partial<DonationFundPayload> }>({
      query: ({ id, data }) => ({
        url: `/donation-funds/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<DonationFund>(response, 'data'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'DonationFund', id },
        { type: 'DonationFund', id: 'LIST' },
      ],
    }),
    deleteDonationFund: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `/donation-funds/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta, id) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'DonationFund', id },
        { type: 'DonationFund', id: 'LIST' },
      ],
    }),
    createDonation: builder.mutation<Donation, CreateDonationPayload>({
      query: (payload) => ({
        url: '/donations',
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<Donation>(response, 'donation'),
    }),
    markDonationPaid: builder.mutation<DonationLedgerEntry, { id: string; paymentReference?: string }>({
      query: ({ id, paymentReference }) => ({
        url: `/donations/${id}/mark-paid`,
        method: 'PATCH',
        data: { paymentReference },
      }),
      transformResponse: (response: unknown) => readResponsePath<DonationLedgerEntry>(response, 'donation'),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Donation' as const, id },
        { type: 'Donation' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetDonationFundsQuery,
  useCreateDonationMutation,
  useCreateDonationFundMutation,
  useUpdateDonationFundMutation,
  useDeleteDonationFundMutation,
  useGetDonationLedgerQuery,
  useMarkDonationPaidMutation,
} = donationApi
