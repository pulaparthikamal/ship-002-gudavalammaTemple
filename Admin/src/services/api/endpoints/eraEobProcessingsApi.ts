import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { eraEobProcessingApiDetails } from '@/models/eraEobProcessingModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Era835ImportPayload, Era835ImportResult, EraAccountingLockPayload, EraAccountingUnlockPayload, EraEobProcessing, EraEobProcessingCreatePayload, EraEobProcessingUpdatePayload } from '@/types/eraEobProcessing'

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

function normalizeEraEobProcessing(response: unknown): EraEobProcessing | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    eraId:
      typeof item.eraId === 'string'
        ? item.eraId
        : typeof item.eraId === 'object' && item.eraId !== null && '_id' in item.eraId
          ? String((item.eraId as { _id?: string })._id ?? '')
          : '',
    payerId: normalizeOptionalString(item.payerId),
    payerName: normalizeOptionalString(item.payerName),
    paymentId: normalizeOptionalString(item.paymentId),
    eraReceived: Boolean(item.eraReceived),
    eraFileReference: normalizeOptionalString(item.eraFileReference),
    eraBatchId: normalizeOptionalString(item.eraBatchId),
    depositId: normalizeOptionalString(item.depositId),
    raw835FileReference: normalizeOptionalString(item.raw835FileReference),
    rawPayloadRedacted: normalizeOptionalString(item.rawPayloadRedacted),
    rawPayloadStored: typeof item.rawPayloadStored === 'boolean' ? item.rawPayloadStored : undefined,
    checkNumber: normalizeOptionalString(item.checkNumber),
    paymentTraceNumber: normalizeOptionalString(item.paymentTraceNumber),
    paymentMethod: normalizeOptionalString(item.paymentMethod),
    paymentDate: normalizeDateString(item.paymentDate),
    totalAmount: normalizeOptionalNumber(item.totalAmount),
    totalPaymentAmount: normalizeOptionalNumber(item.totalPaymentAmount),
    depositAmount: normalizeOptionalNumber(item.depositAmount),
    postedAmount: normalizeOptionalNumber(item.postedAmount),
    claimPaidAmount: normalizeOptionalNumber(item.claimPaidAmount),
    serviceLinePaidAmount: normalizeOptionalNumber(item.serviceLinePaidAmount),
    adjustmentTotal: normalizeOptionalNumber(item.adjustmentTotal),
    patientResponsibilityTotal: normalizeOptionalNumber(item.patientResponsibilityTotal),
    unmatchedAmount: normalizeOptionalNumber(item.unmatchedAmount),
    reconciliationStatus: normalizeOptionalString(item.reconciliationStatus) as EraEobProcessing['reconciliationStatus'],
    accountingLocked: typeof item.accountingLocked === 'boolean' ? item.accountingLocked : undefined,
    accountingLockedAt: normalizeDateString(item.accountingLockedAt),
    accountingLockedBy: normalizeOptionalString(item.accountingLockedBy),
    accountingLockReason: normalizeOptionalString(item.accountingLockReason),
    accountingUnlockedAt: normalizeDateString(item.accountingUnlockedAt),
    accountingUnlockedBy: normalizeOptionalString(item.accountingUnlockedBy),
    accountingUnlockReason: normalizeOptionalString(item.accountingUnlockReason),
    exceptionReason: normalizeOptionalString(item.exceptionReason),
    receivedDate: normalizeDateString(item.receivedDate),
    importStatus: normalizeOptionalString(item.importStatus),
    parsedStatus: normalizeOptionalString(item.parsedStatus),
    fileMetadata: typeof item.fileMetadata === 'object' && item.fileMetadata !== null ? item.fileMetadata as Record<string, unknown> : undefined,
    matchedClaims: Array.isArray(item.matchedClaims) ? item.matchedClaims.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) : [],
    unmatchedClaims: Array.isArray(item.unmatchedClaims) ? item.unmatchedClaims.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) : [],
    parseErrors: normalizeStringArray(item.parseErrors),
    importErrors: normalizeStringArray(item.importErrors),
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

