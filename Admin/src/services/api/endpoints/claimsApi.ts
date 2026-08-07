import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { claimApiDetails } from '@/models/claimModel'
import { normalizeClaimSubmission } from '@/services/api/endpoints/claimSubmissionsApi'
import { normalizeEligibilityVerification } from '@/services/api/endpoints/eligibilityVerificationsApi'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  Claim,
  ClaimAiReadinessReviewResult,
  ClaimCreatePayload,
  ClaimClosureResult,
  ClaimDenialPredictionPayload,
  ClaimDenialPredictionResult,
  ClaimLinkAuthorizationResult,
  ClaimLinkReferralResult,
  ClaimReadinessResult,
  ClaimRejection,
  ClaimRejectionAiAnalysisResult,
  ClaimRefreshPricingResult,
  ClaimResubmitResult,
  ClaimRunEligibilityResult,
  ClaimStatusResult,
  ClaimUpdatePayload,
} from '@/types/claim'
import type { ClaimSubmitResult } from '@/types/rcmWorkflow'

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

function normalizeDenialPrediction(response: unknown): ClaimDenialPredictionResult {
  const item = typeof response === 'object' && response !== null ? response as Record<string, unknown> : {}

  return {
    denialProbability: typeof item.denialProbability === 'number' ? item.denialProbability : 0,
    riskScore: typeof item.riskScore === 'number' ? item.riskScore : 0,
    riskLevel: item.riskLevel === 'High' || item.riskLevel === 'Medium' || item.riskLevel === 'Low' ? item.riskLevel : 'Low',
    predictedDenialReasons: normalizeStringArray(item.predictedDenialReasons),
    recommendations: normalizeStringArray(item.recommendations),
    confidenceLevel: typeof item.confidenceLevel === 'number' ? item.confidenceLevel : 0,
    summary: normalizeString(item.summary),
  }
}

