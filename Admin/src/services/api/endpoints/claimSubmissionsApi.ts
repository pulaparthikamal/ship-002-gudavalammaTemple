import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { claimSubmissionApiDetails } from '@/models/claimSubmissionModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ClaimSubmission } from '@/types/claimSubmission'

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

export function normalizeClaimSubmission(response: unknown): ClaimSubmission | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    submissionId:
      typeof item.submissionId === 'string'
        ? item.submissionId
        : typeof item.submissionId === 'object' && item.submissionId !== null && '_id' in item.submissionId
          ? String((item.submissionId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeOptionalString(item.claimId),
    previousSubmissionId: normalizeOptionalString(item.previousSubmissionId),
    submissionType: normalizeOptionalString(item.submissionType),
    submissionMethod: normalizeOptionalString(item.submissionMethod),
    submissionFileType: normalizeOptionalString(item.submissionFileType),
    payloadFormat: normalizeOptionalString(item.payloadFormat),
    submissionDateTime: normalizeDateString(item.submissionDateTime),
    clearinghouseName: normalizeOptionalString(item.clearinghouseName),
    clearinghouseEndpoint: normalizeOptionalString(item.clearinghouseEndpoint),
    batchId: normalizeString(item.batchId),
    submissionTraceId: normalizeOptionalString(item.submissionTraceId),
    externalSubmissionId: normalizeOptionalString(item.externalSubmissionId),
    externalBatchId: normalizeOptionalString(item.externalBatchId),
    controlNumber: normalizeOptionalString(item.controlNumber),
    claimControlNumber: normalizeOptionalString(item.claimControlNumber),
    clearinghouseTraceNumber: normalizeOptionalString(item.clearinghouseTraceNumber),
    payerClaimNumber: normalizeOptionalString(item.payerClaimNumber),
    idempotencyKey: normalizeOptionalString(item.idempotencyKey),
    retrySequence: normalizeOptionalNumber(item.retrySequence),
    retryCount: normalizeOptionalNumber(item.retryCount),
    retryable: typeof item.retryable === 'boolean' ? item.retryable : undefined,
    lastRetryAt: normalizeDateString(item.lastRetryAt),
    payloadSnapshot: normalizeOptionalString(item.payloadSnapshot),
    requestPayloadRedacted: normalizeOptionalString(item.requestPayloadRedacted),
    responsePayloadRedacted: normalizeOptionalString(item.responsePayloadRedacted),
    trackingSource: item.trackingSource === 'SIMULATED' ? 'SIMULATED' : item.trackingSource === 'REAL' ? 'REAL' : undefined,
    responseType:
      item.responseType === 'SUBMISSION' ||
      item.responseType === 'ACK_999' ||
      item.responseType === 'ACK_277CA' ||
      item.responseType === 'STATUS_UPDATE'
        ? item.responseType
        : undefined,
    normalizedStatus:
      item.normalizedStatus === 'DRAFT' ||
      item.normalizedStatus === 'READY' ||
      item.normalizedStatus === 'SUBMITTED' ||
      item.normalizedStatus === 'PENDING' ||
      item.normalizedStatus === 'ACCEPTED' ||
      item.normalizedStatus === 'REJECTED' ||
      item.normalizedStatus === 'FAILED'
        ? item.normalizedStatus
        : undefined,
    status: normalizeOptionalString(item.status),
    transmissionStatus: normalizeOptionalString(item.transmissionStatus),
    acknowledgementStatus: normalizeOptionalString(item.acknowledgementStatus),
    acknowledgementType: normalizeOptionalString(item.acknowledgementType),
    acknowledgementDateTime: normalizeDateString(item.acknowledgementDateTime),
    responseStatusCode: normalizeOptionalNumber(item.responseStatusCode),
    rawResponsePayload: normalizeOptionalString(item.rawResponsePayload),
    rawAcknowledgementPayload: normalizeOptionalString(item.rawAcknowledgementPayload),
    submissionErrorCode: normalizeOptionalString(item.submissionErrorCode),
    submissionErrorMessage: normalizeOptionalString(item.submissionErrorMessage),
    lastError: normalizeOptionalString(item.lastError),
    submittedAt: normalizeDateString(item.submittedAt),
    submittedBy: normalizeOptionalString(item.submittedBy),
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

const claimSubmissionListDataPaths = [claimSubmissionApiDetails.responseDataPath, 'data.data', 'items']
const claimSubmissionListTotalPaths = [
  claimSubmissionApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeClaimSubmissionListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<ClaimSubmission> {
  return normalizeCrudListResponse<unknown, ClaimSubmission>({
    response,
    query,
    dataPaths: claimSubmissionListDataPaths,
    totalPaths: claimSubmissionListTotalPaths,
    mapItem: normalizeClaimSubmission,
  })
}

export const claimSubmissionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClaimSubmissions: builder.query<CrudListResponse<ClaimSubmission>, CrudListQuery>({
      query: (query) => ({
        url: claimSubmissionApiDetails.endpoint,
        method: 'GET',
        params: {
          [claimSubmissionApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeClaimSubmissionListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ClaimSubmission' as const, id: item._id })),
              { type: 'ClaimSubmission' as const, id: 'LIST' },
            ]
          : [{ type: 'ClaimSubmission' as const, id: 'LIST' }],
    }),
    getClaimSubmission: builder.query<ClaimSubmission, EntityId>({
      query: (id) => ({
        url: `${claimSubmissionApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaimSubmission(readResponsePath<unknown>(response, claimSubmissionApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim Submission response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'ClaimSubmission', id }],
    }),
    retryClaimSubmission: builder.mutation<{ claimSubmission: ClaimSubmission }, EntityId>({
      query: (id) => ({
        url: `${claimSubmissionApiDetails.endpoint}/${id}/retry`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const claimSubmission = normalizeClaimSubmission(
          readResponsePath<unknown>(response, 'data.claimSubmission'),
        )

        if (!claimSubmission) {
          throw new Error('Claim submission retry response is invalid.')
        }

        return {
          claimSubmission,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'ClaimSubmission', id },
        { type: 'ClaimSubmission', id: 'LIST' },
        { type: 'ClaimTracking', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    ingestX12Acknowledgement: builder.mutation<{ claimSubmission: ClaimSubmission }, { x12Payload: string; claimControlNumber?: string; submissionTraceId?: string }>({
      query: (payload) => ({
        url: `${claimSubmissionApiDetails.endpoint}/x12-acknowledgements`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const claimSubmission = normalizeClaimSubmission(
          readResponsePath<unknown>(response, 'data.claimSubmission'),
        )

        if (!claimSubmission) {
          throw new Error('X12 acknowledgement response is invalid.')
        }

        return {
          claimSubmission,
        }
      },
      invalidatesTags: (_result, _error, payload) => [
        ...(payload.claimControlNumber ? [{ type: 'ClaimSubmission' as const, id: payload.claimControlNumber }] : []),
        { type: 'ClaimSubmission', id: 'LIST' },
        { type: 'ClaimTracking', id: 'LIST' },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    generateX12Ack: builder.mutation<{
      accepted999Ack: string
      accepted277Ack: string
      rejected277Ack: string
      acceptedAck: string
      rejectedAck: string
    }, { claimId: string; claimSubmissionId: string }>({
      query: (payload) => ({
        url: `${claimSubmissionApiDetails.endpoint}/generate-x12-ack`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<{
          accepted999Ack?: string
          accepted277Ack?: string
          rejected277Ack?: string
          acceptedAck?: string
          rejectedAck?: string
        }>(response, 'data')
        const accepted277Ack = typeof data?.accepted277Ack === 'string' ? data.accepted277Ack : data?.acceptedAck
        const rejected277Ack = typeof data?.rejected277Ack === 'string' ? data.rejected277Ack : data?.rejectedAck
        if (typeof accepted277Ack !== 'string' || typeof rejected277Ack !== 'string') {
          throw new Error('X12 ACK generation response is invalid.')
        }
        return {
          accepted999Ack: typeof data?.accepted999Ack === 'string' ? data.accepted999Ack : '',
          accepted277Ack,
          rejected277Ack,
          acceptedAck: accepted277Ack,
          rejectedAck: rejected277Ack,
        }
      },
    }),
  }),
})

export const {
  useGetClaimSubmissionQuery,
  useGetClaimSubmissionsQuery,
  useIngestX12AcknowledgementMutation,
  useRetryClaimSubmissionMutation,
  useGenerateX12AckMutation,
} = claimSubmissionsApi
