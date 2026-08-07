import { apiSlice } from '@/services/api/apiSlice'
import { readResponsePath } from '@/services/api/responseTransform'
import type { Ai835Payload } from '@/types/ai835Payload'

const AI835_PAYLOAD_BASE = '/rcm/ai-835-payloads'

function normalizeAi835Payload(data: unknown): Ai835Payload | null {
  if (typeof data !== 'object' || data === null) return null
  const item = data as Record<string, unknown>
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    claimId: typeof item.claimId === 'string' ? item.claimId : String(item.claimId ?? ''),
    claimSubmissionId: typeof item.claimSubmissionId === 'string' ? item.claimSubmissionId : String(item.claimSubmissionId ?? ''),
    eraEobProcessingId: typeof item.eraEobProcessingId === 'string' ? item.eraEobProcessingId : undefined,
    fullPayment835: typeof item.fullPayment835 === 'string' ? item.fullPayment835 : '',
    denialPayment835: typeof item.denialPayment835 === 'string' ? item.denialPayment835 : '',
    denialCorrection835: typeof item.denialCorrection835 === 'string' ? item.denialCorrection835 : '',
    generatedAt: typeof item.generatedAt === 'string' ? item.generatedAt : new Date().toISOString(),
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : undefined,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
  }
}

export const ai835PayloadApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Load stored AI 835 payloads from the dedicated collection.
     * Returns null if nothing has been generated yet for this claimSubmissionId.
     */
    getAi835ByClaimSubmission: builder.query<Ai835Payload | null, string>({
      query: (claimSubmissionId) => ({
        url: `${AI835_PAYLOAD_BASE}/by-claim-submission/${claimSubmissionId}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<unknown>(response, 'data')
        if (data === null || data === undefined) return null
        return normalizeAi835Payload(data)
      },
      providesTags: (_result, _error, claimSubmissionId) => [
        { type: 'Ai835Payload' as const, id: claimSubmissionId },
      ],
    }),

    /**
     * Generate (or regenerate) AI 835 payloads and persist to the dedicated collection.
     * Calling this again will upsert (overwrite) the existing record.
     */
    generateAi835Payload: builder.mutation<
      Ai835Payload,
      { claimId: string; claimSubmissionId: string; eraEobProcessingId?: string }
    >({
      query: (payload) => ({
        url: `${AI835_PAYLOAD_BASE}/generate`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<unknown>(response, 'data')
        const normalized = normalizeAi835Payload(data)
        if (!normalized) throw new Error('AI 835 payload response is invalid.')
        return normalized
      },
      invalidatesTags: (_result, _error, { claimSubmissionId }) => [
        { type: 'Ai835Payload' as const, id: claimSubmissionId },
      ],
    }),
  }),
})

export const {
  useGetAi835ByClaimSubmissionQuery,
  useGenerateAi835PayloadMutation,
} = ai835PayloadApi
