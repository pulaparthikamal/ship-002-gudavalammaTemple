import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  DocumentationComplianceAlert,
  DocumentationComplianceRefreshResult,
} from '@/types/documentationComplianceAlert'

const endpoint = '/rcm/documentation-compliance-alerts'

function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}

function normalizeObjectId(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    return String((value as { _id?: unknown })._id ?? '')
  }

  return ''
}

function normalizeDocumentationComplianceAlert(response: unknown): DocumentationComplianceAlert | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>
  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    alertId: normalizeObjectId(item.alertId),
    alertType: 'DOCUMENTATION_GAP',
    claimId: normalizeObjectId(item.claimId),
    missingDocuments: normalizeStringArray(item.missingDocuments),
    requiredDocuments: normalizeStringArray(item.requiredDocuments),
    matchedDocuments: normalizeStringArray(item.matchedDocuments),
    severity: (normalizeOptionalString(item.severity) as DocumentationComplianceAlert['severity'] | undefined) ?? 'LOW',
    status: (normalizeOptionalString(item.status) as DocumentationComplianceAlert['status'] | undefined) ?? 'PASS',
    lastZapierTriggeredAt: normalizeDateString(item.lastZapierTriggeredAt),
    lastZapierStatus: normalizeOptionalString(item.lastZapierStatus) as DocumentationComplianceAlert['lastZapierStatus'],
    lastZapierMissingDocuments: normalizeStringArray(item.lastZapierMissingDocuments),
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

function normalizeDocumentationComplianceAlertListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<DocumentationComplianceAlert> {
  return normalizeCrudListResponse<unknown, DocumentationComplianceAlert>({
    response,
    query,
    dataPaths: ['data', 'data.data', 'items'],
    totalPaths: ['meta.total', 'meta.totalRecords', 'data.total', 'total', 'totalRecords'],
    mapItem: normalizeDocumentationComplianceAlert,
  })
}

export const documentationComplianceAlertsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDocumentationComplianceAlerts: builder.query<CrudListResponse<DocumentationComplianceAlert>, CrudListQuery>({
      query: (query) => ({
        url: endpoint,
        method: 'GET',
        params: {
          filter: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeDocumentationComplianceAlertListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'DocumentationComplianceAlert' as const, id: item._id })),
              { type: 'DocumentationComplianceAlert' as const, id: 'LIST' },
            ]
          : [{ type: 'DocumentationComplianceAlert' as const, id: 'LIST' }],
    }),
    getDocumentationComplianceAlert: builder.query<DocumentationComplianceAlert, EntityId>({
      query: (id) => ({
        url: `${endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDocumentationComplianceAlert(readResponsePath<unknown>(response, 'data'))
        if (!item) {
          throw new Error('Documentation compliance alert response is invalid.')
        }
        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'DocumentationComplianceAlert', id }],
    }),
    refreshDocumentationComplianceAlerts: builder.mutation<DocumentationComplianceRefreshResult, void>({
      query: () => ({
        url: `${endpoint}/refresh`,
        method: 'POST',
        data: {},
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<DocumentationComplianceRefreshResult>(response, 'data'),
      invalidatesTags: [
        { type: 'DocumentationComplianceAlert', id: 'LIST' },
        { type: 'Report', id: 'LIST' },
      ],
    }),
    refreshDocumentationComplianceClaim: builder.mutation<DocumentationComplianceAlert | null, EntityId>({
      query: (id) => ({
        url: `${endpoint}/refresh-claim/${id}`,
        method: 'POST',
        data: {},
      }),
      transformResponse: (response: unknown) =>
        normalizeDocumentationComplianceAlert(readResponsePath<unknown>(response, 'data.alert')),
      invalidatesTags: (_result, _error, id) => [
        { type: 'DocumentationComplianceAlert', id },
        { type: 'DocumentationComplianceAlert', id: 'LIST' },
        { type: 'Report', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useGetDocumentationComplianceAlertQuery,
  useGetDocumentationComplianceAlertsQuery,
  useRefreshDocumentationComplianceAlertsMutation,
  useRefreshDocumentationComplianceClaimMutation,
} = documentationComplianceAlertsApi
