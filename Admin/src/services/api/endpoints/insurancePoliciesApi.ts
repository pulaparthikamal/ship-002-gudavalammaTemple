import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { insurancePolicyApiDetails } from '@/models/insurancePolicyModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { InsurancePolicy, InsurancePolicyCreatePayload, InsurancePolicyUpdatePayload } from '@/types/insurancePolicy'

export function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeIdString(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const objectId = (value as { _id?: unknown })._id
    return typeof objectId === 'string' ? objectId : undefined
  }

  return undefined
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

function normalizePayerReference(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null) {
    const payer = value as Record<string, unknown>
    return normalizeOptionalString(payer.payerId) ?? normalizeIdString(payer._id)
  }

  return undefined
}

function normalizeAttachmentLinks(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
        .map((item) => ({
          documentType: normalizeOptionalString(item.documentType),
          title: normalizeOptionalString(item.title),
          fileUrl: normalizeOptionalString(item.fileUrl),
          description: normalizeOptionalString(item.description),
        }))
    : []
}

function normalizeInsurancePolicy(response: unknown): InsurancePolicy | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>
  const itemId = normalizeIdString(item._id)

  if (!itemId) {
    return null
  }

  const subscriber = typeof item.subscriber === 'object' && item.subscriber !== null ? (item.subscriber as Record<string, unknown>) : {}
  const card = typeof item.card === 'object' && item.card !== null ? (item.card as Record<string, unknown>) : {}
  const verification = typeof item.verification === 'object' && item.verification !== null ? (item.verification as Record<string, unknown>) : {}
  const dependentValidation = typeof item.dependentValidation === 'object' && item.dependentValidation !== null ? (item.dependentValidation as Record<string, unknown>) : {}

  return {
    _id: itemId,
    insuranceId: normalizeIdString(item.insuranceId) ?? itemId,
    patientId: normalizeIdString(item.patientId),
    payerId: normalizePayerReference(item.payerId),
    ediPayerId: normalizeOptionalString(item.ediPayerId),
    payerType: normalizeOptionalString(item.payerType),
    coverageType: normalizeOptionalString(item.coverageType),
    planName: normalizeString(item.planName),
    memberId: normalizeOptionalString(item.memberId),
    subscriberId: normalizeOptionalString(item.subscriberId),
    groupNumber: normalizeOptionalString(item.groupNumber),
    dependentNumber: normalizeOptionalString(item.dependentNumber),
    coveragePriority: normalizeOptionalString(item.coveragePriority),
    coordinationOfBenefitsOrder: normalizeOptionalNumber(item.coordinationOfBenefitsOrder),
    network: normalizeOptionalString(item.network),
    effectiveDate: normalizeDateString(item.effectiveDate),
    terminationDate: normalizeDateString(item.terminationDate),
    policyStatus: normalizeOptionalString(item.policyStatus),
    relationshipToSubscriber: normalizeOptionalString(item.relationshipToSubscriber),
    insuranceVerifiedFlag: Boolean(item.insuranceVerifiedFlag),
    subscriber: {
      firstName: normalizeOptionalString(subscriber.firstName),
      lastName: normalizeOptionalString(subscriber.lastName),
      dob: normalizeDateString(subscriber.dob),
      gender: normalizeOptionalString(subscriber.gender),
      phone: normalizeOptionalString(subscriber.phone),
      email: normalizeOptionalString(subscriber.email),
      addressLine1: normalizeOptionalString(subscriber.addressLine1),
      addressLine2: normalizeOptionalString(subscriber.addressLine2),
      city: normalizeOptionalString(subscriber.city),
      state: normalizeOptionalString(subscriber.state),
      zipCode: normalizeOptionalString(subscriber.zipCode),
    },
    card: {
      frontImageUrl: normalizeOptionalString(card.frontImageUrl),
      backImageUrl: normalizeOptionalString(card.backImageUrl),
    },
    verification: {
      lastVerifiedDateTime: normalizeDateString(verification.lastVerifiedDateTime),
      nextVerificationDueDate: normalizeDateString(verification.nextVerificationDueDate),
    },
    dependentValidation: {
      status: normalizeOptionalString(dependentValidation.status),
      riskScore: normalizeOptionalNumber(dependentValidation.riskScore),
      issues: normalizeStringArray(dependentValidation.issues),
      suggestedFixes: normalizeStringArray(dependentValidation.suggestedFixes),
      source: normalizeOptionalString(dependentValidation.source),
      checkedAt: normalizeDateString(dependentValidation.checkedAt),
    },
    attachments: normalizeAttachmentLinks(item.attachments),
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

const insurancePolicyListDataPaths = [insurancePolicyApiDetails.responseDataPath, 'data.data', 'items']
const insurancePolicyListTotalPaths = [
  insurancePolicyApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeInsurancePolicyListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<InsurancePolicy> {
  return normalizeCrudListResponse<unknown, InsurancePolicy>({
    response,
    query,
    dataPaths: insurancePolicyListDataPaths,
    totalPaths: insurancePolicyListTotalPaths,
    mapItem: normalizeInsurancePolicy,
  })
}

export const insurancePoliciesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getInsurancePolicies: builder.query<CrudListResponse<InsurancePolicy>, CrudListQuery>({
      query: (query) => ({
        url: insurancePolicyApiDetails.endpoint,
        method: 'GET',
        params: {
          [insurancePolicyApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeInsurancePolicyListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'InsurancePolicy' as const, id: item._id })),
              { type: 'InsurancePolicy' as const, id: 'LIST' },
            ]
          : [{ type: 'InsurancePolicy' as const, id: 'LIST' }],
    }),
    getInsurancePolicy: builder.query<InsurancePolicy, EntityId>({
      query: (id) => ({
        url: `${insurancePolicyApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeInsurancePolicy(readResponsePath<unknown>(response, insurancePolicyApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Insurance Policy response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'InsurancePolicy', id }],
    }),
    createInsurancePolicy: builder.mutation<InsurancePolicy, InsurancePolicyCreatePayload>({
      query: (payload) => ({
        url: insurancePolicyApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeInsurancePolicy(readResponsePath<unknown>(response, insurancePolicyApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Insurance Policy response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'InsurancePolicy', id: 'LIST' }],
    }),
    updateInsurancePolicy: builder.mutation<InsurancePolicy, { id: EntityId; data: InsurancePolicyUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${insurancePolicyApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeInsurancePolicy(readResponsePath<unknown>(response, insurancePolicyApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Insurance Policy response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'InsurancePolicy', id },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
    deleteInsurancePolicy: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${insurancePolicyApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'InsurancePolicy', id },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
    bulkDeleteInsurancePolicies: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${insurancePolicyApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'InsurancePolicy' as const, id })),
        { type: 'InsurancePolicy' as const, id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteInsurancePoliciesMutation,
  useCreateInsurancePolicyMutation,
  useDeleteInsurancePolicyMutation,
  useGetInsurancePolicyQuery,
  useGetInsurancePoliciesQuery,
  useUpdateInsurancePolicyMutation,
} = insurancePoliciesApi
