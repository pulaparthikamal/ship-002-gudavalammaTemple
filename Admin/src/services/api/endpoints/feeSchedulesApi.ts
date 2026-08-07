import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { feeScheduleApiDetails } from '@/models/feeScheduleModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  FeeSchedule,
  FeeScheduleCreatePayload,
  FeeScheduleLookupPayload,
  FeeScheduleLookupResult,
  FeeScheduleUpdatePayload,
} from '@/types/feeSchedule'

function normalizeFeeSchedule(response: unknown): FeeSchedule | null {
  if (typeof response !== 'object' || response === null) return null
  const item = response as any
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    feeScheduleId: item.feeScheduleId,
    payerId: item.payerId,
    cptCode: item.cptCode,
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : [],
    providerId: item.providerId,
    facilityId: item.facilityId,
    state: item.state,
    placeOfServiceCode: item.placeOfServiceCode,
    planName: item.planName,
    groupNumber: item.groupNumber,
    network: item.network,
    coverageType: item.coverageType,
    allowedAmount: item.allowedAmount,
    effectiveDate: item.effectiveDate,
    expiryDate: item.expiryDate,
    active: item.active,
    createdAt: item.createdAt || item.created,
    updatedAt: item.updatedAt || item.updated,
  }
}

export const feeSchedulesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getFeeSchedules: builder.query<CrudListResponse<FeeSchedule>, CrudListQuery>({
      query: (query) => ({
        url: feeScheduleApiDetails.endpoint,
        method: 'GET',
        params: query,
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse({
          response,
          query,
          dataPaths: [feeScheduleApiDetails.responseDataPath],
          totalPaths: [feeScheduleApiDetails.responseTotalPath],
          mapItem: normalizeFeeSchedule,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'FeeSchedule' as const, id: item._id })),
              { type: 'FeeSchedule' as const, id: 'LIST' },
            ]
          : [{ type: 'FeeSchedule' as const, id: 'LIST' }],
    }),
    getFeeSchedule: builder.query<FeeSchedule, EntityId>({
      query: (id) => ({
        url: `${feeScheduleApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        normalizeFeeSchedule(readResponsePath(response, feeScheduleApiDetails.responseDataPath))!,
      providesTags: (_result, _error, id) => [{ type: 'FeeSchedule', id }],
    }),
    createFeeSchedule: builder.mutation<FeeSchedule, FeeScheduleCreatePayload>({
      query: (payload) => ({
        url: feeScheduleApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: [{ type: 'FeeSchedule', id: 'LIST' }],
    }),
    updateFeeSchedule: builder.mutation<FeeSchedule, { id: EntityId; data: FeeScheduleUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${feeScheduleApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'FeeSchedule', id },
        { type: 'FeeSchedule', id: 'LIST' },
      ],
    }),
    deleteFeeSchedule: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${feeScheduleApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'FeeSchedule', id },
        { type: 'FeeSchedule', id: 'LIST' },
      ],
    }),
    lookupFeeSchedule: builder.mutation<FeeScheduleLookupResult | null, FeeScheduleLookupPayload>({
      query: (payload) => ({
        url: `${feeScheduleApiDetails.endpoint}/lookup`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<FeeScheduleLookupResult | null>(response, feeScheduleApiDetails.responseDataPath),
    }),
  }),
})

export const {
  useCreateFeeScheduleMutation,
  useDeleteFeeScheduleMutation,
  useGetFeeScheduleQuery,
  useGetFeeSchedulesQuery,
  useLookupFeeScheduleMutation,
  useUpdateFeeScheduleMutation,
} = feeSchedulesApi
