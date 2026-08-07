import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { claimPredictionApiDetails } from '@/models/claimPredictionModel'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type { ClaimPrediction, PredictionRequestPayload } from '@/types/claimPrediction'

function normalizeClaimPrediction(response: unknown): ClaimPrediction | null {
  if (typeof response !== 'object' || response === null) return null
  const item = response as any
  if (typeof item._id !== 'string') return null

  return {
    _id: item._id,
    predictionId: item.predictionId,
    claimId: item.claimId,
    chargeId: item.chargeId,
    encounterId: item.encounterId,
    appointmentId: item.appointmentId,
    patientId: item.patientId,
    cptCode: item.cptCode,
    payerId: item.payerId,
    lineNumber: item.lineNumber,
    providerId: item.providerId,
    renderingProviderId: item.renderingProviderId,
    billingProviderId: item.billingProviderId,
    facilityId: item.facilityId,
    units: item.units,
    chargeAmount: item.chargeAmount,
    predictedAllowed: item.predictedAllowed,
    predictedPaid: item.predictedPaid,
    predictedPatientResponsibility: item.predictedPatientResponsibility,
    expectedAllowedPercentage: item.expectedAllowedPercentage,
    expectedPaidPercentage: item.expectedPaidPercentage,
    confidenceScore: item.confidenceScore,
    denialRiskScore: item.denialRiskScore,
    eligibilityRiskScore: item.eligibilityRiskScore,
    authorizationRiskScore: item.authorizationRiskScore,
    paymentVarianceScore: item.paymentVarianceScore,
    riskLevel: item.riskLevel,
    workflowStage: item.workflowStage,
    nextBestActions: item.nextBestActions,
    riskFactors: item.riskFactors,
    evidence: item.evidence,
    sampleSize: item.sampleSize,
    feeScheduleId: item.feeScheduleId,
    feeScheduleMatchLevel: item.feeScheduleMatchLevel,
    pricingState: item.pricingState,
    placeOfServiceCode: item.placeOfServiceCode,
    source: item.source,
    explanation: item.explanation,
    createdAt: item.createdAt || item.created,
    updatedAt: item.updatedAt || item.updated,
  }
}

function isClaimPrediction(value: ClaimPrediction | null): value is ClaimPrediction {
  return Boolean(value)
}

export const claimPredictionsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getClaimPredictions: builder.query<CrudListResponse<ClaimPrediction>, CrudListQuery>({
      query: (query) => ({
        url: claimPredictionApiDetails.endpoint,
        method: 'GET',
        params: {
          [claimPredictionApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) =>
        normalizeCrudListResponse({
          response,
          query,
          dataPaths: [claimPredictionApiDetails.responseDataPath],
          totalPaths: [claimPredictionApiDetails.responseTotalPath],
          mapItem: normalizeClaimPrediction,
        }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'ClaimPrediction' as const, id: item._id })),
              { type: 'ClaimPrediction' as const, id: 'LIST' },
            ]
          : [{ type: 'ClaimPrediction' as const, id: 'LIST' }],
    }),
    predictClaimAmount: builder.mutation<ClaimPrediction, PredictionRequestPayload>({
      query: (payload) => ({
        url: claimPredictionApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) =>
        normalizeClaimPrediction(readResponsePath(response, claimPredictionApiDetails.responseDataPath))!,
      invalidatesTags: [{ type: 'ClaimPrediction', id: 'LIST' }],
    }),
    predictForClaim: builder.mutation<ClaimPrediction[], string>({
      query: (claimId) => ({
        url: `${claimPredictionApiDetails.endpoint}/claim/${claimId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath(response, claimPredictionApiDetails.responseDataPath)
        return Array.isArray(data) ? data.map(normalizeClaimPrediction).filter(isClaimPrediction) : []
      },
      invalidatesTags: [{ type: 'ClaimPrediction', id: 'LIST' }],
    }),
    predictForCharge: builder.mutation<ClaimPrediction[], string>({
      query: (chargeId) => ({
        url: `${claimPredictionApiDetails.endpoint}/charge/${chargeId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath(response, claimPredictionApiDetails.responseDataPath)
        return Array.isArray(data) ? data.map(normalizeClaimPrediction).filter(isClaimPrediction) : []
      },
      invalidatesTags: [{ type: 'ClaimPrediction', id: 'LIST' }],
    }),
    predictForEncounter: builder.mutation<ClaimPrediction[], string>({
      query: (encounterId) => ({
        url: `${claimPredictionApiDetails.endpoint}/encounter/${encounterId}`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath(response, claimPredictionApiDetails.responseDataPath)
        return Array.isArray(data) ? data.map(normalizeClaimPrediction).filter(isClaimPrediction) : []
      },
      invalidatesTags: [{ type: 'ClaimPrediction', id: 'LIST' }],
    }),
    estimateForAppointment: builder.mutation<ClaimPrediction[], string>({
      query: (id) => ({
        url: `${claimPredictionApiDetails.endpoint}/appointment/${id}/estimate`,
        method: 'POST',
      }),
      transformResponse: (response: unknown) => {
        const data = readResponsePath(response, claimPredictionApiDetails.responseDataPath)
        return Array.isArray(data) ? data.map(normalizeClaimPrediction).filter(isClaimPrediction) : []
      },
      invalidatesTags: [{ type: 'ClaimPrediction', id: 'LIST' }],
    }),
  }),
})

export const {
  useGetClaimPredictionsQuery,
  usePredictClaimAmountMutation,
  usePredictForClaimMutation,
  usePredictForChargeMutation,
  usePredictForEncounterMutation,
  useEstimateForAppointmentMutation,
} = claimPredictionsApi
