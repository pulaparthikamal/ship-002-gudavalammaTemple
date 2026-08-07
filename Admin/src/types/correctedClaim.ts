export interface CorrectedClaim {
  _id: string
  correctedClaimId: string
  originalClaimId?: string
  denialId?: string
  sourceDenialId?: string
  correctedFromClaimId?: string
  clonedClaimId?: string
  correctionReason?: string
  correctionType?: string
  frequencyCode?: string
  resubmissionReason?: string
  correctedFrequencyCode?: string
  correctedClaimStatus?: string
  correctedFieldsChanged?: string[]
  correctedFields?: Array<Record<string, unknown>>
  lineageChain?: string[]
  correctionAudit?: Array<Record<string, unknown>>
  submittedDate?: string | Date
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface CorrectedClaimFormValues {
  _id?: string
  originalClaimId: string
  denialId: string
  sourceDenialId: string
  correctedFromClaimId: string
  clonedClaimId: string
  correctionReason: string
  correctionType: string
  frequencyCode: string
  resubmissionReason: string
  correctedFrequencyCode: string
  correctedClaimStatus: string
  correctedFieldsChanged: string
  submittedDate: Date | null
  notes: string
  active: boolean
}

export interface CorrectedClaimCreatePayload {
  originalClaimId?: string
  denialId?: string
  sourceDenialId?: string
  correctedFromClaimId?: string
  clonedClaimId?: string
  correctionReason?: string
  correctionType?: string
  frequencyCode?: string
  resubmissionReason?: string
  correctedFrequencyCode?: string
  correctedClaimStatus?: string
  correctedFieldsChanged?: string[]
  submittedDate?: Date
  notes?: string
  active: boolean
}

export type CorrectedClaimUpdatePayload = CorrectedClaimCreatePayload
