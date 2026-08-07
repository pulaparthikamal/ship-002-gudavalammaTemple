import type { Appointment } from './appointment'
import type { Charge } from './charge'
import type { Claim } from './claim'
import type { ClaimSubmission } from './claimSubmission'
import type { CodingReview } from './codingReview'
import type { Encounter } from './encounter'
import type { PatientBilling } from './patientBilling'

export type WorkflowStageState = 'completed' | 'pending' | 'blocked'

export type WorkflowStageKey =
  | 'appointment'
  | 'encounter'
  | 'charge'
  | 'codingReview'
  | 'claim'
  | 'claimReadiness'
  | 'claimSubmission'
  | 'claimTracking'
  | 'waitingForERA'
  | 'eraEobProcessing'
  | 'paymentPosting'
  | 'denial'
  | 'appeal'
  | 'correctedClaim'
  | 'arWorkItem'
  | 'patientBilling'
  | 'collection'
  | 'closed'

export type DashboardRecordStageKey =
  | 'insurancePolicy'
  | 'priorAuthorization'
  | 'denial'
  | 'appeal'
  | 'arWorkItem'
  | 'patientBilling'
  | 'collection'

export interface WorkflowContext {
  appointmentId?: string
  encounterId?: string
  chargeId?: string
  codingReviewId?: string
  claimId?: string
  claimReadinessId?: string
  claimSubmissionId?: string
  claimTrackingId?: string
  eraEobProcessingId?: string
  paymentPostingId?: string
  denialId?: string
  appealId?: string
  correctedClaimId?: string
  arWorkItemId?: string
  patientBillingId?: string
  collectionId?: string
  patientId?: string
  payerId?: string
  providerId?: string
  facilityId?: string
  status?: string
  claimStatus?: string
  readinessStatus?: string
  submissionStatus?: string
  trackingStatus?: string
  eraStatus?: string
  postingStatus?: string
  paymentStatus?: string
  denialStatus?: string
  appealStatus?: string
  arStatus?: string
  patientBillingStatus?: string
  collectionStatus?: string
  closureStatus?: string
  riskType?: string
  exceptionType?: string
  insurancePolicyId?: string
  dashboardQueue?: string
  dashboardEntityId?: string
  returnTo?: string
  returnLabel?: string
}

export interface WorkflowStageDefinition {
  key: WorkflowStageKey
  label: string
  route: string
  description: string
  statusFields: string[]
  completedStatuses: string[]
  pendingStatuses: string[]
  blockedStatuses: string[]
  allowedNextActions: string[]
  entityRelationships: string[]
}

export interface WorkflowStageRuntime extends WorkflowStageDefinition {
  state: WorkflowStageState
  status?: string
  routeWithContext: string
  reason?: string
}

export interface WorkflowFeedback {
  severity: 'success' | 'error' | 'warn'
  text: string
}

export interface AppointmentCheckInResult {
  appointment: Appointment
  encounter: Encounter
}

export interface EncounterCompleteResult {
  encounter: Encounter
  charge: Charge
}

export interface ChargeSubmitForReviewResult {
  charge: Charge
  codingReview: CodingReview
}

export interface CodingReviewApproveResult {
  codingReview: CodingReview
  claim?: Claim
  billing?: PatientBilling
}

export interface ClaimSubmitResult {
  claim: Claim
  claimSubmission: ClaimSubmission
  claimId?: string
  claimSubmissionId?: string
  submissionStatus?: string
  externalSubmissionId?: string
  controlNumber?: string
  trackingStatus?: string
  warnings?: string[]
}
