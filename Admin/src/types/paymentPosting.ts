export interface PaymentPostingPaymentLine {
  claimLineId?: string
  serviceLineControlNumber?: string
  procedureCode?: string
  serviceDate?: string | Date
  billedAmount?: number
  paidAmount?: number
  allowedAmount?: number
  adjustmentAmount?: number
  patientRespAmount?: number
  deniedAmount?: number
  adjustmentCodes?: string[]
  remarkCodes?: string[]
}

export interface PaymentPosting {
  _id: string
  paymentId: string
  eraEobProcessingId?: string
  claimId?: string
  payerId?: string
  payerClaimNumber?: string
  claimControlNumber?: string
  paymentDate?: string | Date
  checkNumber?: string
  eftTraceNumber?: string
  paymentMethod?: string
  sourceType?: string
  idempotencyKey?: string
  receivedAmount?: number
  postedAmount?: number
  patientResponsibilityAmount?: number
  remainingBalance?: number
  postingStatus?: string
  postedBy?: string
  postedAt?: string | Date
  reversedAt?: string | Date
  reversedBy?: string
  reversalReason?: string
  financialEventId?: string
  parentFinancialEventId?: string
  reversalOfId?: string
  ledgerSequence?: number
  financialBalanceSnapshot?: Record<string, unknown>
  paymentLines: PaymentPostingPaymentLine[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface PaymentPostingPaymentLineFormValues {
  claimLineId: string
  serviceLineControlNumber: string
  procedureCode: string
  serviceDate: Date | null
  billedAmount: number | null
  paidAmount: number | null
  allowedAmount: number | null
  adjustmentAmount: number | null
  patientRespAmount: number | null
  deniedAmount: number | null
  adjustmentCodes: string
  remarkCodes: string
}

export interface PaymentPostingFormValues {
  _id?: string
  eraEobProcessingId: string
  claimId: string
  payerId: string
  payerClaimNumber: string
  claimControlNumber: string
  paymentDate: Date | null
  checkNumber: string
  eftTraceNumber: string
  paymentMethod: string
  receivedAmount: number | null
  postedAmount: number | null
  patientResponsibilityAmount: number | null
  remainingBalance: number | null
  postingStatus: string
  postedBy: string
  postedAt: Date | null
  paymentLines: PaymentPostingPaymentLineFormValues[]
  active: boolean
}

export interface PaymentPostingCreatePayload {
  eraEobProcessingId?: string
  claimId?: string
  payerId?: string
  payerClaimNumber?: string
  claimControlNumber?: string
  paymentDate?: Date
  checkNumber?: string
  eftTraceNumber?: string
  paymentMethod?: string
  receivedAmount?: number
  postedAmount?: number
  patientResponsibilityAmount?: number
  remainingBalance?: number
  postingStatus?: string
  postedBy?: string
  postedAt?: Date
  paymentLines?: PaymentPostingPaymentLine[]
  active: boolean
}

export type PaymentPostingUpdatePayload = PaymentPostingCreatePayload

export interface PaymentPostingReversePayload {
  reason: string
}
