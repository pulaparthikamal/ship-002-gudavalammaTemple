import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { reportApiDetails } from '@/models/reportModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { RcmOperationsReport, Report, ReportCreatePayload, ReportUpdatePayload } from '@/types/report'

export type RcmReportQuery = {
  dateFrom?: string
  dateTo?: string
  payerId?: string
  providerId?: string
  facilityId?: string
  status?: string
  claimId?: string
  denialStatus?: string
  appealStatus?: string
  arStatus?: string
  closureStatus?: string
  riskType?: string
  exceptionType?: string
  page?: number
  limit?: number
  drillDown?: string
}

export type RcmOperationalReport = Record<string, unknown>

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

function normalizeReport(response: unknown): Report | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    reportId:
      typeof item.reportId === 'string'
        ? item.reportId
        : typeof item.reportId === 'object' && item.reportId !== null && '_id' in item.reportId
          ? String((item.reportId as { _id?: string })._id ?? '')
          : '',
    reportName: normalizeOptionalString(item.reportName),
    reportType: normalizeOptionalString(item.reportType),
    dateFrom: normalizeDateString(item.dateFrom),
    dateTo: normalizeDateString(item.dateTo),
    payerId: normalizeOptionalString(item.payerId),
    providerId: normalizeOptionalString(item.providerId),
    facilityId: normalizeOptionalString(item.facilityId),
    generatedBy: normalizeOptionalString(item.generatedBy),
    generatedAt: normalizeDateString(item.generatedAt),
    exportFormat: normalizeOptionalString(item.exportFormat),
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

const reportListDataPaths = [reportApiDetails.responseDataPath, 'data.data', 'items']
const reportListTotalPaths = [
  reportApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeReportListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Report> {
  return normalizeCrudListResponse<unknown, Report>({
    response,
    query,
    dataPaths: reportListDataPaths,
    totalPaths: reportListTotalPaths,
    mapItem: normalizeReport,
  })
}

export const reportsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRcmReportsDashboard: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/dashboard`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmClaimsReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/claims`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmFinancialReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/financial`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmDenialsReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/denials`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmAppealsReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/appeals`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmArReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/ar`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmPatientBillingReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/patient-billing`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmProductivityReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/productivity`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmRealtimeReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/realtime`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmClaimClosureReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/claim-closure`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmFinancialRiskReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/financial-risk`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmTimelyFilingReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/timely-filing`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getRcmAiOperationsReport: builder.query<RcmOperationalReport, RcmReportQuery | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/ai-operations`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationalReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getReports: builder.query<CrudListResponse<Report>, CrudListQuery>({
      query: (query) => ({
        url: reportApiDetails.endpoint,
        method: 'GET',
        params: {
          [reportApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeReportListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Report' as const, id: item._id })),
              { type: 'Report' as const, id: 'LIST' },
            ]
          : [{ type: 'Report' as const, id: 'LIST' }],
    }),
    getReport: builder.query<Report, EntityId>({
      query: (id) => ({
        url: `${reportApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeReport(readResponsePath<unknown>(response, reportApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Report response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Report', id }],
    }),
    createReport: builder.mutation<Report, ReportCreatePayload>({
      query: (payload) => ({
        url: reportApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeReport(readResponsePath<unknown>(response, reportApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Report response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Report', id: 'LIST' }],
    }),
    updateReport: builder.mutation<Report, { id: EntityId; data: ReportUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${reportApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeReport(readResponsePath<unknown>(response, reportApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Report response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Report', id },
        { type: 'Report', id: 'LIST' },
      ],
    }),
    deleteReport: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${reportApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Report', id },
        { type: 'Report', id: 'LIST' },
      ],
    }),
    bulkDeleteReports: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${reportApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Report' as const, id })),
        { type: 'Report' as const, id: 'LIST' },
      ],
    }),
    getRcmOperationsReport: builder.query<RcmOperationsReport, { dateFrom?: string; dateTo?: string; payerId?: string } | void>({
      query: (params) => ({
        url: `${reportApiDetails.endpoint}/rcm-operations`,
        method: 'GET',
        params: params ?? {},
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOperationsReport>(response, 'data'),
      providesTags: [{ type: 'Report' as const, id: 'RCM_OPERATIONS' }],
    }),
  }),
})

export const {
  useBulkDeleteReportsMutation,
  useCreateReportMutation,
  useDeleteReportMutation,
  useGetRcmAppealsReportQuery,
  useGetRcmArReportQuery,
  useGetRcmAiOperationsReportQuery,
  useGetRcmClaimClosureReportQuery,
  useGetRcmClaimsReportQuery,
  useGetRcmDenialsReportQuery,
  useGetRcmFinancialRiskReportQuery,
  useGetRcmFinancialReportQuery,
  useGetRcmOperationsReportQuery,
  useGetRcmPatientBillingReportQuery,
  useGetRcmProductivityReportQuery,
  useGetRcmRealtimeReportQuery,
  useGetRcmReportsDashboardQuery,
  useGetRcmTimelyFilingReportQuery,
  useGetReportQuery,
  useGetReportsQuery,
  useUpdateReportMutation,
} = reportsApi
