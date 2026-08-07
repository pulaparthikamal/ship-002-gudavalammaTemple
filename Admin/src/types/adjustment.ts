export interface Adjustment {
  _id: string
  adjustmentId: string
  claimId?: string
  claimLineId?: string
  adjustmentType?: string
  adjustmentGroupCode?: string
  adjustmentReasonCode?: string
  adjustmentAmount?: number
  writeOffFlag: boolean
  approvedBy?: string
  adjustmentDate?: string | Date
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

export interface AdjustmentFormValues {
  _id?: string
  claimId: string
  claimLineId: string
  adjustmentType: string
  adjustmentGroupCode: string
  adjustmentReasonCode: string
  adjustmentAmount: number | null
  writeOffFlag: boolean
  approvedBy: string
  adjustmentDate: Date | null
  notes: string
  active: boolean
}

export interface AdjustmentCreatePayload {
  claimId?: string
  claimLineId?: string
  adjustmentType?: string
  adjustmentGroupCode?: string
  adjustmentReasonCode?: string
  adjustmentAmount?: number
  writeOffFlag: boolean
  approvedBy?: string
  adjustmentDate?: Date
  notes?: string
  active: boolean
}

export type AdjustmentUpdatePayload = AdjustmentCreatePayload
