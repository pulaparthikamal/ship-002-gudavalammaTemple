export interface EraEobProcessing {
  _id: string
  eraId: string
  payerId?: string
  payerName?: string
  paymentId?: string
  eraReceived: boolean
  eraFileReference?: string
  eraBatchId?: string
  depositId?: string
  raw835FileReference?: string
  rawPayloadRedacted?: string
  rawPayloadStored?: boolean
  checkNumber?: string
  paymentTraceNumber?: string
  paymentMethod?: string
  paymentDate?: string | Date
  totalAmount?: number
  totalPaymentAmount?: number
  depositAmount?: number
  postedAmount?: number
  claimPaidAmount?: number
  serviceLinePaidAmount?: number
  adjustmentTotal?: number
  patientResponsibilityTotal?: number
  unmatchedAmount?: number
  reconciliationStatus?: 'RECEIVED' | 'PARSED' | 'POSTED' | 'PARTIALLY_POSTED' | 'RECONCILED' | 'EXCEPTION'
  accountingLocked?: boolean
  accountingLockedAt?: string | Date
  accountingLockedBy?: string
  accountingLockReason?: string
  accountingUnlockedAt?: string | Date
  accountingUnlockedBy?: string
  accountingUnlockReason?: string
  exceptionReason?: string
  receivedDate?: string | Date
  importStatus?: string
  parsedStatus?: string
  fileMetadata?: Record<string, unknown>
  matchedClaims?: Array<Record<string, unknown>>
  unmatchedClaims?: Array<Record<string, unknown>>
  parseErrors?: string[]
  importErrors?: string[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface EraEobProcessingFormValues {
  _id?: string
  payerId: string
  payerName: string
  paymentId: string
  eraReceived: boolean
  eraFileReference: string
  eraBatchId: string
  depositId: string
  raw835FileReference: string
  rawPayloadRedacted: string
  checkNumber: string
  paymentTraceNumber: string
  paymentMethod: string
  paymentDate: Date | null
  totalAmount: number | null
  totalPaymentAmount: number | null
  depositAmount: number | null
  postedAmount: number | null
  claimPaidAmount: number | null
  serviceLinePaidAmount: number | null
  adjustmentTotal: number | null
  patientResponsibilityTotal: number | null
  unmatchedAmount: number | null
  reconciliationStatus: string
  accountingLocked: boolean
  accountingLockedAt: Date | null
  accountingLockedBy: string
  accountingLockReason: string
  exceptionReason: string
  receivedDate: Date | null
  importStatus: string
  parsedStatus: string
  parseErrors: string
  importErrors: string
  active: boolean
}

export interface EraEobProcessingCreatePayload {
  payerId?: string
  payerName?: string
  paymentId?: string
  eraReceived: boolean
  eraFileReference?: string
  eraBatchId?: string
  depositId?: string
  raw835FileReference?: string
  rawPayloadRedacted?: string
  checkNumber?: string
  paymentTraceNumber?: string
  paymentMethod?: string
  paymentDate?: Date
  totalAmount?: number
  totalPaymentAmount?: number
  depositAmount?: number
  postedAmount?: number
  claimPaidAmount?: number
  serviceLinePaidAmount?: number
  adjustmentTotal?: number
  patientResponsibilityTotal?: number
  unmatchedAmount?: number
  reconciliationStatus?: string
  accountingLocked?: boolean
  accountingLockedAt?: Date
  accountingLockedBy?: string
  accountingLockReason?: string
  exceptionReason?: string
  receivedDate?: Date
  importStatus?: string
  parsedStatus?: string
  fileMetadata?: Record<string, unknown>
  matchedClaims?: Array<Record<string, unknown>>
  unmatchedClaims?: Array<Record<string, unknown>>
  parseErrors?: string[]
  importErrors?: string[]
  active: boolean
}

export type EraEobProcessingUpdatePayload = EraEobProcessingCreatePayload

export interface Era835ImportPayload {
  raw835Text: string
  fileMetadata?: Record<string, unknown>
  payerId?: string
  payerName?: string
  eraFileReference?: string
  receivedDate?: Date
}

export interface Era835ImportResult {
  eraEobProcessing: EraEobProcessing
  paymentPostings: unknown[]
  matchedClaims: Array<Record<string, unknown>>
  unmatchedClaims: Array<Record<string, unknown>>
  parseErrors: string[]
  importErrors: string[]
  duplicate?: boolean
}

export interface EraAccountingLockPayload {
  reason?: string
}

export interface EraAccountingUnlockPayload {
  reason: string
}
