import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { auditLogApiDetails } from '@/models/auditLogModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { AuditLog } from '@/types/auditLog'

export type RcmAuditLogQuery = {
  page?: number
  limit?: number
  search?: string
  entityType?: string
  entityId?: string
  action?: string
  user?: string
  claimId?: string
  appointmentId?: string
  denial?: string
  appeal?: string
  financialEventId?: string
  correlationId?: string
  submissionId?: string
  payerId?: string
  patientId?: string
  severity?: string
  category?: string
  visibility?: string
  source?: string
  status?: string
  includeTechnical?: string
  dateFrom?: string
  dateTo?: string
  defaultDateRange?: string
  currentStage?: string
  hasOpenRisks?: string
}

export type RcmAuditLogList = {
  data: AuditLog[]
  pagination: {
    page: number
    limit: number
    totalCount: number
    totalPages: number
  }
}

export type RcmAuditClaimTimeline = {
  claimId: string
  correlationIds: string[]
  groups: Record<string, AuditLog[]>
  sections?: Array<{ section: string; events: AuditLog[] }>
  events: AuditLog[]
  pagination: RcmAuditLogList['pagination']
}

export type RcmAuditAppointmentTimeline = {
  appointmentId: string
  claimIds: string[]
  correlationIds: string[]
  groups: Record<string, AuditLog[]>
  sections?: Array<{ section: string; events: AuditLog[] }>
  events: AuditLog[]
  pagination: RcmAuditLogList['pagination']
}

export type RcmAuditSummaryQuery = RcmAuditLogQuery & {
  providerId?: string
  facilityId?: string
}

export type RcmAuditAppointmentSummary = {
  appointmentId: string
  appointmentDate?: string
  patientReference?: string
  encounterId?: string
  chargeId?: string
  claimId?: string
  currentStage?: string
  currentClaimStatus?: string
  lastAuditAction?: string
  lastUpdatedAt?: string
  eventCount: number
  openRiskCount: number
  status?: string
  severity?: string
}

export type RcmAuditClaimSummary = {
  claimId: string
  patientReference?: string
  payerName?: string
  facilityName?: string
  claimStatus?: string
  submissionStatus?: string
  paymentStatus?: string
  closureStatus?: string
  lastAuditAction?: string
  lastUpdatedAt?: string
  eventCount: number
  openRiskCount: number
  status?: string
  severity?: string
}

