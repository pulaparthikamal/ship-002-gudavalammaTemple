import type { BaseEntity } from './common'

export interface FeeSchedule extends BaseEntity {
  feeScheduleId: string
  payerId: string
  cptCode: string
  modifiers?: string[]
  providerId?: string
  facilityId?: string
  state?: string
  placeOfServiceCode?: string
  planName?: string
  groupNumber?: string
  network?: string
  coverageType?: string
  allowedAmount: number
  effectiveDate?: string
  expiryDate?: string
  active: boolean
}

export interface FeeScheduleFormValues {
  payerId: string
  cptCode: string
  modifiers?: string[]
  providerId?: string
  facilityId?: string
  state?: string
  placeOfServiceCode?: string
  planName?: string
  groupNumber?: string
  network?: string
  coverageType?: string
  allowedAmount: number
  effectiveDate?: string | Date | null
  expiryDate?: string | Date | null
  active: boolean
}

export interface FeeScheduleCreatePayload extends Omit<FeeScheduleFormValues, 'effectiveDate' | 'expiryDate'> {
  effectiveDate?: string
  expiryDate?: string
}
export interface FeeScheduleUpdatePayload extends Partial<FeeScheduleCreatePayload> {}

export interface FeeScheduleLookupPayload {
  payerId: string
  providerId?: string
  facilityId?: string
  state?: string
  placeOfServiceCode?: string
  cptCode: string
  modifiers?: string[]
  planName?: string
  groupNumber?: string
  network?: string
  coverageType?: string
  serviceDate?: string
}

export interface FeeScheduleLookupResult {
  allowedAmount: number
  feeScheduleId: string
  matchedBy: string
  source: 'CONTRACT_RATE'
  confidence: number
  effectiveDate?: string
  expiryDate?: string
}
