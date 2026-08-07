export interface Denial {
  _id: string
  denialId: string
  claimId?: string
  claimLineId?: string
  paymentPostingId?: string
  relatedPaymentPostingIds?: string[]
  eraEobProcessingId?: string
  adjustmentId?: string
  appealId?: string
  correctedClaimId?: string
  arWorkItemId?: string
  patientId?: string
  payerId?: string
  cptCode?: string
  denialCode?: string
  carcCodes?: string[]
  rarcCodes?: string[]
  denialReason?: string
  payerDenialReason?: string
  denialCategory?: string
  classificationExplanation?: string
  denialSource?: string
  denialDate?: string | Date
  denialAmount?: number
  adjustmentAmount?: number
  denialBalance?: number
  lineBilledAmount?: number
  linePaidAmount?: number
  lineAllowedAmount?: number
  resolvedAmount?: number
  remainingDeniedBalance?: number
  matchConfidence?: number
  matchedBy?: string[]
  allocationAmount?: number
  manualReviewRequired?: boolean
  paymentAllocations?: Array<Record<string, unknown>>
  appealDeadline?: string | Date
  preventableFlag: boolean
  rootCause?: string
  owner?: string
  priority?: string
  denialStatus?: string
  reworkType?: string
  recommendedAction?: string
  correctionEligible?: boolean
  appealEligible?: boolean
  recoveryRecommendation?: 'CORRECTED_CLAIM' | 'APPEAL' | 'WRITE_OFF'
  recommendationReason?: string
  aiAnalysis?: Record<string, unknown>
  aiConfidenceScore?: number
  aiRecommendationSource?: string
  aiRecommendationHistory?: Array<Record<string, unknown>>
  resolutionDate?: string | Date
  resolutionNotes?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface DenialFormValues {
  _id?: string
  claimId: string
  claimLineId: string
  paymentPostingId: string
  eraEobProcessingId: string
  adjustmentId: string
  correctedClaimId: string
  arWorkItemId: string
  patientId: string
  payerId: string
  cptCode: string
  denialCode: string
  carcCodes: string
  rarcCodes: string
  denialReason: string
  denialCategory: string
  classificationExplanation: string
  denialSource: string
  denialDate: Date | null
  denialAmount: number | null
  preventableFlag: boolean
  rootCause: string
  owner: string
  priority: string
  denialStatus: string
  reworkType: string
  recommendedAction: string
  correctionEligible: boolean
  appealEligible: boolean
  recoveryRecommendation: string
  recommendationReason: string
  resolutionDate: Date | null
  resolutionNotes: string
  active: boolean
}

export interface DenialCreatePayload {
  claimId?: string
  claimLineId?: string
  paymentPostingId?: string
  eraEobProcessingId?: string
  adjustmentId?: string
  correctedClaimId?: string
  arWorkItemId?: string
  patientId?: string
  payerId?: string
  cptCode?: string
  denialCode?: string
  carcCodes?: string[]
  rarcCodes?: string[]
  denialReason?: string
  denialCategory?: string
  classificationExplanation?: string
  denialSource?: string
  denialDate?: Date
  denialAmount?: number
  preventableFlag: boolean
  rootCause?: string
  owner?: string
  priority?: string
  denialStatus?: string
  reworkType?: string
  recommendedAction?: string
  correctionEligible?: boolean
  appealEligible?: boolean
  recoveryRecommendation?: 'CORRECTED_CLAIM' | 'APPEAL' | 'WRITE_OFF'
  recommendationReason?: string
  resolutionDate?: Date
  resolutionNotes?: string
  active: boolean
}

export type DenialUpdatePayload = DenialCreatePayload
