export type DocumentationComplianceStatus = 'PASS' | 'FAIL'
export type DocumentationComplianceSeverity = 'LOW' | 'MEDIUM' | 'HIGH'

export interface DocumentationComplianceAlert {
  _id: string
  alertId: string
  alertType: 'DOCUMENTATION_GAP'
  claimId: string
  missingDocuments: string[]
  requiredDocuments: string[]
  matchedDocuments: string[]
  severity: DocumentationComplianceSeverity
  status: DocumentationComplianceStatus
  lastZapierTriggeredAt?: string | Date
  lastZapierStatus?: DocumentationComplianceStatus
  lastZapierMissingDocuments?: string[]
  zapierDeliveryStatus?: string
  zapierDeliveryError?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface DocumentationComplianceRefreshResult {
  scannedClaims: number
  alertsUpdated: number
  failedAlerts: number
  highSeverityAlerts: number
}
