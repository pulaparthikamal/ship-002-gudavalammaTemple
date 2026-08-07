export interface ClaimTracking {
  _id: string
  trackingId: string
  claimId?: string
  claimSubmissionId?: string
  timestamp?: string | Date
  source?: string
  trackingSource?: 'REAL' | 'SIMULATED'
  responseType?: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE'
  eventType?:
    | 'SUBMISSION_CREATED'
    | 'SUBMISSION_SENT'
    | 'SUBMISSION_FAILED'
    | 'ACK_999_ACCEPTED'
    | 'ACK_999_REJECTED'
    | 'ACK_277CA_ACCEPTED'
    | 'ACK_277CA_REJECTED'
    | 'CLAIM_PENDING'
    | 'CLAIM_STATUS_UPDATED'
  normalizedStatus?: 'DRAFT' | 'READY' | 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  rawStatusCode?: string
  summary?: string
  controlNumber?: string
  externalSubmissionId?: string
  claimControlNumber?: string
  clearinghouseTraceNumber?: string
  payerClaimNumber?: string
  acknowledgementType?: string
  statusCode?: string
  statusDescription?: string
  receivedDate?: string | Date
  rejectionLevel?: string
  rejectionSource?: string
  rejectionReasonCodes?: string[]
  stcCategoryCode?: string
  stcStatusCode?: string
  stcEntityCode?: string
  affectedServiceLine?: string
  remediationCode?: string
  remediationFieldPath?: string
  remediationSeverity?: 'BLOCKING' | 'WARNING'
  nextActionRequired?: string
  responsePayloadRedacted?: string
  responseStatusCode?: number
  aiRejectionAnalysis?: Record<string, unknown>
  aiRecommendationHistory?: Array<Record<string, unknown>>
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ClaimTrackingFormValues {
  _id?: string
  claimId: string
  claimSubmissionId: string
  timestamp: Date | null
  source: string
  trackingSource: 'REAL' | 'SIMULATED'
  responseType: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE'
  eventType: string
  normalizedStatus: string
  rawStatusCode: string
  summary: string
  controlNumber: string
  externalSubmissionId: string
  claimControlNumber: string
  clearinghouseTraceNumber: string
  payerClaimNumber: string
  acknowledgementType: string
  statusCode: string
  statusDescription: string
  receivedDate: Date | null
  rejectionLevel: string
  rejectionSource: string
  rejectionReasonCodes: string
  stcCategoryCode: string
  stcStatusCode: string
  stcEntityCode: string
  affectedServiceLine: string
  remediationCode: string
  remediationFieldPath: string
  remediationSeverity: string
  nextActionRequired: string
  active: boolean
}

export interface ClaimTrackingCreatePayload {
  claimId?: string
  claimSubmissionId?: string
  timestamp?: Date
  source?: string
  trackingSource?: 'REAL' | 'SIMULATED'
  responseType?: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE'
  eventType?: string
  normalizedStatus?: string
  rawStatusCode?: string
  summary?: string
  controlNumber?: string
  externalSubmissionId?: string
  claimControlNumber?: string
  clearinghouseTraceNumber?: string
  payerClaimNumber?: string
  acknowledgementType?: string
  statusCode?: string
  statusDescription?: string
  receivedDate?: Date
  rejectionLevel?: string
  rejectionSource?: string
  rejectionReasonCodes?: string[]
  stcCategoryCode?: string
  stcStatusCode?: string
  stcEntityCode?: string
  affectedServiceLine?: string
  remediationCode?: string
  remediationFieldPath?: string
  remediationSeverity?: string
  nextActionRequired?: string
  active: boolean
}

export type ClaimTrackingUpdatePayload = ClaimTrackingCreatePayload
