export interface AppointmentReferral {
  required: boolean
  referralNumber?: string
  validFrom?: string | Date
  validTo?: string | Date
}

export interface AppointmentEstimate {
  estimatedPatientResponsibility?: number
  depositAmount?: number
  depositCollected: boolean
}

export interface Appointment {
  _id: string
  appointmentId: string
  patientId?: string
  providerId?: string
  facilityId?: string
  appointmentDate?: string | Date
  appointmentTime?: string
  appointmentStart?: string | Date
  appointmentType?: string
  visitType?: string
  reason?: string
  appointmentStatus?: string
  checkInStatus?: string
  checkInTime?: string | Date
  checkOutTime?: string | Date
  noShowFlag: boolean
  cancellationReason?: string
  notes?: string
  referral: AppointmentReferral
  estimate: AppointmentEstimate
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface AppointmentReferralFormValues {
  required: boolean
  referralNumber: string
  validFrom: Date | null
  validTo: Date | null
}

export interface AppointmentEstimateFormValues {
  estimatedPatientResponsibility: number | null
  depositAmount: number | null
  depositCollected: boolean
}

export interface AppointmentFormValues {
  _id?: string
  patientId: string
  providerId: string
  facilityId: string
  appointmentDate: Date | null
  appointmentTime: string
  appointmentType: string
  visitType: string
  reason: string
  appointmentStatus: string
  checkInStatus: string
  checkInTime: Date | null
  checkOutTime: Date | null
  noShowFlag: boolean
  cancellationReason: string
  notes: string
  referral: AppointmentReferralFormValues
  estimate: AppointmentEstimateFormValues
  active: boolean
}

export interface AppointmentCreatePayload {
  patientId?: string
  providerId?: string
  facilityId?: string
  appointmentDate?: Date
  appointmentTime?: string
  appointmentType?: string
  visitType?: string
  reason?: string
  appointmentStatus?: string
  checkInStatus?: string
  checkInTime?: Date
  checkOutTime?: Date
  noShowFlag: boolean
  cancellationReason?: string
  notes?: string
  referral?: AppointmentReferral
  estimate?: AppointmentEstimate
  active: boolean
}

export type AppointmentUpdatePayload = AppointmentCreatePayload
