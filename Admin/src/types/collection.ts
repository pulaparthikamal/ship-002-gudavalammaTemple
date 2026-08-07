export interface Collection {
  _id: string
  collectionId: string
  patientId?: string
  patientBillingId?: string
  claimId?: string
  originalBalance?: number
  currentBalance?: number
  daysPastDue?: number
  collectionStage?: string
  status?: string
  owner?: string
  lastContactDate?: string | Date
  nextContactDate?: string | Date
  contactAttempts?: number
  resolution?: string
  writeOffAmount?: number
  settlementAmount?: number
  actionAudit?: Array<Record<string, unknown>>
  balanceAmount?: number
  agencyName?: string
  referredDate?: string | Date
  collectionStatus?: string
  recoveredAmount?: number
  closeDate?: string | Date
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

export interface CollectionFormValues {
  _id?: string
  patientId: string
  patientBillingId: string
  claimId: string
  originalBalance: number | null
  currentBalance: number | null
  daysPastDue: number | null
  collectionStage: string
  status: string
  owner: string
  lastContactDate: Date | null
  nextContactDate: Date | null
  contactAttempts: number | null
  resolution: string
  writeOffAmount: number | null
  settlementAmount: number | null
  balanceAmount: number | null
  agencyName: string
  referredDate: Date | null
  collectionStatus: string
  recoveredAmount: number | null
  closeDate: Date | null
  notes: string
  active: boolean
}

export interface CollectionCreatePayload {
  patientId?: string
  patientBillingId?: string
  claimId?: string
  originalBalance?: number
  currentBalance?: number
  daysPastDue?: number
  collectionStage?: string
  status?: string
  owner?: string
  lastContactDate?: Date
  nextContactDate?: Date
  contactAttempts?: number
  resolution?: string
  writeOffAmount?: number
  settlementAmount?: number
  balanceAmount?: number
  agencyName?: string
  referredDate?: Date
  collectionStatus?: string
  recoveredAmount?: number
  closeDate?: Date
  notes?: string
  active: boolean
}

export type CollectionUpdatePayload = CollectionCreatePayload
