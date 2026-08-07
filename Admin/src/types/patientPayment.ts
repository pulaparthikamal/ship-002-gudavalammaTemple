export interface PatientPayment {
  _id: string
  patientPaymentId: string
  patientId?: string
  patientBillingId?: string
  claimId?: string
  claimLineId?: string
  paymentDate?: string | Date
  paymentMethod?: string
  amount?: number
  appliedAmount?: number
  overpaymentAmount?: number
  referenceNumber?: string
  receiptNumber?: string
  receiptMetadata?: Record<string, unknown>
  paymentStatus?: string
  collectedAtFrontDesk: boolean
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

export interface PatientPaymentFormValues {
  _id?: string
  patientId: string
  patientBillingId: string
  claimId: string
  claimLineId: string
  paymentDate: Date | null
  paymentMethod: string
  amount: number | null
  appliedAmount: number | null
  overpaymentAmount: number | null
  referenceNumber: string
  receiptNumber: string
  paymentStatus: string
  collectedAtFrontDesk: boolean
  notes: string
  active: boolean
}

export interface PatientPaymentCreatePayload {
  patientId?: string
  patientBillingId?: string
  claimId?: string
  claimLineId?: string
  paymentDate?: Date
  paymentMethod?: string
  amount?: number
  appliedAmount?: number
  overpaymentAmount?: number
  referenceNumber?: string
  receiptNumber?: string
  receiptMetadata?: Record<string, unknown>
  paymentStatus?: string
  collectedAtFrontDesk: boolean
  notes?: string
  active: boolean
}

export type PatientPaymentUpdatePayload = PatientPaymentCreatePayload
