import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'

export interface RcmOpsHealth {
  status: string
  environment?: string
  queue?: {
    driver?: string
    workerEnabled?: boolean
    concurrency?: number
    queued?: number
    failed?: number
    deadLetter?: number
    running?: number
    stale?: number
    recovered?: number
    worker?: {
      running?: boolean
      processing?: boolean
      lastRunAt?: string
      lastError?: string
      intervalMs?: number
    }
  }
  warnings?: string[]
  integrations?: Record<string, unknown>
  metrics?: {
    webhookCounts?: Record<string, number>
    submissionCounts?: Record<string, number>
    eraCounts?: Record<string, number>
    latestFailedJob?: {
      id?: string
      jobType?: string
      status?: string
      lastError?: string
      updated?: string
    } | null
    latestWebhookEvent?: {
      id?: string
      eventType?: string
      processingStatus?: string
      receivedAt?: string
      updated?: string
    } | null
    pendingAcknowledgements?: number
    acceptedClaimsAwaitingEra?: number
    eraExceptions?: number
    eraExceptionWorkbenchOpen?: number
    postingImbalances?: number
    staleQueueJobs?: number
    recoveredQueueJobs?: number
  }
}

export const rcmOpsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRcmOpsHealth: builder.query<RcmOpsHealth, void>({
      query: () => ({
        url: '/rcm/ops/health',
        method: 'GET',
      }),
      transformResponse: (response: unknown) => readResponsePath<RcmOpsHealth>(response, 'data'),
      providesTags: [{ type: 'Metric', id: 'RCM_OPS' }],
    }),
  }),
})

export const { useGetRcmOpsHealthQuery } = rcmOpsApi
