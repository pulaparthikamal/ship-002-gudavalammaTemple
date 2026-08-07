import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  CoverageRule,
  CoverageRuleCreatePayload,
  CoverageRuleEvaluationPayload,
  CoverageRuleEvaluationResult,
  CoverageRuleUpdatePayload,
} from '@/types/coverageRule'

const coverageRuleApiDetails = {
  endpoint: 'rcm/coverage-rules',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
}

function normalizeCoverageRule(response: unknown): CoverageRule | null {
  if (typeof response !== 'object' || response === null) return null
  const item = response as any
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    coverageRuleId: item.coverageRuleId,
    payerId: item.payerId,
    planName: item.planName,
    groupNumber: item.groupNumber,
    state: item.state,
    facilityId: item.facilityId,
    providerId: item.providerId,
    cptCode: item.cptCode,
    diagnosisCodes: Array.isArray(item.diagnosisCodes) ? item.diagnosisCodes : [],
    placeOfServiceCode: item.placeOfServiceCode,
    network: item.network,
    coverageType: item.coverageType,
    ruleType: item.ruleType,
    ruleValue: item.ruleValue,
    effectiveDate: item.effectiveDate,
    expiryDate: item.expiryDate,
    priority: item.priority,
    activeFlag: item.activeFlag,
    active: item.active,
    createdAt: item.createdAt || item.created,
    updatedAt: item.updatedAt || item.updated,
  }
}

export const coverageRulesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getCoverageRules: builder.query<CrudListResponse<CoverageRule>, CrudListQuery>({
      query: (query) => ({
        url: coverageRuleApiDetails.endpoint,
        method: 'GET',
        params: query,
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse({
          response,
          query,
          dataPaths: [coverageRuleApiDetails.responseDataPath],
          totalPaths: [coverageRuleApiDetails.responseTotalPath],
          mapItem: normalizeCoverageRule,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Rule' as const, id: item._id })),
              { type: 'Rule' as const, id: 'COVERAGE_RULE_LIST' },
            ]
          : [{ type: 'Rule' as const, id: 'COVERAGE_RULE_LIST' }],
    }),
    createCoverageRule: builder.mutation<CoverageRule, CoverageRuleCreatePayload>({
      query: (payload) => ({
        url: coverageRuleApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: [{ type: 'Rule', id: 'COVERAGE_RULE_LIST' }],
    }),
    updateCoverageRule: builder.mutation<CoverageRule, { id: EntityId; data: CoverageRuleUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${coverageRuleApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Rule', id },
        { type: 'Rule', id: 'COVERAGE_RULE_LIST' },
      ],
    }),
    deleteCoverageRule: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${coverageRuleApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'Rule', id },
        { type: 'Rule', id: 'COVERAGE_RULE_LIST' },
      ],
    }),
    evaluateCoverageRules: builder.mutation<CoverageRuleEvaluationResult, CoverageRuleEvaluationPayload>({
      query: (payload) => ({
        url: `${coverageRuleApiDetails.endpoint}/evaluate`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<CoverageRuleEvaluationResult>(response, coverageRuleApiDetails.responseDataPath),
    }),
  }),
})

export const {
  useCreateCoverageRuleMutation,
  useDeleteCoverageRuleMutation,
  useEvaluateCoverageRulesMutation,
  useGetCoverageRulesQuery,
  useUpdateCoverageRuleMutation,
} = coverageRulesApi
