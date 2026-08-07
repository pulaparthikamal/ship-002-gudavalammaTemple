import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { arWorkItemApiDetails } from '@/models/arWorkItemModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ArWorkItem, ArWorkItemCreatePayload, ArWorkItemUpdatePayload } from '@/types/arWorkItem'

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

function normalizeArWorkItem(response: unknown): ArWorkItem | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    arWorkItemId:
      typeof item.arWorkItemId === 'string'
        ? item.arWorkItemId
        : typeof item.arWorkItemId === 'object' && item.arWorkItemId !== null && '_id' in item.arWorkItemId
          ? String((item.arWorkItemId as { _id?: string })._id ?? '')
          : '',
    claimId: normalizeOptionalString(item.claimId),
    claimLineId: normalizeOptionalString(item.claimLineId),
    denialId: normalizeOptionalString(item.denialId),
    appealId: normalizeOptionalString(item.appealId),
    correctedClaimId: normalizeOptionalString(item.correctedClaimId),
    paymentPostingId: normalizeOptionalString(item.paymentPostingId),
    patientId: normalizeOptionalString(item.patientId),
    payerId: normalizeOptionalString(item.payerId),
    category: normalizeOptionalString(item.category),
    balanceAmount: normalizeOptionalNumber(item.balanceAmount),
    expectedAmount: normalizeOptionalNumber(item.expectedAmount),
    paidAmount: normalizeOptionalNumber(item.paidAmount),
    varianceAmount: normalizeOptionalNumber(item.varianceAmount),
    agingBucket: normalizeOptionalString(item.agingBucket),
    denialCode: normalizeOptionalString(item.denialCode),
    denialCategory: normalizeOptionalString(item.denialCategory),
    priority: normalizeOptionalString(item.priority),
    status: normalizeOptionalString(item.status),
    owner: normalizeOptionalString(item.owner),
    followUpDate: normalizeDateString(item.followUpDate),
    dueDate: normalizeDateString(item.dueDate),
    reason: normalizeOptionalString(item.reason),
    nextAction: normalizeOptionalString(item.nextAction),
    notes: normalizeOptionalString(item.notes),
    assignedTo: normalizeOptionalString(item.assignedTo),
    team: normalizeOptionalString(item.team),
    rootCauseAnalysis: normalizeOptionalString(item.rootCauseAnalysis),
    suggestedFix: normalizeOptionalString(item.suggestedFix),
    aiPriorityAnalysis: typeof item.aiPriorityAnalysis === 'object' && item.aiPriorityAnalysis !== null ? item.aiPriorityAnalysis as Record<string, unknown> : undefined,
    aiRecommendationHistory: Array.isArray(item.aiRecommendationHistory) ? item.aiRecommendationHistory.filter((entry): entry is Record<string, unknown> => typeof entry === 'object' && entry !== null) : undefined,
    nextFollowUpDate: normalizeDateString(item.nextFollowUpDate),
    appealRequired: Boolean(item.appealRequired),
    correctedClaimRequired: Boolean(item.correctedClaimRequired),
    escalationFlag: Boolean(item.escalationFlag),
    followUpHistory: Array.isArray(item.followUpHistory)
      ? item.followUpHistory
          .filter((child): child is Record<string, unknown> => typeof child === 'object' && child !== null)
          .map((child) => ({
            followUpDate: normalizeDateString(child.followUpDate),
            followUpType: normalizeOptionalString(child.followUpType),
            notes: normalizeOptionalString(child.notes),
            performedBy: normalizeOptionalString(child.performedBy),
          }))
      : [],
    contactHistory: Array.isArray(item.contactHistory)
      ? item.contactHistory
          .filter((child): child is Record<string, unknown> => typeof child === 'object' && child !== null)
          .map((child) => ({
            contactDate: normalizeDateString(child.contactDate),
            contactType: normalizeOptionalString(child.contactType),
            contactName: normalizeOptionalString(child.contactName),
            outcome: normalizeOptionalString(child.outcome),
            notes: normalizeOptionalString(child.notes),
            performedBy: normalizeOptionalString(child.performedBy),
          }))
      : [],
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

