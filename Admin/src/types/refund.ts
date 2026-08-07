export interface Refund {
  _id: string
  refundId: string
  patientId?: string
  claimId?: string
  patientBillingId?: string
  patientPaymentId?: string
  refundType?: string
  refundReason?: string
  refundAmount?: number
  refundMethod?: string
  requestedDate?: string | Date
  approvedDate?: string | Date
  processedDate?: string | Date
  refundStatus?: string
  approvedBy?: string
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

export interface RefundFormValues {
  _id?: string
  patientId: string
  claimId: string
  patientBillingId: string
  patientPaymentId: string
  refundType: string
  refundReason: string
  refundAmount: number | null
  refundMethod: string
  requestedDate: Date | null
  approvedDate: Date | null
  processedDate: Date | null
  refundStatus: string
  approvedBy: string
  notes: string
  active: boolean
}

export interface RefundCreatePayload {
  patientId?: string
  claimId?: string
  patientBillingId?: string
  patientPaymentId?: string
  refundType?: string
  refundReason?: string
  refundAmount?: number
  refundMethod?: string
  requestedDate?: Date
  approvedDate?: Date
  processedDate?: Date
  refundStatus?: string
  approvedBy?: string
  notes?: string
  active: boolean
}

export type RefundUpdatePayload = RefundCreatePayload
