export interface EncounterVital {
  temperature?: number
  bloodPressure?: string
  pulse?: number
  height?: number
  weight?: number
  bmi?: number
}

export interface EncounterCheckout {
  checkOutTime?: string | Date
  followUpRequired: boolean
  balanceDue?: number
  followUpInstructions?: string
}

export interface Encounter {
  _id: string
  encounterId: string
  appointmentId?: string
  patientId?: string
  providerId?: string
  renderingProviderId?: string
  supervisingProviderId?: string
  facilityId?: string
  encounterDate?: string | Date
  startTime?: string | Date
  endTime?: string | Date
  visitStatus?: string
  chiefComplaint?: string
  historyOfPresentIllness?: string
  clinicalNotes?: string
  diagnosisCodes?: string[]
  procedureCodes?: string[]
  procedureCodeUnits?: Record<string, number>
  vitals: EncounterVital
  checkout: EncounterCheckout
  estimate?: {
    estimatedPatientResponsibility?: number
    estimatedInsurancePayment?: number
    estimatedAllowedAmount?: number
    lastEstimatedAt?: string | Date
  }
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface EncounterAiSuggestedCode {
  code: string
  description: string
  confidence: number
  reasoning: string
  units?: number
}

export interface EncounterAiSuggestions {
  status: string
  summary?: string
  diagnosisCodes: EncounterAiSuggestedCode[]
  procedureCodes: EncounterAiSuggestedCode[]
  suggestedFixes: string[]
  appliedDiagnosisCodes: string[]
  appliedProcedureCodes: string[]
  applySuggestions: boolean
  replaceExistingCodes: boolean
}

export interface EncounterAiSuggestionResult {
  encounter: Encounter
  suggestions: EncounterAiSuggestions
}

export interface EncounterVitalFormValues {
  temperature: number | null
  bloodPressure: string
  pulse: number | null
  height: number | null
  weight: number | null
  bmi: number | null
}

export interface EncounterCheckoutFormValues {
  checkOutTime: Date | null
  followUpRequired: boolean
  balanceDue: number | null
  followUpInstructions: string
}

export interface EncounterFormValues {
  _id?: string
  appointmentId: string
  patientId: string
  providerId: string
  renderingProviderId: string
  supervisingProviderId: string
  facilityId: string
  encounterDate: Date | null
  startTime: Date | null
  endTime: Date | null
  visitStatus: string
  chiefComplaint: string
  historyOfPresentIllness: string
  clinicalNotes: string
  diagnosisCodes: string
  procedureCodes: string
  procedureCodeUnits: Record<string, number>
  vitals: EncounterVitalFormValues
  checkout: EncounterCheckoutFormValues
  active: boolean
}

export interface EncounterCreatePayload {
  appointmentId?: string
  patientId?: string
  providerId?: string
  renderingProviderId?: string
  supervisingProviderId?: string
  facilityId?: string
  encounterDate?: Date
  startTime?: Date
  endTime?: Date
  visitStatus?: string
  chiefComplaint?: string
  historyOfPresentIllness?: string
  clinicalNotes?: string
  diagnosisCodes?: string[]
  procedureCodes?: string[]
  procedureCodeUnits?: Record<string, number>
  vitals?: EncounterVital
  checkout?: EncounterCheckout
  estimate?: {
    estimatedPatientResponsibility?: number
    estimatedInsurancePayment?: number
    estimatedAllowedAmount?: number
    lastEstimatedAt?: Date
  }
  active: boolean
}

export type EncounterUpdatePayload = EncounterCreatePayload

export interface EncounterSuggestAiCodesPayload {
  applySuggestions?: boolean
  replaceExistingCodes?: boolean
  appointmentId?: string
  patientId?: string
  providerId?: string
  renderingProviderId?: string
  supervisingProviderId?: string
  facilityId?: string
  encounterDate?: Date
  startTime?: Date
  endTime?: Date
  visitStatus?: string
  chiefComplaint?: string
  historyOfPresentIllness?: string
  clinicalNotes?: string
  diagnosisCodes?: string[]
  procedureCodes?: string[]
  procedureCodeUnits?: Record<string, number>
  vitals?: EncounterVital
  checkout?: EncounterCheckout
  active?: boolean
}
