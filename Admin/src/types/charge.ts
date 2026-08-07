export interface ChargeChargeLine {
  _id?: string
  lineNumber?: number
  cptCode?: string
  icdCodes?: string[]
  icdPointers?: number[]
  modifiers?: string[]
  units?: number
  chargeAmount?: number
  diagnosisLinking?: string
  renderingProviderId?: string
  expectedAllowedAmount?: number
  feeScheduleId?: string
  pricingStatus?: string
  pricingMessage?: string
  pricingMatchedBy?: string
  pricingSource?: string
}

export interface Charge {
  _id: string
  chargeId: string
  encounterId?: string
  patientId?: string
  providerId?: string
  facilityId?: string
  serviceDate?: string | Date
  placeOfService?: string
  totalChargeAmount?: number
  chargeStatus?: string
  codingReviewStatus?: string
  documentationComplete: boolean
  validationErrors?: string[]
  createdBy?: string
  reviewedBy?: string
  chargeLines: ChargeChargeLine[]
  active: boolean
  createdAt: string
  updatedAt: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ChargeChargeLineFormValues {
  lineNumber: number | null
  cptCode: string
  icdCodes: string
  icdPointers: string
  modifiers: string
  units: number | null
  chargeAmount: number | null
  diagnosisLinking: string
  renderingProviderId: string
}

export interface ChargeFormValues {
  _id?: string
  encounterId: string
  patientId: string
  providerId: string
  facilityId: string
  serviceDate: Date | null
  placeOfService: string
  totalChargeAmount: number | null
  chargeStatus: string
  codingReviewStatus: string
  documentationComplete: boolean
  validationErrors: string
  createdBy: string
  reviewedBy: string
  chargeLines: ChargeChargeLineFormValues[]
  active: boolean
}

export interface ChargeCreatePayload {
  encounterId?: string
  patientId?: string
  providerId?: string
  facilityId?: string
  serviceDate?: Date
  placeOfService?: string
  totalChargeAmount?: number
  chargeStatus?: string
  codingReviewStatus?: string
  documentationComplete: boolean
  validationErrors?: string[]
  createdBy?: string
  reviewedBy?: string
  chargeLines?: ChargeChargeLine[]
  active: boolean
}

export type ChargeUpdatePayload = ChargeCreatePayload
