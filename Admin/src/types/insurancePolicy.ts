import type { AttachmentLink, AttachmentLinkFormValues } from '@/types/common'

export interface InsurancePolicySubscriber {
  firstName?: string
  lastName?: string
  dob?: string | Date
  gender?: string
  phone?: string
  email?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zipCode?: string
}

export interface InsurancePolicyCard {
  frontImageUrl?: string
  backImageUrl?: string
}

export interface InsurancePolicyVerification {
  lastVerifiedDateTime?: string | Date
  nextVerificationDueDate?: string | Date
}

export interface InsurancePolicyDependentValidation {
  status?: string
  riskScore?: number
  issues: string[]
  suggestedFixes: string[]
  source?: string
  checkedAt?: string | Date
}

export interface InsurancePolicy {
  _id: string
  insuranceId: string
  patientId?: string
  payerId?: string
  ediPayerId?: string
  payerType?: string
  coverageType?: string
  planName?: string
  memberId?: string
  subscriberId?: string
  groupNumber?: string
  dependentNumber?: string
  coveragePriority?: string
  coordinationOfBenefitsOrder?: number
  network?: string
  effectiveDate?: string | Date
  terminationDate?: string | Date
  policyStatus?: string
  relationshipToSubscriber?: string
  insuranceVerifiedFlag: boolean
  subscriber: InsurancePolicySubscriber
  card: InsurancePolicyCard
  verification: InsurancePolicyVerification
  dependentValidation: InsurancePolicyDependentValidation
  attachments: AttachmentLink[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface InsurancePolicySubscriberFormValues {
  firstName: string
  lastName: string
  dob: Date | null
  gender: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
}

export interface InsurancePolicyCardFormValues {
  frontImageUrl: string
  backImageUrl: string
}

export interface InsurancePolicyVerificationFormValues {
  lastVerifiedDateTime: Date | null
  nextVerificationDueDate: Date | null
}

export interface InsurancePolicyFormValues {
  _id?: string
  patientId: string
  payerId: string
  ediPayerId: string
  payerType: string
  coverageType: string
  planName: string
  memberId: string
  subscriberId: string
  groupNumber: string
  dependentNumber: string
  coveragePriority: string
  network: string
  effectiveDate: Date | null
  terminationDate: Date | null
  policyStatus: string
  relationshipToSubscriber: string
  insuranceVerifiedFlag: boolean
  subscriber: InsurancePolicySubscriberFormValues
  card: InsurancePolicyCardFormValues
  verification: InsurancePolicyVerificationFormValues
  attachments: AttachmentLinkFormValues[]
  active: boolean
}

export interface InsurancePolicyCreatePayload {
  patientId: string
  payerId: string
  ediPayerId?: string
  payerType?: string
  coverageType: string
  planName: string
  memberId: string
  subscriberId?: string
  groupNumber?: string
  dependentNumber?: string
  coveragePriority: string
  coordinationOfBenefitsOrder?: number
  network?: string
  effectiveDate?: Date
  terminationDate?: Date
  policyStatus: string
  relationshipToSubscriber: string
  insuranceVerifiedFlag: boolean
  subscriber?: InsurancePolicySubscriber
  card?: InsurancePolicyCard
  verification?: InsurancePolicyVerification
  attachments?: AttachmentLink[]
  active: boolean
}

export type InsurancePolicyUpdatePayload = InsurancePolicyCreatePayload
