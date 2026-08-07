export interface ClaimSubmission {
  _id: string
  submissionId: string
  claimId?: string
  previousSubmissionId?: string
  submissionType?: string
  submissionMethod?: string
  submissionFileType?: string
  payloadFormat?: string
  submissionDateTime?: string | Date
  clearinghouseName?: string
  clearinghouseEndpoint?: string
  batchId?: string
  submissionTraceId?: string
  externalSubmissionId?: string
  externalBatchId?: string
  controlNumber?: string
  claimControlNumber?: string
  clearinghouseTraceNumber?: string
  payerClaimNumber?: string
  idempotencyKey?: string
  retrySequence?: number
  retryCount?: number
  retryable?: boolean
  lastRetryAt?: string | Date
  payloadSnapshot?: string
  requestPayloadRedacted?: string
  responsePayloadRedacted?: string
  trackingSource?: 'REAL' | 'SIMULATED'
  responseType?: 'SUBMISSION' | 'ACK_999' | 'ACK_277CA' | 'STATUS_UPDATE'
  normalizedStatus?: 'DRAFT' | 'READY' | 'SUBMITTED' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  status?: string
  transmissionStatus?: string
  acknowledgementStatus?: string
  acknowledgementType?: string
  acknowledgementDateTime?: string | Date
  responseStatusCode?: number
  rawResponsePayload?: string
  rawAcknowledgementPayload?: string
  submissionErrorCode?: string
  submissionErrorMessage?: string
  lastError?: string
  submittedAt?: string | Date
  submittedBy?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ClaimSubmissionFormValues {
  _id?: string
  claimId: string
  submissionMethod: string
  submissionFileType: string
  submissionDateTime: Date | null
  clearinghouseName: string
  batchId: string
  submissionTraceId: string
  transmissionStatus: string
  acknowledgementStatus: string
  acknowledgementDateTime: Date | null
  submissionErrorCode: string
  submissionErrorMessage: string
  payloadSnapshot: string
  active: boolean
}

export interface ClaimSubmissionCreatePayload {
  claimId?: string
  submissionMethod?: string
  submissionFileType?: string
  submissionDateTime?: Date
  clearinghouseName?: string
  batchId?: string
  submissionTraceId?: string
  transmissionStatus?: string
  acknowledgementStatus?: string
  acknowledgementDateTime?: Date
  submissionErrorCode?: string
  submissionErrorMessage?: string
  payloadSnapshot?: string
  active: boolean
}

export type ClaimSubmissionUpdatePayload = ClaimSubmissionCreatePayload
