import { apiSlice } from '@/services/api/apiSlice'
import { normalizeCrudListResponse } from '@/services/api/listResponse'
import { readResponsePath } from '@/services/api/responseTransform'
import { documentApiDetails } from '@/models/documentModel'
import type { EntityId } from '@/types/common'
import type { CrudListQuery, CrudListResponse } from '@/types/crud'
import type {
  Document,
  DocumentCreatePayload,
  DocumentUpdatePayload,
  UploadDocumentFilePayload,
  UploadDocumentFileResult,
} from '@/types/document'

export function normalizeOptionalString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function normalizeIdString(value: unknown) {
  if (typeof value === 'string') {
    return value
  }

  if (typeof value === 'object' && value !== null && '_id' in value) {
    const objectId = (value as { _id?: unknown })._id
    return typeof objectId === 'string' ? objectId : undefined
  }

  return undefined
}

export function normalizeOptionalNumber(value: unknown) {
  return typeof value === 'number' ? value : undefined
}

export function normalizeDateString(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

export function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function normalizeString(value: unknown) {
  return typeof value === 'string' ? value : ''
}

function normalizeDocument(response: unknown): Document | null {
  if (typeof response !== 'object' || response === null) {
    return null
  }

  const item = response as Record<string, unknown>

  if (typeof item._id !== 'string') {
    return null
  }

  return {
    _id: item._id,
    documentId:
      typeof item.documentId === 'string'
        ? item.documentId
        : typeof item.documentId === 'object' && item.documentId !== null && '_id' in item.documentId
          ? String((item.documentId as { _id?: string })._id ?? '')
          : '',
    patientId: normalizeIdString(item.patientId),
    encounterId: normalizeIdString(item.encounterId),
    claimId: normalizeIdString(item.claimId),
    denialId: normalizeIdString(item.denialId),
    appealId: normalizeIdString(item.appealId),
    eraId: normalizeIdString(item.eraId),
    paymentPostingId: normalizeIdString(item.paymentPostingId),
    entityType: normalizeOptionalString(item.entityType),
    entityId: normalizeIdString(item.entityId),
    documentCategory: normalizeOptionalString(item.documentCategory) ?? normalizeOptionalString(item.documentType),
    uploadSource: normalizeOptionalString(item.uploadSource),
    documentType: normalizeOptionalString(item.documentType) ?? normalizeOptionalString(item.documentCategory),
    fileName: normalizeOptionalString(item.fileName),
    fileType: normalizeOptionalString(item.fileType) ?? normalizeOptionalString(item.mimeType),
    fileSize: normalizeOptionalNumber(item.fileSize) ?? normalizeOptionalNumber(item.sizeBytes),
    fileUrl: normalizeOptionalString(item.fileUrl),
    mimeType: normalizeOptionalString(item.mimeType) ?? normalizeOptionalString(item.fileType),
    uploadedBy: normalizeOptionalString(item.uploadedBy),
    uploadedAt: normalizeDateString(item.uploadedAt),
    tags: normalizeStringArray(item.tags),
    description: normalizeOptionalString(item.description),
    active: typeof item.active === 'boolean' ? item.active : true,
    createdAt:
      normalizeDateString(item.createdAt) ??
      normalizeDateString(item.created) ??
      new Date().toISOString(),
    updatedAt:
      normalizeDateString(item.updatedAt) ??
      normalizeDateString(item.updated) ??
      new Date().toISOString(),
    createdBy: normalizeOptionalString(item.createdBy),
    updatedBy: normalizeOptionalString(item.updatedBy),
    isDeleted: typeof item.isDeleted === 'boolean' ? item.isDeleted : undefined,
    deletedAt: normalizeDateString(item.deletedAt),
    __v: typeof item.__v === 'number' ? item.__v : undefined,
  }
}

const documentListDataPaths = [documentApiDetails.responseDataPath, 'data.data', 'items']
const documentListTotalPaths = [
  documentApiDetails.responseTotalPath,
  'meta.totalRecords',
  'data.total',
  'data.totalRecords',
  'total',
  'totalRecords',
]

function normalizeDocumentListResponse(
  response: unknown,
  query: CrudListQuery,
): CrudListResponse<Document> {
  return normalizeCrudListResponse<unknown, Document>({
    response,
    query,
    dataPaths: documentListDataPaths,
    totalPaths: documentListTotalPaths,
    mapItem: normalizeDocument,
  })
}

export const documentsApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    getDocuments: builder.query<CrudListResponse<Document>, CrudListQuery>({
      query: (query) => ({
        url: documentApiDetails.endpoint,
        method: 'GET',
        params: {
          [documentApiDetails.filterQueryParam]: JSON.stringify(query),
        },
      }),
      transformResponse: (response: unknown, _meta: unknown, query: CrudListQuery) => normalizeDocumentListResponse(response, query),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map((item) => ({ type: 'Document' as const, id: item._id })),
              { type: 'Document' as const, id: 'LIST' },
            ]
          : [{ type: 'Document' as const, id: 'LIST' }],
    }),
    getDocument: builder.query<Document, EntityId>({
      query: (id) => ({
        url: `${documentApiDetails.endpoint}/${id}`,
        method: 'GET',
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDocument(readResponsePath<unknown>(response, documentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Document response is invalid.')
        }

        return item
      },
      providesTags: (_result, _error, id) => [{ type: 'Document', id }],
    }),
    createDocument: builder.mutation<Document, DocumentCreatePayload>({
      query: (payload) => ({
        url: documentApiDetails.endpoint,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDocument(readResponsePath<unknown>(response, documentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Document response is invalid.')
        }

        return item
      },
      invalidatesTags: [{ type: 'Document', id: 'LIST' }],
    }),
    updateDocument: builder.mutation<Document, { id: EntityId; data: DocumentUpdatePayload }>({
      query: ({ id, data }) => ({
        url: `${documentApiDetails.endpoint}/${id}`,
        method: 'PUT',
        data,
      }),
      transformResponse: (response: unknown) => {
        const item = normalizeDocument(readResponsePath<unknown>(response, documentApiDetails.responseDataPath))

        if (!item) {
          throw new Error('Document response is invalid.')
        }

        return item
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Document', id },
        { type: 'Document', id: 'LIST' },
      ],
    }),
    deleteDocument: builder.mutation<EntityId, EntityId>({
      query: (id) => ({
        url: `${documentApiDetails.endpoint}/${id}`,
        method: 'DELETE',
      }),
      transformResponse: (_response: unknown, _meta: unknown, id: EntityId) => id,
      invalidatesTags: (_result, _error, id) => [
        { type: 'Document', id },
        { type: 'Document', id: 'LIST' },
      ],
    }),
    bulkDeleteDocuments: builder.mutation<EntityId[], { ids: EntityId[] }>({
      query: (payload) => ({
        url: `${documentApiDetails.endpoint}/bulk-delete`,
        method: 'POST',
        data: payload,
      }),
      transformResponse: (_response: unknown, _meta: unknown, payload) => payload.ids,
      invalidatesTags: (_result, _error, payload) => [
        ...payload.ids.map((id) => ({ type: 'Document' as const, id })),
        { type: 'Document' as const, id: 'LIST' },
      ],
    }),
    uploadDocumentFile: builder.mutation<UploadDocumentFileResult, UploadDocumentFilePayload>({
      query: (payload) => {
        const formData = new FormData()
        formData.append('file', payload.file)
        if (payload.folder) {
          formData.append('folder', payload.folder)
        }
        if (payload.metadata) {
          formData.append('metadata', JSON.stringify(payload.metadata))
        }
        
        return {
          url: '/upload',
          method: 'POST',
          data: formData,
        }
      },
      transformResponse: (response: unknown) => {
        const data = readResponsePath<unknown>(response, 'data')

        if (typeof data !== 'object' || data === null) {
          throw new Error('Upload response is invalid.')
        }

        const item = data as Record<string, unknown>

        return {
          fileName: normalizeString(item.fileName),
          fileUrl: normalizeString(item.fileUrl),
          mimeType: normalizeOptionalString(item.mimeType),
          sizeBytes: normalizeOptionalNumber(item.sizeBytes) ?? 0,
        }
      },
      invalidatesTags: (_result, _error, payload) =>
        payload.metadata ? [{ type: 'Document' as const, id: 'LIST' }] : [],
    }),
  }),
})

export const {
  useBulkDeleteDocumentsMutation,
  useCreateDocumentMutation,
  useDeleteDocumentMutation,
  useGetDocumentQuery,
  useGetDocumentsQuery,
  useUploadDocumentFileMutation,
  useUpdateDocumentMutation,
} = documentsApi
