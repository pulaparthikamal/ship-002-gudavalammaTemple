export interface Report {
  _id: string
  reportId: string
  reportName?: string
  reportType?: string
  dateFrom?: string | Date
  dateTo?: string | Date
  payerId?: string
  providerId?: string
  facilityId?: string
  generatedBy?: string
  generatedAt?: string | Date
  exportFormat?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface ReportFormValues {
  _id?: string
  reportName: string
  reportType: string
  dateFrom: Date | null
  dateTo: Date | null
  payerId: string
  providerId: string
  facilityId: string
  generatedBy: string
  generatedAt: Date | null
  exportFormat: string
  active: boolean
}

export interface ReportCreatePayload {
  reportName?: string
  reportType?: string
  dateFrom?: Date
  dateTo?: Date
  payerId?: string
  providerId?: string
  facilityId?: string
  generatedBy?: string
  generatedAt?: Date
  exportFormat?: string
  active: boolean
}

export type ReportUpdatePayload = ReportCreatePayload

export interface RcmOperationsReport {
  generatedAt: string | Date
  financial: Record<string, number>
  claims: Record<string, number>
  ar: {
    aging: Record<string, number>
    payerAr: Record<string, number>
    patientAr: number
    underpayments: number
    unresolvedWorkItems: number
  }
  denials: Record<string, number | Record<string, number>>
  collections: Record<string, number>
  operational: Record<string, number | Record<string, number>>
}