export function normalizeClaim(response: unknown): Claim | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }


  return {
    _id: item._id,
    claimId:
      typeof item.claimId === 'string'
        ? item.claimId
        : typeof item.claimId === 'object' && item.claimId !== null && '_id' in item.claimId
          ? String((item.claimId as { _id?: string })._id ?? '')
          : '',
    chargeId: normalizeOptionalString(item.chargeId),
    encounterId: normalizeOptionalString(item.encounterId),
    patientId: normalizeOptionalString(item.patientId),
    payerId: normalizeOptionalString(item.payerId),
    billingProviderId: normalizeOptionalString(item.billingProviderId),
    renderingProviderId: normalizeOptionalString(item.renderingProviderId),
    facilityId: normalizeOptionalString(item.facilityId),
    claimDate: normalizeDateString(item.claimDate),
    totalChargeAmount: normalizeOptionalNumber(item.totalChargeAmount),
    coveragePriority: normalizeOptionalString(item.coveragePriority),
    frequencyCode: normalizeOptionalString(item.frequencyCode),
    claimType: normalizeOptionalString(item.claimType),
    claimStatus: normalizeOptionalString(item.claimStatus),
    scrubStatus: normalizeOptionalString(item.scrubStatus),
    submissionStatus: normalizeOptionalString(item.submissionStatus),
    paymentStatus: normalizeOptionalString(item.paymentStatus) as Claim['paymentStatus'],
    closureStatus: normalizeOptionalString(item.closureStatus) as Claim['closureStatus'],
    closeReason: normalizeOptionalString(item.closeReason),
    closedBy: normalizeOptionalString(item.closedBy),
    closedAt: normalizeDateString(item.closedAt),
    reopenReason: normalizeOptionalString(item.reopenReason),
    reopenedBy: normalizeOptionalString(item.reopenedBy),
    reopenedAt: normalizeDateString(item.reopenedAt),
    expectedEraBy: normalizeDateString(item.expectedEraBy),
    lastPayerFollowUpAt: normalizeDateString(item.lastPayerFollowUpAt),
    followUpCount: normalizeOptionalNumber(item.followUpCount),
    financialBalanceSnapshot: typeof item.financialBalanceSnapshot === 'object' && item.financialBalanceSnapshot !== null ? item.financialBalanceSnapshot as Record<string, unknown> : undefined,
    diagnosisCodes: normalizeStringArray(item.diagnosisCodes),
    rejectionReason: normalizeOptionalString(item.rejectionReason),
    originalClaimId: normalizeOptionalString(item.originalClaimId),
    correctedFromClaimId: normalizeOptionalString(item.correctedFromClaimId),
    sourceDenialId: normalizeOptionalString(item.sourceDenialId),
    correctedClaimRecordId: normalizeOptionalString(item.correctedClaimRecordId),
    correctionType: normalizeOptionalString(item.correctionType),
    lineageChain: normalizeStringArray(item.lineageChain),
    parentClaimId: normalizeOptionalString(item.parentClaimId),
    version: normalizeOptionalNumber(item.version),
    resubmissionCount: normalizeOptionalNumber(item.resubmissionCount),
    correctedClaimIndicator: Boolean(item.correctedClaimIndicator),
    batchId: normalizeOptionalString(item.batchId),
    clearingHouse: normalizeOptionalString(item.clearingHouse),
    ediStatus: normalizeOptionalString(item.ediStatus),
    snapshotStatus: normalizeOptionalString(item.snapshotStatus),
    snapshotIssues: normalizeStringArray(item.snapshotIssues),
    sourceChargeUpdatedAt: normalizeDateString(item.sourceChargeUpdatedAt),
    sourceCodingReviewUpdatedAt: normalizeDateString(item.sourceCodingReviewUpdatedAt),
    sourceCodingSnapshotHash: normalizeOptionalString(item.sourceCodingSnapshotHash),
    claimLines: Array.isArray(item.claimLines)
      ? item.claimLines
          .filter((child): child is Record<string, unknown> => typeof child === 'object' && child !== null)
          .map((child) => ({
            _id: normalizeOptionalString(child._id),
            lineNumber: normalizeOptionalNumber(child.lineNumber),
            chargeLineId: normalizeOptionalString(child.chargeLineId),
            cptCode: normalizeOptionalString(child.cptCode),
            modifiers: normalizeStringArray(child.modifiers),
            icdPointers: normalizeNumberArray(child.icdPointers),
            units: normalizeOptionalNumber(child.units),
            chargeAmount: normalizeOptionalNumber(child.chargeAmount),
            renderingProviderId: normalizeOptionalString(child.renderingProviderId),
            placeOfService: normalizeOptionalString(child.placeOfService),
            serviceDateFrom: normalizeDateString(child.serviceDateFrom),
            serviceDateTo: normalizeDateString(child.serviceDateTo),
            expectedAllowedAmount: normalizeOptionalNumber(child.expectedAllowedAmount),
            expectedInsurancePayment: normalizeOptionalNumber(child.expectedInsurancePayment),
            expectedPatientResponsibility: normalizeOptionalNumber(child.expectedPatientResponsibility),
            patientCopayAmount: normalizeOptionalNumber(child.patientCopayAmount),
            patientCoinsuranceAmount: normalizeOptionalNumber(child.patientCoinsuranceAmount),
            deductibleAppliedAmount: normalizeOptionalNumber(child.deductibleAppliedAmount),
            feeScheduleId: normalizeOptionalString(child.feeScheduleId),
            pricingMatchedBy: normalizeOptionalString(child.pricingMatchedBy),
            pricingSource: normalizeOptionalString(child.pricingSource),
            pricingSnapshotDate: normalizeDateString(child.pricingSnapshotDate),
            coverageRuleSnapshot: typeof child.coverageRuleSnapshot === 'object' && child.coverageRuleSnapshot !== null ? child.coverageRuleSnapshot as Record<string, unknown> : undefined,
            payerRuleSnapshot: typeof child.payerRuleSnapshot === 'object' && child.payerRuleSnapshot !== null ? child.payerRuleSnapshot as Record<string, unknown> : undefined,
            eligibilityVerificationId: normalizeOptionalString(child.eligibilityVerificationId),
            priorAuthorizationId: normalizeOptionalString(child.priorAuthorizationId),
            referralId: normalizeOptionalString(child.referralId),
            authorizationRequired: typeof child.authorizationRequired === 'boolean' ? child.authorizationRequired : undefined,
            referralRequired: typeof child.referralRequired === 'boolean' ? child.referralRequired : undefined,
            networkStatus: normalizeOptionalString(child.networkStatus),
          }))
      : [],
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

function normalizeClaimRejection(response: unknown): ClaimRejection | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    claimId: normalizeOptionalString(item.claimId),
    claimSubmissionId: normalizeOptionalString(item.claimSubmissionId),
    rejectionCode: normalizeOptionalString(item.rejectionCode),
    rejectionReason: normalizeOptionalString(item.rejectionReason),
    payerResponse: typeof item.payerResponse === 'object' && item.payerResponse !== null ? item.payerResponse as Record<string, unknown> : undefined,
    category: normalizeOptionalString(item.category),
    status: normalizeOptionalString(item.status),
    resolvedAt: normalizeDateString(item.resolvedAt),
    resubmittedClaimId: normalizeOptionalString(item.resubmittedClaimId),
    correctedFields: normalizeStringArray(item.correctedFields),
    aiSuggestion: typeof item.aiSuggestion === 'object' && item.aiSuggestion !== null
      ? normalizeClaimRejectionAiAnalysis(item.aiSuggestion)
      : undefined,
    createdAt: normalizeDateString(item.createdAt) ?? normalizeDateString(item.created) ?? new Date().toISOString(),
    updatedAt: normalizeDateString(item.updatedAt) ?? normalizeDateString(item.updated) ?? new Date().toISOString(),
  }
}

