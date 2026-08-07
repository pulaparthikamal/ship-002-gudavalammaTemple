import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { procedureCodeApiDetails } from '@/models/procedureCodeModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ProcedureCode, ProcedureCodeCreatePayload, ProcedureCodeUpdatePayload } from '@/types/procedureCode'

function normalizeProcedureCode(response: unknown): ProcedureCode | null {
  if (typeof response !== 'object' || response === null) return null
  const item = response as any
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    procedureCodeId: item.procedureCodeId,
    code: item.code,
    description: item.description,
    chargeFee: item.chargeFee,
    category: item.category,
    requiresAuth: item.requiresAuth,
    frequencyLimit: item.frequencyLimit,
    active: item.active,
    isDeleted: item.isDeleted,
    created: item.created,
    updated: item.updated,
  }
}

export const procedureCodesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getProcedureCodes: builder.query<CrudListResponse<ProcedureCode>, CrudListQuery>({
      query: (query) => ({
        url: procedureCodeApiDetails.endpoint,
        method: 'GET',
        params: query,
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse({
          response,
          query,
          dataPaths: [procedureCodeApiDetails.responseDataPath],
          totalPaths: [procedureCodeApiDetails.responseTotalPath],
          mapItem: normalizeProcedureCode,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ProcedureCode' as const, id: item._id })),
              { type: 'ProcedureCode' as const, id: 'LIST' },
            ]
          : [{ type: 'ProcedureCode' as const, id: 'LIST' }],
    }),
    getProcedureCode: builder.query<ProcedureCode, EntityId>({
      query: (id) => ({
        url: `${procedureCodeApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        normalizeProcedureCode(readResponsePath(response, procedureCodeApiDetails.responseDataPath))!,
      providesTags: (_result, _error, id) => [{ type: 'ProcedureCode', id }],
    }),
    createProcedureCode: builder.mutation<ProcedureCode, ProcedureCodeCreatePayload>({
      query: (payload) => ({
        url: procedureCodeApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      invalidatesTags: [{ type: 'ProcedureCode', id: 'LIST' }],
    }),
    updateProcedureCode: builder.mutation<ProcedureCode, { id: EntityId; data: ProcedureCodeUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${procedureCodeApiDetails.endpoint}/${id}`,
        method: 'PATCH',
        data,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ProcedureCode', id },
        { type: 'ProcedureCode', id: 'LIST' },
      ],
    }),
    deleteProcedureCode: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${procedureCodeApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, id) => [
        { type: 'ProcedureCode', id },
        { type: 'ProcedureCode', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useCreateProcedureCodeMutation,
  useDeleteProcedureCodeMutation,
  useGetProcedureCodeQuery,
  useGetProcedureCodesQuery,
  useUpdateProcedureCodeMutation,
} = procedureCodesApi
