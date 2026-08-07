import type { BaseEntity } from './common'

export interface CoverageRule extends BaseEntity {
  coverageRuleId: string
  payerId?: string
  planName?: string
  groupNumber?: string
  state?: string
  facilityId?: string
  providerId?: string
  cptCode?: string
  diagnosisCodes?: string[]
  placeOfServiceCode?: string
  network?: string
  coverageType?: string
  ruleType: string
  severity?: string
  ruleValue?: Record<string, unknown> | string | number | boolean
  effectiveDate?: string
  expiryDate?: string
  priority?: number
  activeFlag?: boolean
  active: boolean
}

export interface CoverageRuleFormValues {
  payerId: string
  planName: string
  groupNumber: string
  state: string
  facilityId: string
  providerId: string
  cptCode: string
  diagnosisCodes: string[]
  placeOfServiceCode: string
  network: string
  coverageType: string
  ruleType: string
  severity: string
  ruleValue: string
  effectiveDate: string | Date | null
  expiryDate: string | Date | null
  priority: number
  activeFlag: boolean
  active: boolean
}

export interface CoverageRuleCreatePayload {
  payerId?: string
  planName?: string
  groupNumber?: string
  state?: string
  facilityId?: string
  providerId?: string
  cptCode?: string
  diagnosisCodes?: string[]
  placeOfServiceCode?: string
  network?: string
  coverageType?: string
  ruleType: string
  severity?: string
  ruleValue?: Record<string, unknown> | string | number | boolean
  effectiveDate?: string
  expiryDate?: string
  priority?: number
  activeFlag?: boolean
  active?: boolean
}

export type CoverageRuleUpdatePayload = Partial<CoverageRuleCreatePayload>

export interface CoverageRuleEvaluationPayload {
  payerId?: string
  patientId?: string
  insurancePolicyId?: string
  providerId?: string
  facilityId?: string
  state?: string
  cptCode?: string
  diagnosisCodes?: string[]
  modifiers?: string[]
  posCode?: string
  serviceDate?: string
  planName?: string
  groupNumber?: string
  network?: string
  coverageType?: string
  eligibilityVerificationId?: string
}

export interface CoverageRuleEvaluationResult {
  covered: boolean
  authorizationRequired: boolean
  referralRequired: boolean
  warnings: string[]
  errors: string[]
  matchedRules: Array<Record<string, unknown>>
}
