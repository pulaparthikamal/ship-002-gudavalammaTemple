import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { TimelyFilingAlert, TimelyFilingRefreshResult } from '@/types/timelyFilingAlert'

const endpoint = '/rcm/timely-filing-alerts'

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeTimelyFilingAlert(response: unknown): TimelyFilingAlert | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>
  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    alertId:
      typeof item.alertId === 'string'
        ? item.alertId
        : typeof item.alertId === 'object' && item.alertId !== null && '_id' in item.alertId
          ? String((item.alertId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeOptionalString(item.claimId) ?? '',
    payerId: normalizeOptionalString(item.payerId) ?? '',
    serviceDate: normalizeDateString(item.serviceDate) ?? '',
    filingDeadline: normalizeDateString(item.filingDeadline) ?? '',
    daysRemaining: typeof item.daysRemaining === 'number' ? item.daysRemaining : 0,
    severity: (normalizeOptionalString(item.severity) as TimelyFilingAlert['severity'] | undefined) ?? 'LOW',
    status: (normalizeOptionalString(item.status) as TimelyFilingAlert['status'] | undefined) ?? 'SAFE',
    lastZapierTriggeredAt: normalizeDateString(item.lastZapierTriggeredAt),
    lastZapierStatus: normalizeOptionalString(item.lastZapierStatus) as TimelyFilingAlert['lastZapierStatus'],
    lastZapierSeverity: normalizeOptionalString(item.lastZapierSeverity) as TimelyFilingAlert['lastZapierSeverity'],
    zapierDeliveryStatus: normalizeOptionalString(item.zapierDeliveryStatus),
    zapierDeliveryError: normalizeOptionalString(item.zapierDeliveryError),
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

function normalizeTimelyFilingAlertListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<TimelyFilingAlert> {
  return normalizeCrudListResponse<unknown, TimelyFilingAlert>({
    response,
    query,
    dataPaths: ['data', 'data.data', 'items'],
    totalPaths: ['meta.total', 'meta.totalRecords', 'data.total', 'total', 'totalRecords'],
    mapItem: normalizeTimelyFilingAlert,
  })
}

export const timelyFilingAlertsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getTimelyFilingAlerts: builder.query<CrudListResponse<TimelyFilingAlert>, CrudListQuery>({
      query: (query) => ({
        url: endpoint,
        method: 'GET',
        params: {
          filter: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeTimelyFilingAlertListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'TimelyFilingAlert' as const, id: item._id })),
              { type: 'TimelyFilingAlert' as const, id: 'LIST' },
            ]
          : [{ type: 'TimelyFilingAlert' as const, id: 'LIST' }],
    }),
    getTimelyFilingAlert: builder.query<TimelyFilingAlert, EntityId>({
      query: (id) => ({
        url: `${endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeTimelyFilingAlert(readResponsePath<unknown>(response, 'data'))
        if (!item) {
          throw new Error('Timely filing alert response is invalid.')
        }
        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'TimelyFilingAlert', id }],
    }),
    refreshTimelyFilingAlerts: builder.mutation<TimelyFilingRefreshResult, void>({
      query: () => ({
        url: `${endpoint}/refresh`,
        method: 'POST',
        data: {},
      }),
      transformResponse: (response: unknown) => readResponsePath<TimelyFilingRefreshResult>(response, 'data'),
      invalidatesTags: [
        { type: 'TimelyFilingAlert', id: 'LIST' },
        { type: 'Report', id: 'LIST' },
      ],
    }),
    refreshTimelyFilingClaim: builder.mutation<TimelyFilingAlert | null, EntityId>({
      query: (id) => ({
        url: `${endpoint}/refresh-claim/${id}`,
        method: 'POST',
        data: {},
      }),
      transformResponse: (response: unknown) => normalizeTimelyFilingAlert(readResponsePath<unknown>(response, 'data.alert')),
      invalidatesTags: (_result, _error, id) => [
        { type: 'TimelyFilingAlert', id },
        { type: 'TimelyFilingAlert', id: 'LIST' },
        { type: 'Report', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetTimelyFilingAlertQuery,
  useGetTimelyFilingAlertsQuery,
  useRefreshTimelyFilingAlertsMutation,
  useRefreshTimelyFilingClaimMutation,
} = timelyFilingAlertsApi
