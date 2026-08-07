import type { EligibilityVerification } from '@/types/eligibilityVerification'
import type { ClaimSubmission } from '@/types/claimSubmission'
import type { TimelyFilingAlert } from '@/types/timelyFilingAlert'
import type { AttachmentLink, AttachmentLinkFormValues } from '@/types/common'
import type { DocumentationComplianceSeverity, DocumentationComplianceStatus } from '@/types/documentationComplianceAlert'

export interface ClaimClaimLine {
  _id?: string
  lineNumber?: number
  chargeLineId?: string
  cptCode?: string
  modifiers?: string[]
  icdPointers?: number[]
  units?: number
  chargeAmount?: number
  renderingProviderId?: string
  placeOfService?: string
  serviceDateFrom?: string | Date
  serviceDateTo?: string | Date
  expectedAllowedAmount?: number
  expectedInsurancePayment?: number
  expectedPatientResponsibility?: number
  patientCopayAmount?: number
  patientCoinsuranceAmount?: number
  deductibleAppliedAmount?: number
  feeScheduleId?: string
  pricingMatchedBy?: string
  pricingSource?: string
  pricingSnapshotDate?: string | Date
  coverageRuleSnapshot?: Record<string, unknown>
  payerRuleSnapshot?: Record<string, unknown>
  eligibilityVerificationId?: string
  priorAuthorizationId?: string
  referralId?: string
  authorizationRequired?: boolean
  referralRequired?: boolean
  networkStatus?: string
}

