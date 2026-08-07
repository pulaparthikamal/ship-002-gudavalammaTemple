export interface ChargeMaster {
  _id: string
  chargeMasterId: string
  cptCode?: string
  description?: string
  revenueCode?: string
  defaultChargeAmount?: number
  defaultAllowedAmount?: number
  placeOfService?: string
  modifiersAllowed?: string[]
  diagnosisRestrictions?: string[]
  effectiveDate?: string | Date
  terminationDate?: string | Date
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

export interface ChargeMasterFormValues {
  _id?: string
  cptCode: string
  description: string
  revenueCode: string
  defaultChargeAmount: number | null
  defaultAllowedAmount: number | null
  placeOfService: string
  modifiersAllowed: string
  diagnosisRestrictions: string
  effectiveDate: Date | null
  terminationDate: Date | null
}

export interface ChargeMasterCreatePayload {
  cptCode?: string
  description?: string
  revenueCode?: string
  defaultChargeAmount?: number
  defaultAllowedAmount?: number
  placeOfService?: string
  modifiersAllowed?: string[]
  diagnosisRestrictions?: string[]
  effectiveDate?: Date
  terminationDate?: Date
  activeFlag?: boolean
  active?: boolean
}

export type ChargeMasterUpdatePayload = ChargeMasterCreatePayload
