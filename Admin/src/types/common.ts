export type EntityId = string | number

export interface BaseEntity {
  _id: string
  createdAt?: string
  updatedAt?: string
  createdBy?: string
  updatedBy?: string
  isDeleted?: boolean
  deletedAt?: string | null
  __v?: number
}

export interface AttachmentLink {
  documentType?: string
  title?: string
  fileUrl?: string
  description?: string
}

export interface AttachmentLinkFormValues {
  documentType: string
  title: string
  fileUrl: string
  description: string
}
