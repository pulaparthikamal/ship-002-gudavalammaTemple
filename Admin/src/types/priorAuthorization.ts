export interface PriorAuthorization {
  _id: string
  authorizationId: string
  patientId?: string
  insuranceId?: string
  payerId?: string
  providerId?: string
  facilityId?: string
  serviceDate?: string | Date
  placeOfService?: string
  procedureCodes?: string[]
  diagnosisCodes?: string[]
  modifiers?: string[]
  authorizationRequired: boolean
  authorizationType?: string
  requestDate?: string | Date
  requestedUnits?: number
  approvedUnits?: number
  authNumber?: string
  authorizationStatus?: string
  expirationDate?: string | Date
  denialReason?: string
  notes?: string
  automationStatus?: string
  payerPortalReference?: string
  authPacket?: Record<string, unknown>
  documentChecklist?: Array<Record<string, unknown>>
  statusCheckHistory?: Array<Record<string, unknown>>
  statusHistory?: string[]
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface PriorAuthorizationFormValues {
  _id?: string
  patientId: string
  insuranceId: string
  payerId: string
  providerId: string
  facilityId: string
  serviceDate: Date | null
  placeOfService: string
  procedureCodes: string
  diagnosisCodes: string
  modifiers: string
  authorizationRequired: boolean
  authorizationType: string
  requestDate: Date | null
  requestedUnits: number | null
  approvedUnits: number | null
  authNumber: string
  authorizationStatus: string
  expirationDate: Date | null
  denialReason: string
  notes: string
  statusHistory: string
  active: boolean
}

export interface PriorAuthorizationCreatePayload {
  patientId?: string
  insuranceId?: string
  payerId?: string
  providerId?: string
  facilityId?: string
  serviceDate?: Date
  placeOfService?: string
  procedureCodes?: string[]
  diagnosisCodes?: string[]
  modifiers?: string[]
  authorizationRequired: boolean
  authorizationType?: string
  requestDate?: Date
  requestedUnits?: number
  approvedUnits?: number
  authNumber?: string
  authorizationStatus?: string
  expirationDate?: Date
  denialReason?: string
  notes?: string
  statusHistory?: string[]
  active: boolean
}

export type PriorAuthorizationUpdatePayload = PriorAuthorizationCreatePayload
