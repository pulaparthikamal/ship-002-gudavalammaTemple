import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { referralApiDetails } from '@/models/referralModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Referral, ReferralCreatePayload, ReferralUpdatePayload } from '@/types/referral'

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

export function normalizeNumberArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is number => typeof item === 'number') : []
}

function normalizeReferral(response: unknown): Referral | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    referralId:
      typeof item.referralId === 'string'
        ? item.referralId
        : typeof item.referralId === 'object' && item.referralId !== null && '_id' in item.referralId
          ? String((item.referralId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeOptionalString(item.patientId),
    appointmentId: normalizeOptionalString(item.appointmentId),
    insuranceId: normalizeOptionalString(item.insuranceId),
    facilityId: normalizeOptionalString(item.facilityId),
    referringProviderId: normalizeOptionalString(item.referringProviderId),
    referredToProviderId: normalizeOptionalString(item.referredToProviderId),
    payerId: normalizeOptionalString(item.payerId),
    referralNumber: normalizeString(item.referralNumber),
    referralType: normalizeOptionalString(item.referralType),
    diagnosisCodes: normalizeStringArray(item.diagnosisCodes),
    procedureCodes: normalizeStringArray(item.procedureCodes),
    startDate: normalizeDateString(item.startDate),
    endDate: normalizeDateString(item.endDate),
    referralStatus: normalizeOptionalString(item.referralStatus),
    approvedVisits: normalizeOptionalNumber(item.approvedVisits),
    usedVisits: normalizeOptionalNumber(item.usedVisits),
    remainingVisits: normalizeOptionalNumber(item.remainingVisits),
    notes: normalizeOptionalString(item.notes),
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt:
      normalizeDateString(item.createdAt) ??
      normalizeDateString(item.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(item.updatedAt) ??
      normalizeDateString(item.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const referralListDataPaths = [referralApiDetails.responseDataPath, 'data.data', 'items']
const referralListTotalPaths = [
  referralApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeReferralListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Referral> {
  return normalizeCrudListResponse<unknown, Referral>({
    response,
    query,
    dataPaths: referralListDataPaths,
    totalPaths: referralListTotalPaths,
    mapItem: normalizeReferral,
  })
}

export const referralsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getReferrals: builder.query<CrudListResponse<Referral>, CrudListQuery>({
      query: (query) => ({
        url: referralApiDetails.endpoint,
        method: 'GET',
        params: {
          [referralApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeReferralListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Referral' as const, id: item._id })),
              { type: 'Referral' as const, id: 'LIST' },
            ]
          : [{ type: 'Referral' as const, id: 'LIST' }],
    }),
    getReferral: builder.query<Referral, EntityId>({
      query: (id) => ({
        url: `${referralApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeReferral(readResponsePath<unknown>(response, referralApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Referral response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Referral', id }],
    }),
    createReferral: builder.mutation<Referral, ReferralCreatePayload>({
      query: (payload) => ({
        url: referralApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeReferral(readResponsePath<unknown>(response, referralApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Referral response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Referral', id: 'LIST' }],
    }),
    updateReferral: builder.mutation<Referral, { id: EntityId; data: ReferralUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${referralApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeReferral(readResponsePath<unknown>(response, referralApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Referral response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Referral', id },
        { type: 'Referral', id: 'LIST' },
      ],
    }),
    deleteReferral: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${referralApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Referral', id },
        { type: 'Referral', id: 'LIST' },
      ],
    }),
    bulkDeleteReferrals: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${referralApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Referral' as const, id })),
        { type: 'Referral' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteReferralsMutation,
  useCreateReferralMutation,
  useDeleteReferralMutation,
  useGetReferralQuery,
  useGetReferralsQuery,
  useUpdateReferralMutation,
} = referralsApi
