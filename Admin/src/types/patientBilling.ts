export interface PatientBilling {
  _id: string
  patientBillingId: string
  patientId?: string
  chargeId?: string
  encounterId?: string
  claimId?: string
  paymentPostingId?: string
  statementNumber?: string
  statementDate?: string | Date
  statementCycle?: string
  billingCycle?: string
  originalBalance?: number
  currentBalance?: number
  insurancePaid?: number
  adjustments?: number
  patientPayments?: number
  patientBalance?: number
  amountPaid?: number
  amountDue?: number
  dueDate?: string | Date
  lastStatementSent?: string | Date
  collectionsFlag: boolean
  writeOffFlag: boolean
  refundFlag: boolean
  refundAmount?: number
  creditBalanceAmount?: number
  paymentPlanId?: string
  statementStatus?: string
  status?: string
  agingBucket?: string
  lineItems: PatientBillingLineItem[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface PatientBillingLineItem {
  claimLineId?: string
  procedureCode?: string
  serviceDate?: string | Date
  description?: string
  allowedAmount?: number
  insurancePaid?: number
  adjustments?: number
  patientResponsibility?: number
}

export interface PatientBillingFormValues {
  _id?: string
  patientId: string
  claimId: string
  paymentPostingId: string
  statementNumber: string
  statementDate: Date | null
  statementCycle: string
  billingCycle: string
  originalBalance: number | null
  currentBalance: number | null
  insurancePaid: number | null
  adjustments: number | null
  patientPayments: number | null
  patientBalance: number | null
  amountPaid: number | null
  amountDue: number | null
  dueDate: Date | null
  lastStatementSent: Date | null
  collectionsFlag: boolean
  writeOffFlag: boolean
  refundFlag: boolean
  refundAmount: number | null
  creditBalanceAmount: number | null
  paymentPlanId: string
  statementStatus: string
  status: string
  agingBucket: string
  lineItems: PatientBillingLineItem[]
  active: boolean
}

export interface PatientBillingCreatePayload {
  patientId?: string
  chargeId?: string
  encounterId?: string
  claimId?: string
  paymentPostingId?: string
  statementNumber?: string
  statementDate?: Date
  statementCycle?: string
  billingCycle?: string
  originalBalance?: number
  currentBalance?: number
  insurancePaid?: number
  adjustments?: number
  patientPayments?: number
  patientBalance?: number
  amountPaid?: number
  amountDue?: number
  dueDate?: Date
  lastStatementSent?: Date
  collectionsFlag: boolean
  writeOffFlag: boolean
  refundFlag: boolean
  refundAmount?: number
  creditBalanceAmount?: number
  paymentPlanId?: string
  statementStatus?: string
  status?: string
  agingBucket?: string
  lineItems?: PatientBillingLineItem[]
  active: boolean
}

export type PatientBillingUpdatePayload = PatientBillingCreatePayload
