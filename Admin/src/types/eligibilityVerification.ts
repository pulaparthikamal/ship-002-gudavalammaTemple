export interface EligibilityVerification {
  _id: string
  eligibilityId: string
  appointmentId?: string
  patientId?: string
  insuranceId?: string
  payerId?: string
  serviceTypeCode?: string
  serviceTypeCodes?: string[]
  serviceDate?: string | Date
  coveragePriority?: string
  procedureCodes?: string[]
  correlationId?: string
  externalVerificationId?: string
  vendorName?: string
  eligibilityStatus?: string
  coverageStatus?: string
  planActive: boolean
  copayAmount?: number
  coinsurancePercent?: number
  deductibleRemaining?: number
  outOfPocketRemaining?: number
  referralRequired: boolean
  authorizationRequired: boolean
  benefitNotes?: string
  checkedBy?: string
  checkedAt?: string | Date
  verificationSource?: string
  rawResponseReference?: string
  responseStatusCode?: number
  rawRequestPayload?: Record<string, unknown>
  rawResponsePayload?: Record<string, unknown>
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface EligibilityVerificationFormValues {
  _id?: string
  appointmentId: string
  patientId: string
  insuranceId: string
  payerId: string
  serviceTypeCode: string
  serviceDate: Date | null
  coveragePriority: string
  eligibilityStatus: string
  coverageStatus: string
  planActive: boolean
  copayAmount: number | null
  coinsurancePercent: number | null
  deductibleRemaining: number | null
  outOfPocketRemaining: number | null
  referralRequired: boolean
  authorizationRequired: boolean
  benefitNotes: string
  checkedBy: string
  checkedAt: Date | null
  verificationSource: string
  rawResponseReference: string
  active: boolean
}

export interface EligibilityVerificationCreatePayload {
  appointmentId?: string
  insuranceId?: string
  serviceTypeCode?: string
  serviceDate?: Date
  coveragePriority?: string
  eligibilityStatus?: string
  coverageStatus?: string
  planActive: boolean
  copayAmount?: number
  coinsurancePercent?: number
  deductibleRemaining?: number
  outOfPocketRemaining?: number
  referralRequired: boolean
  authorizationRequired: boolean
  benefitNotes?: string
  verificationSource?: string
  rawResponseReference?: string
  active: boolean
}

export type EligibilityVerificationUpdatePayload = EligibilityVerificationCreatePayload

export interface EligibilityVerificationRunFormValues {
  appointmentId?: string
  providerId?: string
  facilityId?: string
  insuranceId: string
  serviceTypeCode: string
  serviceDate?: Date | null
  coveragePriority?: string
  procedureCodesText: string
}

export interface EligibilityVerificationRunPayload {
  appointmentId?: string
  providerId?: string
  facilityId?: string
  insuranceId: string
  serviceTypeCode?: string
  serviceDate?: Date | string
  coveragePriority?: string
  procedureCodes?: string[]
}
