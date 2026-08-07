export interface AuditLog {
  _id: string
  auditId: string
  entityType?: string
  entityId?: string
  action?: string
  userId?: string
  userName?: string
  previousState?: unknown
  newState?: unknown
  reason?: string
  source?: string
  correlationId?: string
  claimId?: string
  submissionId?: string
  financialEventId?: string
  appointmentId?: string
  patientId?: string
  payerId?: string
  severity?: string
  category?: string
  visibility?: string
  status?: string
  userAgent?: string
  retentionClass?: string
  retentionUntil?: string
  legalHold?: boolean
  redactionVersion?: string
  fieldName?: string
  oldValue?: unknown
  newValue?: unknown
  changedBy?: string
  timestamp?: string | Date
  sourceModule?: string
  ipAddress?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface AuditLogFormValues {
  _id?: string
  entityType: string
  entityId: string
  action: string
  fieldName: string
  oldValue: string
  newValue: string
  changedBy: string
  timestamp: Date | null
  sourceModule: string
  ipAddress: string
  active: boolean
}

export interface AuditLogCreatePayload {
  entityType?: string
  entityId?: string
  action?: string
  fieldName?: string
  oldValue?: unknown
  newValue?: unknown
  changedBy?: string
  timestamp?: Date
  sourceModule?: string
  ipAddress?: string
  active: boolean
}

export type AuditLogUpdatePayload = AuditLogCreatePayload
