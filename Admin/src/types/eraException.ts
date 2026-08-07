export interface EraException {
  _id: string
  eraExceptionId: string
  exceptionType: string
  severity?: string
  status?: string
  assignedTo?: string
  resolutionNotes?: string
  ignoredReason?: string
  relatedClaim?: string
  relatedERA?: string
  relatedPaymentPosting?: string
  relatedDenial?: string
  relatedARWorkItem?: string
  aiAnalysis?: Record<string, unknown>
  aiRecommendationHistory?: Record<string, unknown>[]
  actionHistory?: Record<string, unknown>[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
}

export interface EraExceptionFormValues {
  _id?: string
  exceptionType: string
  severity: string
  status: string
  assignedTo: string
  resolutionNotes: string
  ignoredReason: string
  relatedClaim: string
  relatedERA: string
  relatedPaymentPosting: string
  relatedDenial: string
  relatedARWorkItem: string
  active: boolean
}

export interface EraExceptionCreatePayload {
  exceptionType: string
  severity?: string
  status?: string
  assignedTo?: string
  resolutionNotes?: string
  ignoredReason?: string
  relatedClaim?: string
  relatedERA?: string
  relatedPaymentPosting?: string
  relatedDenial?: string
  relatedARWorkItem?: string
  active: boolean
}

export type EraExceptionUpdatePayload = EraExceptionCreatePayload