export type RcmAuditSummaryList<T> = {
  data: T[]
  pagination: RcmAuditLogList['pagination']
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

function normalizeAuditLog(response: unknown): AuditLog | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    auditId:
      typeof item.auditId === 'string'
        ? item.auditId
        : typeof item.auditId === 'object' && item.auditId !== null && '_id' in item.auditId
          ? String((item.auditId as { _id?: string })._id ?? '')
          : '',
    entityType: normalizeOptionalString(item.entityType),
    entityId: normalizeOptionalString(item.entityId),
    action: normalizeOptionalString(item.action),
    userId: normalizeOptionalString(item.userId),
    userName: normalizeOptionalString(item.userName),
    previousState: item.previousState,
    newState: item.newState,
    reason: normalizeOptionalString(item.reason),
    source: normalizeOptionalString(item.source),
    correlationId: normalizeOptionalString(item.correlationId),
    claimId: normalizeOptionalString(item.claimId),
    submissionId: normalizeOptionalString(item.submissionId),
    financialEventId: normalizeOptionalString(item.financialEventId),
    appointmentId: normalizeOptionalString(item.appointmentId),
    patientId: normalizeOptionalString(item.patientId),
    payerId: normalizeOptionalString(item.payerId),
    severity: normalizeOptionalString(item.severity),
    category: normalizeOptionalString(item.category),
    visibility: normalizeOptionalString(item.visibility),
    status: normalizeOptionalString(item.status),
    userAgent: normalizeOptionalString(item.userAgent),
    retentionClass: normalizeOptionalString(item.retentionClass),
    retentionUntil: normalizeDateString(item.retentionUntil),
    legalHold: typeof item.legalHold === 'boolean' ? item.legalHold : undefined,
    redactionVersion: normalizeOptionalString(item.redactionVersion),
    fieldName: normalizeOptionalString(item.fieldName),
    oldValue: item.oldValue,
    newValue: item.newValue,
    changedBy: normalizeOptionalString(item.changedBy),
    timestamp: normalizeDateString(item.timestamp),
    sourceModule: normalizeOptionalString(item.sourceModule),
    ipAddress: normalizeOptionalString(item.ipAddress),
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

const auditLogListDataPaths = [auditLogApiDetails.responseDataPath, 'data.data', 'items']
const auditLogListTotalPaths = [
  auditLogApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeAuditLogListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<AuditLog> {
  return normalizeCrudListResponse<unknown, AuditLog>({
    response,
    query,
    dataPaths: auditLogListDataPaths,
    totalPaths: auditLogListTotalPaths,
    mapItem: normalizeAuditLog,
  })
}

export const auditLogsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRcmAuditLogs: builder.query<RcmAuditLogList, RcmAuditLogQuery | void>({
      query: (query) => ({
        url: auditLogApiDetails.endpoint,
        method: 'GET',
        params: query ?? {},
      }),
      transformResponse: (response: unknown) => {
        const result = readResponsePath<{ data?: unknown[]; pagination?: RcmAuditLogList['pagination'] }>(response, 'data') ?? {}
        const rows = Array.isArray(result.data) ? result.data.map(normalizeAuditLog).filter((item): item is AuditLog => Boolean(item)) : []
        return {
          data: rows,
          pagination: result.pagination ?? {
            page: 1,
            limit: rows.length,
            totalCount: rows.length,
            totalPages: 1,
          },
        }
      },
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'AuditLog' as const, id: item._id })),
              { type: 'AuditLog' as const, id: 'LIST' },
            ]
          : [{ type: 'AuditLog' as const, id: 'LIST' }],
    }),
    getRcmAuditLogEntityHistory: builder.query<RcmAuditLogList, { entityType: string; entityId: string; query?: RcmAuditLogQuery }>({
      query: ({ entityType, entityId, query }) => ({
        url: `${auditLogApiDetails.endpoint}/entity/${entityType}/${entityId}`,
        method: 'GET',
        params: query ?? {},
      }),
      transformResponse: (response: unknown) => {
        const result = readResponsePath<{ data?: unknown[]; pagination?: RcmAuditLogList['pagination'] }>(response, 'data') ?? {}
        const rows = Array.isArray(result.data) ? result.data.map(normalizeAuditLog).filter((item): item is AuditLog => Boolean(item)) : []
        return {
          data: rows,
          pagination: result.pagination ?? {
            page: 1,
            limit: rows.length,
            totalCount: rows.length,
            totalPages: 1,
          },
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'AuditLog' as const, id: 'LIST' },
        { type: 'AuditLog' as const, id: `${arg.entityType}:${arg.entityId}` },
      ],
    }),
    getRcmAuditAppointmentSummaries: builder.query<RcmAuditSummaryList<RcmAuditAppointmentSummary>, RcmAuditSummaryQuery | void>({
      query: (query) => ({
        url: `${auditLogApiDetails.endpoint}/summary/appointments`,
        method: 'GET',
        params: query ?? {},
      }),
      transformResponse: (response: unknown) => {
        const result = readResponsePath<{ data?: unknown[]; pagination?: RcmAuditLogList['pagination'] }>(response, 'data') ?? {}
        const rows = Array.isArray(result.data)
          ? result.data.map((item) => item as RcmAuditAppointmentSummary)
          : []
        return {
          data: rows,
          pagination: result.pagination ?? { page: 1, limit: rows.length, totalCount: rows.length, totalPages: 1 },
        }
      },
      providesTags: [{ type: 'AuditLog' as const, id: 'SUMMARY:APPOINTMENTS' }, { type: 'AuditLog' as const, id: 'LIST' }],
    }),
    getRcmAuditClaimSummaries: builder.query<RcmAuditSummaryList<RcmAuditClaimSummary>, RcmAuditSummaryQuery | void>({
      query: (query) => ({
        url: `${auditLogApiDetails.endpoint}/summary/claims`,
        method: 'GET',
        params: query ?? {},
      }),
      transformResponse: (response: unknown) => {
        const result = readResponsePath<{ data?: unknown[]; pagination?: RcmAuditLogList['pagination'] }>(response, 'data') ?? {}
        const rows = Array.isArray(result.data)
          ? result.data.map((item) => item as RcmAuditClaimSummary)
          : []
        return {
          data: rows,
          pagination: result.pagination ?? { page: 1, limit: rows.length, totalCount: rows.length, totalPages: 1 },
        }
      },
      providesTags: [{ type: 'AuditLog' as const, id: 'SUMMARY:CLAIMS' }, { type: 'AuditLog' as const, id: 'LIST' }],
    }),
    getRcmAuditLogClaimTimeline: builder.query<RcmAuditClaimTimeline, { claimId: string; query?: RcmAuditLogQuery }>({
      query: ({ claimId, query }) => ({
        url: `${auditLogApiDetails.endpoint}/timeline/claim/${claimId}`,
        method: 'GET',
        params: query ?? {},
      }),
      transformResponse: (response: unknown) => {
        const result = readResponsePath<{
          claimId?: string
          correlationIds?: string[]
          groups?: Record<string, unknown[]>
          sections?: Array<{ section?: string; events?: unknown[] }>
          events?: unknown[]
          pagination?: RcmAuditLogList['pagination']
        }>(response, 'data') ?? {}
        const normalizeRows = (rows: unknown[] | undefined) => Array.isArray(rows)
          ? rows.map(normalizeAuditLog).filter((item): item is AuditLog => Boolean(item))
          : []
        const groups = Object.entries(result.groups ?? {}).reduce<Record<string, AuditLog[]>>((next, [key, rows]) => {
          next[key] = normalizeRows(rows)
          return next
        }, {})
        const events = normalizeRows(result.events)
        const sections = Array.isArray(result.sections)
          ? result.sections
              .map((section) => ({
                section: typeof section.section === 'string' ? section.section : '',
                events: normalizeRows(section.events),
              }))
              .filter((section) => section.section && section.events.length)
          : undefined
        return {
          claimId: result.claimId ?? '',
          correlationIds: Array.isArray(result.correlationIds) ? result.correlationIds.filter((item): item is string => typeof item === 'string') : [],
          groups,
          sections,
          events,
          pagination: result.pagination ?? {
            page: 1,
            limit: events.length,
            totalCount: events.length,
            totalPages: 1,
          },
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'AuditLog' as const, id: 'LIST' },
        { type: 'AuditLog' as const, id: `claim:${arg.claimId}:timeline` },
      ],
    }),
    getRcmAuditLogAppointmentTimeline: builder.query<RcmAuditAppointmentTimeline, { appointmentId: string; query?: RcmAuditLogQuery }>({
      query: ({ appointmentId, query }) => ({
        url: `${auditLogApiDetails.endpoint}/timeline/appointment/${appointmentId}`,
        method: 'GET',
        params: query ?? {},
      }),
      transformResponse: (response: unknown) => {
        const result = readResponsePath<{
          appointmentId?: string
          claimIds?: string[]
          correlationIds?: string[]
          groups?: Record<string, unknown[]>
          sections?: Array<{ section?: string; events?: unknown[] }>
          events?: unknown[]
          pagination?: RcmAuditLogList['pagination']
        }>(response, 'data') ?? {}
        const normalizeRows = (rows: unknown[] | undefined) => Array.isArray(rows)
          ? rows.map(normalizeAuditLog).filter((item): item is AuditLog => Boolean(item))
          : []
        const groups = Object.entries(result.groups ?? {}).reduce<Record<string, AuditLog[]>>((next, [key, rows]) => {
          next[key] = normalizeRows(rows)
          return next
        }, {})
        const events = normalizeRows(result.events)
        const sections = Array.isArray(result.sections)
          ? result.sections
              .map((section) => ({
                section: typeof section.section === 'string' ? section.section : '',
                events: normalizeRows(section.events),
              }))
              .filter((section) => section.section && section.events.length)
          : undefined
        return {
          appointmentId: result.appointmentId ?? '',
          claimIds: Array.isArray(result.claimIds) ? result.claimIds.filter((item): item is string => typeof item === 'string') : [],
          correlationIds: Array.isArray(result.correlationIds) ? result.correlationIds.filter((item): item is string => typeof item === 'string') : [],
          groups,
          sections,
          events,
          pagination: result.pagination ?? {
            page: 1,
            limit: events.length,
            totalCount: events.length,
            totalPages: 1,
          },
        }
      },
      providesTags: (_result, _error, arg) => [
        { type: 'AuditLog' as const, id: 'LIST' },
        { type: 'AuditLog' as const, id: `appointment:${arg.appointmentId}:timeline` },
      ],
    }),
    getAuditLogs: builder.query<CrudListResponse<AuditLog>, CrudListQuery>({
      query: (query) => ({
        url: auditLogApiDetails.endpoint,
        method: 'GET',
        params: {
          [auditLogApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeAuditLogListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'AuditLog' as const, id: item._id })),
              { type: 'AuditLog' as const, id: 'LIST' },
            ]
          : [{ type: 'AuditLog' as const, id: 'LIST' }],
    }),
    getAuditLog: builder.query<AuditLog, EntityId>({
      query: (id) => ({
        url: `${auditLogApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeAuditLog(readResponsePath<unknown>(response, auditLogApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Audit Log response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'AuditLog', id }],
    }),
  }),
})

export const {
  useGetAuditLogQuery,
  useGetAuditLogsQuery,
  useGetRcmAuditAppointmentSummariesQuery,
  useGetRcmAuditClaimSummariesQuery,
  useGetRcmAuditLogAppointmentTimelineQuery,
  useGetRcmAuditLogClaimTimelineQuery,
  useGetRcmAuditLogEntityHistoryQuery,
  useGetRcmAuditLogsQuery,
} = auditLogsApi
