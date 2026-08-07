import type { AttachmentLink, AttachmentLinkFormValues } from '@/types/common'

export interface PatientAddress {
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zipCode?: string
  country?: string
}

export interface PatientGuarantor {
  firstName?: string
  lastName?: string
  relationshipToPatient?: string
  phone?: string
  email?: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zipCode?: string
}

export interface PatientEmergencyContact {
  firstName?: string
  lastName?: string
  relationship?: string
  phone?: string
  email?: string
}

export interface Patient {
  _id: string
  patientId: string
  medicalRecordNumber: string
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  dateOfBirth: string
  gender: string
  sex?: string
  maritalStatus?: string
  mobileNumber?: string
  alternatePhoneNumber?: string
  email?: string
  preferredLanguage?: string
  interpreterRequired: boolean
  race?: string
  ethnicity?: string
  patientStatus: string
  ssnLast4?: string
  employmentStatus?: string
  employerName?: string
  preferredCommunicationMethod?: string
  deceased: boolean
  dateOfDeath?: string | null
  consentToText: boolean
  consentToCall: boolean
  consentToEmail: boolean
  hipaaConsentSigned: boolean
  financialConsentSigned: boolean
  address: PatientAddress
  guarantor: PatientGuarantor
  emergencyContacts: PatientEmergencyContact[]
  attachments: AttachmentLink[]
  duplicateCheckFlag: boolean
  mergeRequiredFlag: boolean
  duplicateOfPatientId?: string
  mergedIntoPatientId?: string
  mergedAt?: string | null
  mergeNotes?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface PatientAddressFormValues {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface PatientGuarantorFormValues {
  firstName: string
  lastName: string
  relationshipToPatient: string
  phone: string
  email: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zipCode: string
}

export interface PatientEmergencyContactFormValues {
  firstName: string
  lastName: string
  relationship: string
  phone: string
  email: string
}

export interface PatientFormValues {
  _id?: string
  medicalRecordNumber: string
  firstName: string
  middleName: string
  lastName: string
  suffix: string
  dateOfBirth: Date | null
  gender: string
  sex: string
  maritalStatus: string
  mobileNumber: string
  alternatePhoneNumber: string
  email: string
  preferredLanguage: string
  interpreterRequired: boolean
  race: string
  ethnicity: string
  patientStatus: string
  ssnLast4: string
  employmentStatus: string
  employerName: string
  preferredCommunicationMethod: string
  deceased: boolean
  dateOfDeath: Date | null
  consentToText: boolean
  consentToCall: boolean
  consentToEmail: boolean
  hipaaConsentSigned: boolean
  financialConsentSigned: boolean
  address: PatientAddressFormValues
  guarantor: PatientGuarantorFormValues
  emergencyContacts: PatientEmergencyContactFormValues[]
  attachments: AttachmentLinkFormValues[]
  duplicateCheckFlag: boolean
  mergeRequiredFlag: boolean
  active: boolean
}

export interface PatientCreatePayload {
  medicalRecordNumber: string
  firstName: string
  middleName?: string
  lastName: string
  suffix?: string
  dateOfBirth: Date
  gender: string
  sex?: string
  maritalStatus?: string
  mobileNumber?: string
  alternatePhoneNumber?: string
  email?: string
  preferredLanguage?: string
  interpreterRequired: boolean
  race?: string
  ethnicity?: string
  patientStatus: string
  ssnLast4?: string
  employmentStatus?: string
  employerName?: string
  preferredCommunicationMethod?: string
  deceased: boolean
  dateOfDeath?: Date
  consentToText: boolean
  consentToCall: boolean
  consentToEmail: boolean
  hipaaConsentSigned: boolean
  financialConsentSigned: boolean
  address?: PatientAddress
  guarantor?: PatientGuarantor
  emergencyContacts?: PatientEmergencyContact[]
  attachments?: AttachmentLink[]
  duplicateCheckFlag: boolean
  mergeRequiredFlag: boolean
  active: boolean
}

export type PatientUpdatePayload = PatientCreatePayload