function normalizeClaimRejectionAiAnalysis(response: unknown): ClaimRejectionAiAnalysisResult {
  const item = typeof response === 'object' && response !== null ? response as Record<string, unknown> : {}

  return {
    rootCause: normalizeString(item.rootCause),
    suggestion: normalizeString(item.suggestion),
    confidence: typeof item.confidence === 'number' ? item.confidence : 0,
    rejectionId: normalizeOptionalString(item.rejectionId),
  }
}

const claimListDataPaths = [claimApiDetails.responseDataPath, 'data.data', 'items']
const claimListTotalPaths = [
  claimApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeClaimListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Claim> {
  return normalizeCrudListResponse<unknown, Claim>({
    response,
    query,
    dataPaths: claimListDataPaths,
    totalPaths: claimListTotalPaths,
    mapItem: normalizeClaim,
  })
}

export const claimsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClaims: builder.query<CrudListResponse<Claim>, CrudListQuery>({
      query: (query) => ({
        url: claimApiDetails.endpoint,
        method: 'GET',
        params: {
          [claimApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeClaimListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Claim' as const, id: item._id })),
              { type: 'Claim' as const, id: 'LIST' },
            ]
          : [{ type: 'Claim' as const, id: 'LIST' }],
    }),
    getClaim: builder.query<Claim, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaim(readResponsePath<unknown>(response, claimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Claim', id }],
    }),
    getRejectedClaims: builder.query<CrudListResponse<Claim>, void>({
      query: () => ({
        url: `${claimApiDetails.endpoint}/rejected`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => normalizeClaimListResponse(response, {
        page: 1,
        limit: 100,
        sortfield: 'updated',
        direction: 'desc',
        criteria: [],
      }),
      providesTags: [{ type: 'Claim', id: 'REJECTED' }],
    }),
    getClaimRejections: builder.query<ClaimRejection[], EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/rejections`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<unknown>(response, claimApiDetails.responseDataPath)
        return Array.isArray(data)
          ? data.map(normalizeClaimRejection).filter((item): item is ClaimRejection => Boolean(item))
          : []
      },
      providesTags: (_result, _error, id) => [{ type: 'Claim', id }],
    }),
    createClaim: builder.mutation<Claim, ClaimCreatePayload>({
      query: (payload) => ({
        url: claimApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaim(readResponsePath<unknown>(response, claimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Claim', id: 'LIST' }],
    }),
    updateClaim: builder.mutation<Claim, { id: EntityId; data: ClaimUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${claimApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaim(readResponsePath<unknown>(response, claimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    deleteClaim: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
        { type: 'Claim', id: 'REJECTED' },
      ],
    }),
    bulkDeleteClaims: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${claimApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Claim' as const, id })),
        { type: 'Claim' as const, id: 'LIST' },
      ],
    }),
    createClaimFromCharge: builder.mutation<Claim, EntityId>({
      query: (chargeId) => ({
        url: `${claimApiDetails.endpoint}/from-charge/${chargeId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeClaim(readResponsePath<unknown>(response, claimApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Claim response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Claim', id: 'LIST' }],
    }),
    submitClaim: builder.mutation<ClaimSubmitResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/submit`,
        method: 'PATCH',
      }),
      transformResponse: (response: unknown) => {
        const claim = normalizeClaim(readResponsePath<unknown>(response, 'data.claim'))
        const claimSubmission = normalizeClaimSubmission(
          readResponsePath<unknown>(response, 'data.claimSubmission'),
        )

        if (!claim || !claimSubmission) {
          throw new Error('Claim submission response is invalid.')
        }

        return {
          claim,
          claimSubmission,
          claimId: normalizeOptionalString(readResponsePath<unknown>(response, 'data.claimId')),
          claimSubmissionId: normalizeOptionalString(readResponsePath<unknown>(response, 'data.claimSubmissionId')),
          submissionStatus: normalizeOptionalString(readResponsePath<unknown>(response, 'data.submissionStatus')),
          externalSubmissionId: normalizeOptionalString(readResponsePath<unknown>(response, 'data.externalSubmissionId')),
          controlNumber: normalizeOptionalString(readResponsePath<unknown>(response, 'data.controlNumber')),
          trackingStatus: normalizeOptionalString(readResponsePath<unknown>(response, 'data.trackingStatus')),
          warnings: normalizeStringArray(readResponsePath<unknown>(response, 'data.warnings')),
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
        { type: 'ClaimSubmission', id: 'LIST' },
        { type: 'ClaimTracking', id: 'LIST' },
      ],
    }),
    validateClaimReadiness: builder.mutation<ClaimReadinessResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/readiness`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ClaimReadinessResult>(response, claimApiDetails.responseDataPath),
    }),
    evaluateClaimClosure: builder.query<ClaimClosureResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/closure`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ClaimClosureResult>(response, claimApiDetails.responseDataPath),
      providesTags: (_result, _error, id) => [{ type: 'Claim', id }],
    }),
    closeClaim: builder.mutation<ClaimClosureResult, { id: EntityId; reason: string }>({
      query: ({ id, reason }) => ({
        url: `${claimApiDetails.endpoint}/${id}/close`,
        method: 'POST',
        data: { reason },
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ClaimClosureResult>(response, claimApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    reopenClaim: builder.mutation<ClaimClosureResult, { id: EntityId; reason: string }>({
      query: ({ id, reason }) => ({
        url: `${claimApiDetails.endpoint}/${id}/reopen`,
        method: 'POST',
        data: { reason },
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ClaimClosureResult>(response, claimApiDetails.responseDataPath),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    reviewClaimReadinessWithAi: builder.mutation<ClaimAiReadinessReviewResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/ai-readiness-review`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) =>
        readResponsePath<ClaimAiReadinessReviewResult>(response, claimApiDetails.responseDataPath),
    }),
    refreshClaimStatus: builder.mutation<ClaimStatusResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/refresh-status`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<Record<string, unknown>>(response, claimApiDetails.responseDataPath)
        const claim = normalizeClaim(data?.claim)
        const claimSubmission = normalizeClaimSubmission(data?.claimSubmission)

        if (!claim || !claimSubmission) {
          throw new Error('Claim status response is invalid.')
        }

        return {
          claim,
          claimSubmission,
          trackingStatus: normalizeOptionalString(data?.trackingStatus),
          externalSubmissionId: normalizeOptionalString(data?.externalSubmissionId),
          controlNumber: normalizeOptionalString(data?.controlNumber),
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
        { type: 'ClaimSubmission', id: 'LIST' },
        { type: 'ClaimTracking', id: 'LIST' },
      ],
    }),
    runClaimEligibility: builder.mutation<ClaimRunEligibilityResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/run-eligibility`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<Record<string, unknown>>(response, claimApiDetails.responseDataPath)
        const claim = normalizeClaim(data?.claim)
        const eligibilityVerification = normalizeEligibilityVerification(data?.eligibilityVerification)
        const readiness = data?.readiness as ClaimReadinessResult | undefined

        if (!claim || !eligibilityVerification || !readiness) {
          throw new Error('Claim eligibility response is invalid.')
        }

        return {
          claim,
          eligibilityVerification,
          readiness,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
        { type: 'EligibilityVerification', id: 'LIST' },
        { type: 'InsurancePolicy', id: 'LIST' },
      ],
    }),
    refreshClaimPricing: builder.mutation<ClaimRefreshPricingResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/refresh-pricing`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<Record<string, unknown>>(response, claimApiDetails.responseDataPath)
        const claim = normalizeClaim(data?.claim)
        const readiness = data?.readiness as ClaimReadinessResult | undefined
        const pricingResults = Array.isArray(data?.pricingResults)
          ? data.pricingResults as ClaimRefreshPricingResult['pricingResults']
          : []

        if (!claim || !readiness) {
          throw new Error('Claim pricing refresh response is invalid.')
        }

        return {
          claim,
          readiness,
          pricingResults,
        }
      },
      invalidatesTags: (_result, _error, id) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    linkClaimAuthorization: builder.mutation<ClaimLinkAuthorizationResult, { id: EntityId; authorizationId?: EntityId }>({
      query: ({ id, authorizationId }) => ({
        url: `${claimApiDetails.endpoint}/${id}/link-authorization`,
        method: 'POST',
        data: authorizationId ? { authorizationId } : {},
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<Record<string, unknown>>(response, claimApiDetails.responseDataPath)
        const claim = normalizeClaim(data?.claim)
        const readiness = data?.readiness as ClaimReadinessResult | undefined

        if (!claim || !readiness) {
          throw new Error('Claim authorization link response is invalid.')
        }

        return {
          claim,
          readiness,
          authorizationId: normalizeOptionalString(data?.authorizationId),
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    linkClaimReferral: builder.mutation<ClaimLinkReferralResult, { id: EntityId; referralId?: EntityId }>({
      query: ({ id, referralId }) => ({
        url: `${claimApiDetails.endpoint}/${id}/link-referral`,
        method: 'POST',
        data: referralId ? { referralId } : {},
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<Record<string, unknown>>(response, claimApiDetails.responseDataPath)
        const claim = normalizeClaim(data?.claim)
        const readiness = data?.readiness as ClaimReadinessResult | undefined

        if (!claim || !readiness) {
          throw new Error('Claim referral link response is invalid.')
        }

        return {
          claim,
          readiness,
          referralId: normalizeOptionalString(data?.referralId),
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
      ],
    }),
    predictClaimDenial: builder.mutation<ClaimDenialPredictionResult, ClaimDenialPredictionPayload>({
      query: (payload) => ({
        url: `${claimApiDetails.endpoint}/predict-denial`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        normalizeDenialPrediction(readResponsePath<unknown>(response, claimApiDetails.responseDataPath)),
    }),
    analyzeClaimRejection: builder.mutation<ClaimRejectionAiAnalysisResult, EntityId>({
      query: (id) => ({
        url: `${claimApiDetails.endpoint}/${id}/ai-analysis`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) =>
        normalizeClaimRejectionAiAnalysis(readResponsePath<unknown>(response, claimApiDetails.responseDataPath)),
      invalidatesTags: (_result, _error, id) => [{ type: 'Claim', id }],
    }),
    resubmitClaim: builder.mutation<ClaimResubmitResult, { id: EntityId; data?: ClaimUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${claimApiDetails.endpoint}/${id}/resubmit`,
        method: 'POST',
        data: data ?? {},
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath<Record<string, unknown>>(response, claimApiDetails.responseDataPath)
        const claim = normalizeClaim(data?.claim)
        const claimSubmission = normalizeClaimSubmission(data?.claimSubmission)

        if (!claim || !claimSubmission) {
          throw new Error('Claim resubmission response is invalid.')
        }

        return {
          claim,
          claimSubmission,
          trackingStatus: normalizeOptionalString(data?.trackingStatus),
          externalSubmissionId: normalizeOptionalString(data?.externalSubmissionId),
          controlNumber: normalizeOptionalString(data?.controlNumber),
          sourceClaimId: normalizeOptionalString(data?.sourceClaimId),
          resubmittedClaimId: normalizeOptionalString(data?.resubmittedClaimId),
          resubmissionCount: normalizeOptionalNumber(data?.resubmissionCount),
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Claim', id },
        { type: 'Claim', id: 'LIST' },
        { type: 'Claim', id: 'REJECTED' },
        { type: 'ClaimSubmission', id: 'LIST' },
      ],
    }),
  }),
})

export const {
  useBulkDeleteClaimsMutation,
  useCreateClaimFromChargeMutation,
  useCreateClaimMutation,
  useCloseClaimMutation,
  useDeleteClaimMutation,
  useEvaluateClaimClosureQuery,
  useGetClaimQuery,
  useGetClaimsQuery,
  useGetClaimRejectionsQuery,
  useGetRejectedClaimsQuery,
  useAnalyzeClaimRejectionMutation,
  useLinkClaimAuthorizationMutation,
  useLinkClaimReferralMutation,
  usePredictClaimDenialMutation,
  useRefreshClaimStatusMutation,
  useReopenClaimMutation,
  useRefreshClaimPricingMutation,
  useRunClaimEligibilityMutation,
  useReviewClaimReadinessWithAiMutation,
  useSubmitClaimMutation,
  useResubmitClaimMutation,
  useUpdateClaimMutation,
  useValidateClaimReadinessMutation,
} = claimsApi
