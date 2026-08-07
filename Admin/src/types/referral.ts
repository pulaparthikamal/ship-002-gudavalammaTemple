export interface Referral {
  _id: string
  referralId: string
  patientId?: string
  appointmentId?: string
  insuranceId?: string
  facilityId?: string
  referringProviderId?: string
  referredToProviderId?: string
  payerId?: string
  referralNumber?: string
  referralType?: string
  diagnosisCodes?: string[]
  procedureCodes?: string[]
  startDate?: string | Date
  endDate?: string | Date
  referralStatus?: string
  approvedVisits?: number
  usedVisits?: number
  remainingVisits?: number
  notes?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ReferralFormValues {
  _id?: string
  patientId: string
  appointmentId: string
  insuranceId: string
  facilityId: string
  referringProviderId: string
  referredToProviderId: string
  payerId: string
  referralNumber: string
  referralType: string
  diagnosisCodes: string
  procedureCodes: string
  startDate: Date | null
  endDate: Date | null
  referralStatus: string
  approvedVisits: number | null
  usedVisits: number | null
  remainingVisits: number | null
  notes: string
  active: boolean
}

export interface ReferralCreatePayload {
  patientId?: string
  appointmentId?: string
  insuranceId?: string
  facilityId?: string
  referringProviderId?: string
  referredToProviderId?: string
  payerId?: string
  referralNumber?: string
  referralType?: string
  diagnosisCodes?: string[]
  procedureCodes?: string[]
  startDate?: Date
  endDate?: Date
  referralStatus?: string
  approvedVisits?: number
  usedVisits?: number
  remainingVisits?: number
  notes?: string
  active: boolean
}

export type ReferralUpdatePayload = ReferralCreatePayload
