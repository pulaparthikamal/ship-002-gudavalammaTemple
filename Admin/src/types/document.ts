export interface Document {
  _id: string
  documentId: string
  patientId?: string
  encounterId?: string
  claimId?: string
  denialId?: string
  appealId?: string
  eraId?: string
  paymentPostingId?: string
  entityType?: string
  entityId?: string
  documentCategory?: string
  uploadSource?: string
  documentType?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  fileUrl?: string
  mimeType?: string
  uploadedBy?: string
  uploadedAt?: string | Date
  tags?: string[]
  description?: string
  active: boolean
  createdAt: string
  updatedAt: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface DocumentFormValues {
  _id?: string
  patientId: string
  encounterId: string
  claimId: string
  denialId: string
  appealId: string
  eraId: string
  paymentPostingId: string
  entityType: string
  entityId: string
  documentCategory: string
  uploadSource: string
  documentType: string
  fileName: string
  fileType: string
  fileSize: number | null
  fileUrl: string
  mimeType: string
  uploadedBy: string
  uploadedAt: Date | null
  tags: string
  description: string
  active: boolean
}

export interface DocumentCreatePayload {
  patientId?: string
  encounterId?: string
  claimId?: string
  denialId?: string
  appealId?: string
  eraId?: string
  paymentPostingId?: string
  entityType?: string
  entityId?: string
  documentCategory?: string
  uploadSource?: string
  documentType?: string
  fileName?: string
  fileType?: string
  fileSize?: number
  fileUrl?: string
  mimeType?: string
  uploadedBy?: string
  uploadedAt?: Date
  tags?: string[]
  description?: string
  active: boolean
}

export type DocumentUpdatePayload = DocumentCreatePayload

export interface UploadDocumentFilePayload {
  file: File
  folder?: string
  metadata?: Partial<DocumentCreatePayload>
}

export interface UploadDocumentFileResult {
  fileName: string
  fileUrl: string
  mimeType?: string
  sizeBytes: number
}
