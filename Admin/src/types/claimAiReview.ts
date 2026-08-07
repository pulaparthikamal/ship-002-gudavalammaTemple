export interface ClaimAiReviewDenialPrediction {
  riskScore?: number
  riskLevel?: string
  predictedReasons?: string[]
  recommendedFixes?: string[]
  modelVersion?: string
  predictedAt?: string | Date
  confidenceScore?: number
  reviewRequired: boolean
}

export interface ClaimAiReview {
  _id: string
  claimAiReviewId: string
  claimId?: string
  reviewStatus?: string
  blockingReasons?: string[]
  overrideReason?: string
  overriddenBy?: string
  overriddenAt?: string | Date
  denialPrediction: ClaimAiReviewDenialPrediction
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ClaimAiReviewDenialPredictionFormValues {
  riskScore: number | null
  riskLevel: string
  predictedReasons: string
  recommendedFixes: string
  modelVersion: string
  predictedAt: Date | null
  confidenceScore: number | null
  reviewRequired: boolean
}

export interface ClaimAiReviewFormValues {
  _id?: string
  claimId: string
  reviewStatus: string
  blockingReasons: string
  overrideReason: string
  denialPrediction: ClaimAiReviewDenialPredictionFormValues
  active: boolean
}

export interface ClaimAiReviewCreatePayload {
  claimId?: string
  reviewStatus?: string
  blockingReasons?: string[]
  overrideReason?: string
  denialPrediction?: ClaimAiReviewDenialPrediction
  active: boolean
}

export type ClaimAiReviewUpdatePayload = ClaimAiReviewCreatePayload
