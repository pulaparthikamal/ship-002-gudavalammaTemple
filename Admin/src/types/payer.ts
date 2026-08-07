export interface Payer {
  _id: string
  payerId?: string
  payerName?: string
  ediPayerId?: string
  payerType?: string
  claimsSubmissionMethod?: string
  eligibilityApiSupported: boolean
  authPortalUrl?: string
  payerAddressLine1?: string
  payerAddressLine2?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  timelyFilingDays?: number
  appealTimelyFilingDays?: number
  activeFlag: boolean
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface PayerFormValues {
  _id?: string
  payerId: string
  payerName: string
  ediPayerId: string
  payerType: string
  claimsSubmissionMethod: string
  eligibilityApiSupported: boolean
  authPortalUrl: string
  payerAddressLine1: string
  payerAddressLine2: string
  city: string
  state: string
  zipCode: string
  phone: string
  timelyFilingDays: number | null
  appealTimelyFilingDays: number | null
  activeFlag: boolean
  active: boolean
}

export interface PayerCreatePayload {
  payerId?: string
  payerName?: string
  ediPayerId?: string
  payerType?: string
  claimsSubmissionMethod?: string
  eligibilityApiSupported: boolean
  authPortalUrl?: string
  payerAddressLine1?: string
  payerAddressLine2?: string
  city?: string
  state?: string
  zipCode?: string
  phone?: string
  timelyFilingDays?: number
  appealTimelyFilingDays?: number
  activeFlag: boolean
  active: boolean
}

export type PayerUpdatePayload = PayerCreatePayload