const arWorkItemListDataPaths = [arWorkItemApiDetails.responseDataPath, 'data.data', 'items']
const arWorkItemListTotalPaths = [
  arWorkItemApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeArWorkItemListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<ArWorkItem> {
  return normalizeCrudListResponse<unknown, ArWorkItem>({
    response,
    query,
    dataPaths: arWorkItemListDataPaths,
    totalPaths: arWorkItemListTotalPaths,
    mapItem: normalizeArWorkItem,
  })
}

export const arWorkItemsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getArWorkItems: builder.query<CrudListResponse<ArWorkItem>, CrudListQuery>({
      query: (query) => ({
        url: arWorkItemApiDetails.endpoint,
        method: 'GET',
        params: {
          [arWorkItemApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeArWorkItemListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ArWorkItem' as const, id: item._id })),
              { type: 'ArWorkItem' as const, id: 'LIST' },
            ]
          : [{ type: 'ArWorkItem' as const, id: 'LIST' }],
    }),
    getArWorkItem: builder.query<ArWorkItem, EntityId>({
      query: (id) => ({
        url: `${arWorkItemApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeArWorkItem(readResponsePath<unknown>(response, arWorkItemApiDetails.responseDataPath))

        if (!item) {
          throw new Error('AR Work Item response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'ArWorkItem', id }],
    }),
    createArWorkItem: builder.mutation<ArWorkItem, ArWorkItemCreatePayload>({
      query: (payload) => ({
        url: arWorkItemApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeArWorkItem(readResponsePath<unknown>(response, arWorkItemApiDetails.responseDataPath))

        if (!item) {
          throw new Error('AR Work Item response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'ArWorkItem', id: 'LIST' }],
    }),
    updateArWorkItem: builder.mutation<ArWorkItem, { id: EntityId; data: ArWorkItemUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${arWorkItemApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeArWorkItem(readResponsePath<unknown>(response, arWorkItemApiDetails.responseDataPath))

        if (!item) {
          throw new Error('AR Work Item response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ArWorkItem', id },
        { type: 'ArWorkItem', id: 'LIST' },
      ],
    }),
    deleteArWorkItem: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${arWorkItemApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'ArWorkItem', id },
        { type: 'ArWorkItem', id: 'LIST' },
      ],
    }),
    bulkDeleteArWorkItems: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${arWorkItemApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'ArWorkItem' as const, id })),
        { type: 'ArWorkItem' as const, id: 'LIST' },
      ],
    }),
    generateArWorkItems: builder.mutation<unknown, { pendingResponseDays?: number; appealFollowUpDays?: number; correctedClaimFollowUpDays?: number } | void>({
      query: (payload) => ({
        url: `${arWorkItemApiDetails.endpoint}/generate`,
        method: 'POST',
        data: payload ?? {},
      }),
      invalidatesTags: [{ type: 'ArWorkItem' as const, id: 'LIST' }],
    }),
    changeArWorkItemStatus: builder.mutation<ArWorkItem, { id: EntityId; status: string; owner?: string; notes?: string; nextAction?: string; followUpDate?: Date }>({
      query: ({ id, ...data }) => ({
        url: `${arWorkItemApiDetails.endpoint}/${id}/status`,
        method: 'PATCH',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeArWorkItem(readResponsePath<unknown>(response, arWorkItemApiDetails.responseDataPath))
        if (!item) throw new Error('AR Work Item response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ArWorkItem', id },
        { type: 'ArWorkItem', id: 'LIST' },
      ],
    }),
    prioritizeArWorkItemWithAi: builder.mutation<ArWorkItem, EntityId>({
      query: (id) => ({
        url: `${arWorkItemApiDetails.endpoint}/${id}/ai-prioritize`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeArWorkItem(readResponsePath<unknown>(response, arWorkItemApiDetails.responseDataPath))
        if (!item) throw new Error('AR Work Item response is invalid.')
        return item
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'ArWorkItem', id },
        { type: 'ArWorkItem', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteArWorkItemsMutation,
  useCreateArWorkItemMutation,
  useDeleteArWorkItemMutation,
  useGenerateArWorkItemsMutation,
  useGetArWorkItemQuery,
  useGetArWorkItemsQuery,
  useChangeArWorkItemStatusMutation,
  usePrioritizeArWorkItemWithAiMutation,
  useUpdateArWorkItemMutation,
} = arWorkItemsApi