export interface Claim {
  _id: string
  claimId: string
  chargeId?: string
  encounterId?: string
  patientId?: string
  payerId?: string
  billingProviderId?: string
  renderingProviderId?: string
  facilityId?: string
  claimDate?: string | Date
  totalChargeAmount?: number
  coveragePriority?: string
  frequencyCode?: string
  claimType?: string
  claimStatus?: string
  scrubStatus?: string
  submissionStatus?: string
  paymentStatus?: 'PAYMENT_RECEIVED' | 'PARTIALLY_PAID' | 'PAID' | 'PATIENT_RESPONSIBILITY' | 'DENIED' | 'UNDERPAID' | 'PAYMENT_POSTING_FAILED'
  closureStatus?: 'OPEN' | 'IN_PROGRESS' | 'AWAITING_ERA' | 'ERA_DELAYED' | 'FOLLOW_UP_REQUIRED' | 'PARTIALLY_PAID' | 'DENIED' | 'RESOLVED' | 'READY_TO_CLOSE' | 'CLOSED' | 'REOPENED'
  closeReason?: string
  closedBy?: string
  closedAt?: string | Date
  reopenReason?: string
  reopenedBy?: string
  reopenedAt?: string | Date
  expectedEraBy?: string | Date
  lastPayerFollowUpAt?: string | Date
  followUpCount?: number
  financialBalanceSnapshot?: Record<string, unknown>
  diagnosisCodes?: string[]
  rejectionReason?: string
  originalClaimId?: string
  correctedFromClaimId?: string
  sourceDenialId?: string
  correctedClaimRecordId?: string
  correctionType?: string
  lineageChain?: string[]
  parentClaimId?: string
  version?: number
  resubmissionCount?: number
  correctedClaimIndicator: boolean
  batchId?: string
  clearingHouse?: string
  ediStatus?: string
  snapshotStatus?: string
  snapshotIssues?: string[]
  sourceChargeUpdatedAt?: string | Date
  sourceCodingReviewUpdatedAt?: string | Date
  sourceCodingSnapshotHash?: string
  claimLines: ClaimClaimLine[]
  attachments: AttachmentLink[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ClaimClaimLineFormValues {
  lineNumber: number | null
  chargeLineId: string
  cptCode: string
  modifiers: string
  icdPointers: string
  units: number | null
  chargeAmount: number | null
  renderingProviderId: string
  placeOfService: string
  serviceDateFrom: Date | null
  serviceDateTo: Date | null
}

export interface ClaimFormValues {
  _id?: string
  chargeId: string
  encounterId: string
  patientId: string
  payerId: string
  billingProviderId: string
  renderingProviderId: string
  facilityId: string
  claimDate: Date | null
  totalChargeAmount: number | null
  diagnosisCodes: string
  coveragePriority: string
  frequencyCode: string
  claimType: string
  claimStatus: string
  scrubStatus: string
  submissionStatus: string
  paymentStatus: string
  rejectionReason: string
  originalClaimId: string
  correctedFromClaimId: string
  sourceDenialId: string
  correctedClaimRecordId: string
  correctionType: string
  parentClaimId?: string
  version?: number
  resubmissionCount?: number
  correctedClaimIndicator: boolean
  batchId: string
  clearingHouse: string
  ediStatus: string
  claimLines: ClaimClaimLineFormValues[]
  attachments: AttachmentLinkFormValues[]
  active: boolean
}

export interface ClaimCreatePayload {
  chargeId?: string
  encounterId?: string
  patientId?: string
  payerId?: string
  billingProviderId?: string
  renderingProviderId?: string
  facilityId?: string
  claimDate?: Date
  totalChargeAmount?: number
  diagnosisCodes?: string[]
  coveragePriority?: string
  frequencyCode?: string
  claimType?: string
  claimStatus?: string
  scrubStatus?: string
  submissionStatus?: string
  paymentStatus?: string
  rejectionReason?: string
  originalClaimId?: string
  correctedFromClaimId?: string
  sourceDenialId?: string
  correctedClaimRecordId?: string
  correctionType?: string
  lineageChain?: string[]
  parentClaimId?: string
  version?: number
  resubmissionCount?: number
  correctedClaimIndicator: boolean
  batchId?: string
  clearingHouse?: string
  ediStatus?: string
  claimLines?: ClaimClaimLine[]
  attachments?: AttachmentLink[]
  active: boolean
}

export type ClaimUpdatePayload = ClaimCreatePayload

export interface ClaimClosureEvaluation {
  canClose: boolean
  blockers: string[]
  counts: Record<string, number>
  financial: Record<string, number | boolean>
}

export interface ClaimClosureResult {
  claim: Claim
  evaluation: ClaimClosureEvaluation
}

export interface ClaimDenialPredictionPayload {
  patientDetails?: Record<string, unknown>
  providerDetails?: Record<string, unknown>
  insuranceDetails?: Record<string, unknown>
  cptCodes?: string[]
  icdCodes?: string[]
  modifiers?: string[]
  authorizationInfo?: Record<string, unknown>
  claimAmount?: string | number
  dateOfService?: string
  demographics?: Record<string, unknown>
  claimNotes?: string
}

export interface ClaimDenialPredictionResult {
  denialProbability: number
  riskScore: number
  riskLevel: 'Low' | 'Medium' | 'High'
  predictedDenialReasons: string[]
  recommendations: string[]
  confidenceLevel: number
  summary: string
}

export interface ClaimReadinessResult {
  canSubmit: boolean
  errors: string[]
  warnings: string[]
  requiredActions: string[]
  authorizationRequired?: boolean
  authorizationValid?: boolean
  authorizationId?: string
  authorizationErrors?: string[]
  referralRequired?: boolean
  referralValid?: boolean
  referralId?: string
  referralErrors?: string[]
  timelyFiling?: {
    claimId: string
    payerId: string
    serviceDate: string | Date
    filingDeadline: string | Date
    daysRemaining: number
    severity: TimelyFilingAlert['severity']
    status: TimelyFilingAlert['status']
    timelyFilingDays?: number
    alert?: TimelyFilingAlert | null
  } | null
  documentationCompliance?: {
    claimId: string
    requiredDocuments: string[]
    missingDocuments: string[]
    matchedDocuments: string[]
    severity: DocumentationComplianceSeverity
    status: DocumentationComplianceStatus
  } | null
}

export interface ClaimAiReadinessReviewResult {
  readinessScore: number
  summary: string
  blockingIssues: string[]
  recommendedFixes: string[]
  denialRisks: string[]
  missingData: string[]
  deterministicValidation: ClaimReadinessResult
  aiReview?: Record<string, unknown> | null
}

export interface ClaimRunEligibilityResult {
  claim: Claim
  eligibilityVerification: EligibilityVerification
  readiness: ClaimReadinessResult
}

export interface ClaimRefreshPricingResult {
  claim: Claim
  readiness: ClaimReadinessResult
  pricingResults: Array<{
    lineNumber: number
    cptCode?: string
    matched: boolean
    feeScheduleId?: string
    allowedAmount?: number
    message: string
  }>
}

export interface ClaimLinkAuthorizationResult {
  claim: Claim
  readiness: ClaimReadinessResult
  authorizationId?: string
}

export interface ClaimLinkReferralResult {
  claim: Claim
  readiness: ClaimReadinessResult
  referralId?: string
}

export interface ClaimStatusResult {
  claim: Claim
  claimSubmission: ClaimSubmission
  trackingStatus?: string
  externalSubmissionId?: string
  controlNumber?: string
}

export interface ClaimRejection {
  _id: string
  claimId?: string
  claimSubmissionId?: string
  rejectionCode?: string
  rejectionReason?: string
  payerResponse?: Record<string, unknown>
  category?: string
  status?: string
  resolvedAt?: string
  resubmittedClaimId?: string
  correctedFields?: string[]
  aiSuggestion?: ClaimRejectionAiAnalysisResult
  createdAt: string
  updatedAt: string
}

export interface ClaimRejectionAiAnalysisResult {
  rootCause: string
  suggestion: string
  confidence: number
  rejectionId?: string
}

export interface ClaimResubmitResult extends ClaimStatusResult {
  sourceClaimId?: string
  resubmittedClaimId?: string
  resubmissionCount?: number
}
