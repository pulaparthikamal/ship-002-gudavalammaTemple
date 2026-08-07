export type TimelyFilingStatus = 'SAFE' | 'WARNING' | 'CRITICAL' | 'EXPIRED'
export type TimelyFilingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

export interface TimelyFilingAlert {
  _id: string
  alertId: string
  claimId: string
  payerId: string
  serviceDate: string | Date
  filingDeadline: string | Date
  daysRemaining: number
  severity: TimelyFilingSeverity
  status: TimelyFilingStatus
  lastZapierTriggeredAt?: string | Date
  lastZapierStatus?: TimelyFilingStatus
  lastZapierSeverity?: TimelyFilingSeverity
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

export interface TimelyFilingRefreshResult {
  scannedClaims: number
  alertsUpdated: number
  riskAlerts: number
  expiredAlerts: number
}
