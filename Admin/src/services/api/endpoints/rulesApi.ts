import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { ruleApiDetails } from '@/models/ruleModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { Rule, RuleCreatePayload, RuleUpdatePayload } from '@/types/rule'

function normalizeRule(response: unknown): Rule | null {
  if (typeof response !== 'object' || response === null) return null
  const item = response as any
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    ruleId: item.ruleId,
    type: item.type,
    message: item.message,
    severity: item.severity,
    payerId: item.payerId,
    providerId: item.providerId,
    facilityId: item.facilityId,
    state: item.state,
    placeOfServiceCode: item.placeOfServiceCode,
    planName: item.planName,
    groupNumber: item.groupNumber,
    network: item.network,
    coverageType: item.coverageType,
    codes: item.codes,
    code: item.code,
    limit: item.limit,
    requiredFields: item.requiredFields,
    effectiveDate: item.effectiveDate,
    expiryDate: item.expiryDate,
    active: item.active,
    isDeleted: item.isDeleted,
    created: item.created,
    updated: item.updated,
  }
}

export const rulesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getRules: builder.query<CrudListResponse<Rule>, CrudListQuery>({
      query: (query) => ({
        url: ruleApiDetails.endpoint,
        method: 'GET',
        params: query,
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse({
          response,
          query,
          dataPaths: [ruleApiDetails.responseDataPath],
          totalPaths: [ruleApiDetails.responseTotalPath],
          mapItem: normalizeRule,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Rule' as const, id: item._id })),
              { type: 'Rule' as const, id: 'LIST' },
            ]
          : [{ type: 'Rule' as const, id: 'LIST' }],
    }),
    getRule: builder.query<Rule, EntityId>({
      query: (id) => ({
        url: `${ruleApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        normalizeRule(readResponsePath(response, ruleApiDetails.responseDataPath))!,
      providesTags: (_result, _error, id) => [{ type: 'Rule', id }],
    }),
    createRule: builder.mutation<Rule, RuleCreatePayload>({
      query: (payload) => ({
        url: ruleApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: [{ type: 'Rule', id: 'LIST' }],
    }),
    updateRule: builder.mutation<Rule, { id: EntityId; data: RuleUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${ruleApiDetails.endpoint}/${id}`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Rule', id },
        { type: 'Rule', id: 'LIST' },
      ],
    }),
    deleteRule: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${ruleApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Rule', id },
        { type: 'Rule', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useCreateRuleMutation,
  useDeleteRuleMutation,
  useGetRuleQuery,
  useGetRulesQuery,
  useUpdateRuleMutation,
} = rulesApi
