export interface ClaimPrediction {
  _id: string
  predictionId: string
  claimId?: string
  chargeId?: string
  encounterId?: string
  appointmentId?: string
  patientId?: string
  cptCode: string
  payerId: string
  lineNumber?: number
  providerId?: string
  renderingProviderId?: string
  billingProviderId?: string
  facilityId?: string
  units?: number
  chargeAmount?: number
  predictedAllowed: number
  predictedPaid: number
  predictedPatientResponsibility?: number
  expectedAllowedPercentage?: number
  expectedPaidPercentage?: number
  confidenceScore: number
  denialRiskScore?: number
  eligibilityRiskScore?: number
  authorizationRiskScore?: number
  paymentVarianceScore?: number
  riskLevel?: 'Low' | 'Medium' | 'High' | 'Critical'
  workflowStage?: string
  nextBestActions?: string[]
  riskFactors?: string[]
  evidence?: string[]
  sampleSize?: number
  feeScheduleId?: string
  feeScheduleMatchLevel?: string
  pricingState?: string
  placeOfServiceCode?: string
  source: 'historical' | 'ai' | 'workflow_rules' | 'hybrid'
  explanation?: string
  active?: boolean
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
}

export interface PredictionRequestPayload {
  claimId?: string
  cptCode: string
  payerId?: string
  lineNumber?: number
  units?: number
  renderingProviderId?: string
  billingProviderId?: string
  facilityId?: string
  placeOfServiceCode?: string
  pricingState?: string
  chargeAmount?: number
}
