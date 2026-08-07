import { useCallback } from 'react'
import { useUploadDocumentFileMutation } from '@/services/api/endpoints/documentsApi'
import type {
  DocumentCreatePayload,
  UploadDocumentFilePayload,
  UploadDocumentFileResult,
} from '@/types/document'

const HEALTHCARE_DOCUMENT_ACCEPT = '.pdf,.jpg,.jpeg,.png,.tif,.tiff,application/pdf,image/jpeg,image/png,image/tiff'

export interface CentralDocumentUploadPayload extends UploadDocumentFilePayload {
  metadata?: Partial<DocumentCreatePayload>
}

export function buildDocumentUploadMetadata(
  file: File,
  uploadedFile: UploadDocumentFileResult,
  metadata: Partial<DocumentCreatePayload> = {},
): DocumentCreatePayload {
  const fileType = uploadedFile.mimeType || file.type || metadata.fileType || metadata.mimeType

  return {
    ...metadata,
    documentCategory: metadata.documentCategory ?? metadata.documentType ?? 'Uploaded Document',
    documentType: metadata.documentType ?? metadata.documentCategory ?? 'Uploaded Document',
    fileName: metadata.fileName ?? uploadedFile.fileName ?? file.name,
    fileType,
    mimeType: metadata.mimeType ?? fileType,
    fileSize: metadata.fileSize ?? uploadedFile.sizeBytes ?? file.size,
    fileUrl: uploadedFile.fileUrl,
    uploadedAt: metadata.uploadedAt ?? new Date(),
    active: metadata.active ?? true,
  }
}

export function useCentralDocumentUploadService() {
  const [uploadFile, uploadState] = useUploadDocumentFileMutation()

  const uploadDocument = useCallback(
    async ({ file, folder = 'rcm-documents', metadata }: CentralDocumentUploadPayload) => {
      return uploadFile({ file, folder, metadata }).unwrap()
    },
    [uploadFile],
  )

  return {
    uploadDocument,
    isLoading: uploadState.isLoading,
    HEALTHCARE_DOCUMENT_ACCEPT,
  }
}