const eraEobProcessingListDataPaths = [eraEobProcessingApiDetails.responseDataPath, 'data.data', 'items']
const eraEobProcessingListTotalPaths = [
  eraEobProcessingApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeEraEobProcessingListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<EraEobProcessing> {
  return normalizeCrudListResponse<unknown, EraEobProcessing>({
    response,
    query,
    dataPaths: eraEobProcessingListDataPaths,
    totalPaths: eraEobProcessingListTotalPaths,
    mapItem: normalizeEraEobProcessing,
  })
}

export const eraEobProcessingsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEraEobProcessings: builder.query<CrudListResponse<EraEobProcessing>, CrudListQuery>({
      query: (query) => ({
        url: eraEobProcessingApiDetails.endpoint,
        method: 'GET',
        params: {
          [eraEobProcessingApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeEraEobProcessingListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'EraEobProcessing' as const, id: item._id })),
              { type: 'EraEobProcessing' as const, id: 'LIST' },
            ]
          : [{ type: 'EraEobProcessing' as const, id: 'LIST' }],
    }),
    getEraEobProcessing: builder.query<EraEobProcessing, EntityId>({
      query: (id) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraEobProcessing(readResponsePath<unknown>(response, eraEobProcessingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('ERA / EOB Processing response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'EraEobProcessing', id }],
    }),
    createEraEobProcessing: builder.mutation<EraEobProcessing, EraEobProcessingCreatePayload>({
      query: (payload) => ({
        url: eraEobProcessingApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraEobProcessing(readResponsePath<unknown>(response, eraEobProcessingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('ERA / EOB Processing response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'EraEobProcessing', id: 'LIST' }],
    }),
    import835Era: builder.mutation<Era835ImportResult, Era835ImportPayload>({
      query: (payload) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/import-835`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<unknown>(response, 'data')
        const item = typeof data === 'object' && data !== null ? data as Record<string, unknown> : {}
        const eraEobProcessing = normalizeEraEobProcessing(item.eraEobProcessing)

        if (!eraEobProcessing) {
          throw new Error('835 import response is invalid.')
        }

        return {
          eraEobProcessing,
          paymentPostings: Array.isArray(item.paymentPostings) ? item.paymentPostings : [],
          matchedClaims: Array.isArray(item.matchedClaims) ? item.matchedClaims.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) : [],
          unmatchedClaims: Array.isArray(item.unmatchedClaims) ? item.unmatchedClaims.filter((value): value is Record<string, unknown> => typeof value === 'object' && value !== null) : [],
          parseErrors: normalizeStringArray(item.parseErrors),
          importErrors: normalizeStringArray(item.importErrors),
          duplicate: Boolean(item.duplicate),
        }
      },
      invalidatesTags: [
        { type: 'EraEobProcessing', id: 'LIST' },
        { type: 'PaymentPosting', id: 'LIST' },
        { type: 'Adjustment', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    lockEraEobProcessing: builder.mutation<EraEobProcessing, { id: EntityId; data?: EraAccountingLockPayload }>({
      query: ({ id, data }) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/${id}/lock`,
        method: 'POST',
        data: data ?? {},
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraEobProcessing(readResponsePath<unknown>(response, eraEobProcessingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('ERA accounting lock response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'EraEobProcessing', id },
        { type: 'EraEobProcessing', id: 'LIST' },
      ],
    }),
    unlockEraEobProcessing: builder.mutation<EraEobProcessing, { id: EntityId; data: EraAccountingUnlockPayload }>({
      query: ({ id, data }) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/${id}/unlock`,
        method: 'POST',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraEobProcessing(readResponsePath<unknown>(response, eraEobProcessingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('ERA accounting unlock response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'EraEobProcessing', id },
        { type: 'EraEobProcessing', id: 'LIST' },
      ],
    }),
    updateEraEobProcessing: builder.mutation<EraEobProcessing, { id: EntityId; data: EraEobProcessingUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEraEobProcessing(readResponsePath<unknown>(response, eraEobProcessingApiDetails.responseDataPath))

        if (!item) {
          throw new Error('ERA / EOB Processing response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'EraEobProcessing', id },
        { type: 'EraEobProcessing', id: 'LIST' },
      ],
    }),
    deleteEraEobProcessing: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'EraEobProcessing', id },
        { type: 'EraEobProcessing', id: 'LIST' },
      ],
    }),
    bulkDeleteEraEobProcessings: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${eraEobProcessingApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'EraEobProcessing' as const, id })),
        { type: 'EraEobProcessing' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteEraEobProcessingsMutation,
  useCreateEraEobProcessingMutation,
  useDeleteEraEobProcessingMutation,
  useGetEraEobProcessingQuery,
  useGetEraEobProcessingsQuery,
  useImport835EraMutation,
  useLockEraEobProcessingMutation,
  useUnlockEraEobProcessingMutation,
  useUpdateEraEobProcessingMutation,
} = eraEobProcessingsApi
