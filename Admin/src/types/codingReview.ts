export interface ApprovedCodingSnapshotLine {
  lineNumber?: number
  chargeLineId?: string
  cptCode?: string
  modifiers?: string[]
  icdCodes?: string[]
  icdPointers?: number[]
  units?: number
  chargeAmount?: number
  placeOfService?: string
  renderingProviderId?: string
  serviceDateFrom?: string | Date
  serviceDateTo?: string | Date
}

export interface ApprovedCodingSnapshot {
  sourceChargeUpdatedAt?: string | Date
  snapshotHash?: string
  approvedAt?: string | Date
  lines?: ApprovedCodingSnapshotLine[]
}

export interface CodingReview {
  _id: string
  scrubId: string
  chargeId?: string
  encounterId?: string
  patientId?: string
  scrubStatus?: string
  codingRiskLevel?: string
  validationErrors?: string[]
  missingDocumentationFlag: boolean
  modifierIssues?: string[]
  icdCptMismatchFlag: boolean
  ncciEditFlag: boolean
  lcdNcdEditFlag: boolean
  payerSpecificRuleFailures?: string[]
  aiSuggestedCodes?: string[]
  aiSuggestedFixes?: string[]
  codingFailureExplanations?: Array<{
    lineNumber?: number
    field: string
    title: string
    explanation: string
    correction: string
    source: string
  }>
  reviewedBy?: string
  reviewedAt?: string | Date
  codingValidationResults?: Array<{
    code: string
    codeType: string
    status: string
    reasoning: string
    suggestedAlternative?: string
  }>
  approvedCodingSnapshot?: ApprovedCodingSnapshot
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface CodingReviewFormValues {
  _id?: string
  chargeId: string
  encounterId: string
  patientId: string
  scrubStatus: string
  codingRiskLevel: string
  validationErrors: string
  missingDocumentationFlag: boolean
  modifierIssues: string
  icdCptMismatchFlag: boolean
  ncciEditFlag: boolean
  lcdNcdEditFlag: boolean
  payerSpecificRuleFailures: string
  aiSuggestedCodes: string
  aiSuggestedFixes: string
  reviewedBy: string
  reviewedAt: Date | null
  active: boolean
}

export interface CodingReviewCreatePayload {
  chargeId?: string
  encounterId?: string
  patientId?: string
  scrubStatus?: string
  codingRiskLevel?: string
  validationErrors?: string[]
  missingDocumentationFlag: boolean
  modifierIssues?: string[]
  icdCptMismatchFlag: boolean
  ncciEditFlag: boolean
  lcdNcdEditFlag: boolean
  payerSpecificRuleFailures?: string[]
  aiSuggestedCodes?: string[]
  aiSuggestedFixes?: string[]
  reviewedBy?: string
  reviewedAt?: Date
  active: boolean
}

export type CodingReviewUpdatePayload = CodingReviewCreatePayload
