export interface Appeal {
  _id: string
  appealId: string
  denialId?: string
  claimId?: string
  arWorkItemId?: string
  payerId?: string
  denialCode?: string
  appealCategory?: string
  dueDate?: string | Date
  owner?: string
  appealLevel?: string
  appealReason?: string
  appealDescription?: string
  supportingDocuments?: string[]
  appealStatus?: string
  submissionDate?: string | Date
  submittedAt?: string | Date
  payerReceivedAt?: string | Date
  decisionAt?: string | Date
  appealDeadline?: string | Date
  submissionMethod?: string
  payerResponse?: string
  resolution?: string
  outcome?: string
  outcomeDate?: string | Date
  appealOutcomeReason?: string
  payerResponseDueAt?: string | Date
  evidenceSubmittedAt?: string | Date
  missingDocumentRequests?: Array<Record<string, unknown>>
  evidenceItems?: Array<Record<string, unknown>>
  slaStatus?: string
  escalatedAt?: string | Date
  escalationCount?: number
  escalationReason?: string
  evidenceSummary?: string
  submittedBy?: string
  decisionBy?: string
  decisionNotes?: string
  payerReferenceNumber?: string
  expectedReprocessBy?: string | Date
  relatedPaymentPostingId?: string
  relatedEraId?: string
  readinessStatus?: string
  readinessReview?: Record<string, unknown>
  packetGenerated?: boolean
  packetGeneratedAt?: string | Date
  packetVersion?: number
  packetStatus?: string
  packetFileReference?: string
  packetFileName?: string
  finalPacketGeneratedAt?: string | Date
  finalPacketVersion?: number
  finalPacketFileReference?: string
  finalPacketFileName?: string
  packetSnapshot?: Record<string, unknown>
  generatedAppealLetterText?: string
  aiPacketDraft?: Record<string, unknown>
  aiPacketHistory?: Array<Record<string, unknown>>
  diagnosisCodes?: string[]
  procedureCodes?: string[]
  medicalNecessityNotes?: string
  authorizationEvidence?: string
  eligibilityEvidence?: string
  priorPayerResponse?: string
  supportingDocumentsMetadata?: Array<Record<string, unknown>>
  correspondenceHistory?: Array<Record<string, unknown>>
  submissionChannel?: string
  submissionTracking?: Record<string, unknown>
  submissionProof?: Record<string, unknown>
  deadlineStatus?: string
  daysRemaining?: number
  recoveredAmount?: number
  payerRecoveredAmount?: number
  patientRecoveredAmount?: number
  contractualAdjustmentRecoveredAmount?: number
  recoveredAt?: string | Date
  recoveryStatus?: string
  recoveryPercent?: number
  statusHistory?: Array<Record<string, unknown>>
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface AppealFormValues {
  _id?: string
  denialId: string
  claimId: string
  arWorkItemId: string
  payerId: string
  denialCode: string
  appealCategory: string
  dueDate: Date | null
  owner: string
  appealLevel: string
  appealReason: string
  appealDescription: string
  supportingDocuments: string
  appealStatus: string
  submissionDate: Date | null
  appealDeadline: Date | null
  submissionMethod: string
  payerResponse: string
  resolution: string
  outcome: string
  outcomeDate: Date | null
  appealOutcomeReason: string
  active: boolean
}

export interface AppealCreatePayload {
  claimId?: string
  denialId?: string
  arWorkItemId?: string
  payerId?: string
  denialCode?: string
  appealCategory?: string
  dueDate?: Date
  owner?: string
  appealLevel?: string
  appealReason?: string
  appealDescription?: string
  supportingDocuments?: string[]
  appealStatus?: string
  submissionDate?: Date
  appealDeadline?: Date
  submissionMethod?: string
  payerResponse?: string
  resolution?: string
  outcome?: string
  outcomeDate?: Date
  appealOutcomeReason?: string
  active: boolean
}

export type AppealUpdatePayload = AppealCreatePayload

export interface AppealTimelineSection {
  section: string
  events: Array<Record<string, unknown>>
}

export interface AppealTimeline {
  appealId: string
  claimId?: string
  denialId?: string
  status?: string
  packetStatus?: string
  sections: AppealTimelineSection[]
  events: Array<Record<string, unknown>>
}

export interface AppealDashboardSummary {
  openAppeals: number
  appealsAwaitingPacket: number
  appealsReadyForSubmission: number
  appealsUnderReview: number
  appealsAwaitingMoreInfo: number
  appealsSubmitted: number
  appealsNearDeadline: number
  appealsPastDue: number
  slaViolations: number
  appealsOverturned: number
  appealsPartiallyOverturned: number
  appealsUpheld: number
  appealSuccessRate: number
  averageDaysToDecision: number
  appealRecoveryAmount: number
}

export interface AppealDashboard {
  summary: AppealDashboardSummary
  byStatus: Record<string, number>
  generatedAt: string | Date
}
