export interface ArWorkItemFollowUpHistory {
  followUpDate?: string | Date
  followUpType?: string
  notes?: string
  performedBy?: string
}

export interface ArWorkItemContactHistory {
  contactDate?: string | Date
  contactType?: string
  contactName?: string
  outcome?: string
  notes?: string
  performedBy?: string
}

export interface ArWorkItem {
  _id: string
  arWorkItemId: string
  claimId?: string
  claimLineId?: string
  denialId?: string
  appealId?: string
  correctedClaimId?: string
  paymentPostingId?: string
  patientId?: string
  payerId?: string
  category?: string
  balanceAmount?: number
  expectedAmount?: number
  paidAmount?: number
  varianceAmount?: number
  agingBucket?: string
  denialCode?: string
  denialCategory?: string
  priority?: string
  status?: string
  owner?: string
  followUpDate?: string | Date
  dueDate?: string | Date
  reason?: string
  nextAction?: string
  notes?: string
  assignedTo?: string
  team?: string
  rootCauseAnalysis?: string
  suggestedFix?: string
  aiPriorityAnalysis?: Record<string, unknown>
  aiRecommendationHistory?: Array<Record<string, unknown>>
  nextFollowUpDate?: string | Date
  appealRequired: boolean
  correctedClaimRequired: boolean
  escalationFlag: boolean
  followUpHistory: ArWorkItemFollowUpHistory[]
  contactHistory: ArWorkItemContactHistory[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ArWorkItemFollowUpHistoryFormValues {
  followUpDate: Date | null
  followUpType: string
  notes: string
  performedBy: string
}

export interface ArWorkItemFormValues {
  _id?: string
  claimId: string
  claimLineId: string
  denialId: string
  appealId: string
  correctedClaimId: string
  paymentPostingId: string
  patientId: string
  payerId: string
  category: string
  balanceAmount: number | null
  expectedAmount: number | null
  paidAmount: number | null
  varianceAmount: number | null
  agingBucket: string
  denialCode: string
  denialCategory: string
  priority: string
  status: string
  owner: string
  followUpDate: Date | null
  dueDate: Date | null
  reason: string
  nextAction: string
  notes: string
  assignedTo: string
  team: string
  rootCauseAnalysis: string
  suggestedFix: string
  nextFollowUpDate: Date | null
  appealRequired: boolean
  correctedClaimRequired: boolean
  escalationFlag: boolean
  followUpHistory: ArWorkItemFollowUpHistoryFormValues[]
  contactHistory: ArWorkItemContactHistory[]
  active: boolean
}

export interface ArWorkItemCreatePayload {
  claimId?: string
  claimLineId?: string
  denialId?: string
  appealId?: string
  correctedClaimId?: string
  paymentPostingId?: string
  patientId?: string
  payerId?: string
  category?: string
  balanceAmount?: number
  expectedAmount?: number
  paidAmount?: number
  varianceAmount?: number
  agingBucket?: string
  denialCode?: string
  denialCategory?: string
  priority?: string
  status?: string
  owner?: string
  followUpDate?: Date
  dueDate?: Date
  reason?: string
  nextAction?: string
  notes?: string
  assignedTo?: string
  team?: string
  rootCauseAnalysis?: string
  suggestedFix?: string
  nextFollowUpDate?: Date
  appealRequired: boolean
  correctedClaimRequired: boolean
  escalationFlag: boolean
  followUpHistory?: ArWorkItemFollowUpHistory[]
  contactHistory?: ArWorkItemContactHistory[]
  active: boolean
}

export type ArWorkItemUpdatePayload = ArWorkItemCreatePayload
