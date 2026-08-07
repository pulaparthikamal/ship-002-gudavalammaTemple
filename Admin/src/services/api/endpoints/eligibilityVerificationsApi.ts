import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { eligibilityVerificationApiDetails } from '@/models/eligibilityVerificationModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  EligibilityVerification,
  EligibilityVerificationCreatePayload,
  EligibilityVerificationRunPayload,
  EligibilityVerificationUpdatePayload,
} from '@/types/eligibilityVerification'

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

function normalizeOptionalRecord(value: unknown) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined
}

export function normalizeEligibilityVerification(response: unknown): EligibilityVerification | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    eligibilityId:
      typeof item.eligibilityId === 'string'
        ? item.eligibilityId
        : typeof item.eligibilityId === 'object' && item.eligibilityId !== null && '_id' in item.eligibilityId
          ? String((item.eligibilityId as { _id?: string })._id ?? '')
          : '',
    appointmentId: normalizeOptionalString(item.appointmentId),
    patientId: normalizeOptionalString(item.patientId),
    insuranceId: normalizeOptionalString(item.insuranceId),
    payerId: normalizeOptionalString(item.payerId),
    serviceTypeCode: normalizeOptionalString(item.serviceTypeCode),
    serviceDate: normalizeDateString(item.serviceDate),
    coveragePriority: normalizeOptionalString(item.coveragePriority),
    procedureCodes: normalizeStringArray(item.procedureCodes),
    correlationId: normalizeOptionalString(item.correlationId),
    externalVerificationId: normalizeOptionalString(item.externalVerificationId),
    vendorName: normalizeOptionalString(item.vendorName),
    eligibilityStatus: normalizeString(item.eligibilityStatus),
    coverageStatus: normalizeOptionalString(item.coverageStatus),
    planActive: Boolean(item.planActive),
    copayAmount: normalizeOptionalNumber(item.copayAmount),
    coinsurancePercent: normalizeOptionalNumber(item.coinsurancePercent),
    deductibleRemaining: normalizeOptionalNumber(item.deductibleRemaining),
    outOfPocketRemaining: normalizeOptionalNumber(item.outOfPocketRemaining),
    referralRequired: Boolean(item.referralRequired),
    authorizationRequired: Boolean(item.authorizationRequired),
    benefitNotes: normalizeOptionalString(item.benefitNotes),
    checkedBy: normalizeOptionalString(item.checkedBy),
    checkedAt: normalizeDateString(item.checkedAt),
    verificationSource: normalizeOptionalString(item.verificationSource),
    rawResponseReference: normalizeOptionalString(item.rawResponseReference),
    responseStatusCode: normalizeOptionalNumber(item.responseStatusCode),
    rawRequestPayload: normalizeOptionalRecord(item.rawRequestPayload),
    rawResponsePayload: normalizeOptionalRecord(item.rawResponsePayload),
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

const eligibilityVerificationListDataPaths = [eligibilityVerificationApiDetails.responseDataPath, 'data.data', 'items']
const eligibilityVerificationListTotalPaths = [
  eligibilityVerificationApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeEligibilityVerificationListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<EligibilityVerification> {
  return normalizeCrudListResponse<unknown, EligibilityVerification>({
    response,
    query,
    dataPaths: eligibilityVerificationListDataPaths,
    totalPaths: eligibilityVerificationListTotalPaths,
    mapItem: normalizeEligibilityVerification,
  })
}

export const eligibilityVerificationsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getEligibilityVerifications: builder.query<CrudListResponse<EligibilityVerification>, CrudListQuery>({
      query: (query) => ({
        url: eligibilityVerificationApiDetails.endpoint,
        method: 'GET',
        params: {
          [eligibilityVerificationApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeEligibilityVerificationListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'EligibilityVerification' as const, id: item._id })),
              { type: 'EligibilityVerification' as const, id: 'LIST' },
            ]
          : [{ type: 'EligibilityVerification' as const, id: 'LIST' }],
    }),
    getEligibilityVerification: builder.query<EligibilityVerification, EntityId>({
      query: (id) => ({
        url: `${eligibilityVerificationApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEligibilityVerification(readResponsePath<unknown>(response, eligibilityVerificationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Eligibility Verification response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'EligibilityVerification', id }],
    }),
    createEligibilityVerification: builder.mutation<EligibilityVerification, EligibilityVerificationCreatePayload>({
      query: (payload) => ({
        url: eligibilityVerificationApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEligibilityVerification(readResponsePath<unknown>(response, eligibilityVerificationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Eligibility Verification response is invalid.')
        }

        return item
      },
      invalidatesTags: [
        { type: 'EligibilityVerification', id: 'LIST' },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
    updateEligibilityVerification: builder.mutation<EligibilityVerification, { id: EntityId; data: EligibilityVerificationUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${eligibilityVerificationApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEligibilityVerification(readResponsePath<unknown>(response, eligibilityVerificationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Eligibility Verification response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'EligibilityVerification', id },
        { type: 'EligibilityVerification', id: 'LIST' },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
    runEligibilityVerification: builder.mutation<EligibilityVerification, EligibilityVerificationRunPayload>({
      query: (payload) => ({
        url: eligibilityVerificationApiDetails.runEndpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeEligibilityVerification(readResponsePath<unknown>(response, eligibilityVerificationApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Eligibility Verification response is invalid.')
        }

        return item
      },
      invalidatesTags: [
        { type: 'EligibilityVerification', id: 'LIST' },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useCreateEligibilityVerificationMutation,
  useGetEligibilityVerificationQuery,
  useGetEligibilityVerificationsQuery,
  useRunEligibilityVerificationMutation,
  useUpdateEligibilityVerificationMutation,
} = eligibilityVerificationsApi
