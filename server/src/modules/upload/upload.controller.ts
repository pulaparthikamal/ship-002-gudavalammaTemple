import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { AppError } from '../../utils/error.util';
import { uploadService } from './upload.service';
import { Document } from '../rcm/document/document.model';
import { publishRcmRealtimeEvent } from '../rcm/events/rcm-event-stream.service';

const DOCUMENT_OBJECT_ID_FIELDS = [
  'patientId',
  'encounterId',
  'claimId',
  'denialId',
  'appealId',
  'eraId',
  'paymentPostingId',
  'entityId',
] as const;

const DOCUMENT_ENTITY_TYPES = new Set([
  'appeal',
  'claim',
  'denial',
  'encounter',
  'era',
  'eraEobProcessing',
  'insurancePolicy',
  'patient',
  'paymentPosting',
]);

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function parseDocumentMetadata(value: unknown) {
  if (!value) {
    return undefined;
  }

  if (typeof value === 'object') {
    return value as Record<string, unknown>;
  }

  if (typeof value !== 'string') {
    return undefined;
  }

  try {
    const parsedValue = JSON.parse(value);
    return typeof parsedValue === 'object' && parsedValue !== null
      ? parsedValue as Record<string, unknown>
      : undefined;
  } catch {
    return undefined;
  }
}

function normalizeDocumentMetadata(metadata: Record<string, unknown>, uploadedFile: any, userId?: string) {
  const normalizedMetadata: Record<string, unknown> = {
    entityType: normalizeText(metadata.entityType),
    documentCategory: normalizeText(metadata.documentCategory) ?? normalizeText(metadata.documentType) ?? 'Uploaded Document',
    uploadSource: normalizeText(metadata.uploadSource),
    documentType: normalizeText(metadata.documentType) ?? normalizeText(metadata.documentCategory) ?? 'Uploaded Document',
    fileName: normalizeText(metadata.fileName) ?? uploadedFile.fileName,
    fileType: normalizeText(metadata.fileType) ?? uploadedFile.mimeType,
    fileSize: typeof metadata.fileSize === 'number' ? metadata.fileSize : uploadedFile.sizeBytes,
    fileUrl: uploadedFile.fileUrl,
    mimeType: normalizeText(metadata.mimeType) ?? uploadedFile.mimeType,
    uploadedBy: normalizeText(metadata.uploadedBy),
    uploadedAt: metadata.uploadedAt ? new Date(String(metadata.uploadedAt)) : new Date(),
    description: normalizeText(metadata.description),
    active: typeof metadata.active === 'boolean' ? metadata.active : true,
    updated: new Date(),
    isDeleted: false,
  };

  DOCUMENT_OBJECT_ID_FIELDS.forEach((field) => {
    const value = normalizeText(metadata[field]);
    if (value && mongoose.Types.ObjectId.isValid(value)) {
      normalizedMetadata[field] = new mongoose.Types.ObjectId(value);
    }
  });

  if (userId && mongoose.Types.ObjectId.isValid(userId)) {
    normalizedMetadata.updatedBy = new mongoose.Types.ObjectId(userId);
  }

  return normalizedMetadata;
}

async function registerUploadedDocument(req: Request, uploadedFile: any) {
  const metadata = parseDocumentMetadata(req.body.metadata);

  if (!metadata) {
    return;
  }

  const userId = String((req as any).user?._id ?? '');

  if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
    return;
  }

  const normalizedMetadata = normalizeDocumentMetadata(metadata, uploadedFile, userId);

  if (
    !normalizedMetadata.fileUrl ||
    typeof normalizedMetadata.entityType !== 'string' ||
    !DOCUMENT_ENTITY_TYPES.has(normalizedMetadata.entityType) ||
    !normalizedMetadata.entityId
  ) {
    return;
  }

  const createdByPatch = { createdBy: new mongoose.Types.ObjectId(userId) };

  await Document.updateOne(
    {
      entityType: normalizedMetadata.entityType,
      entityId: normalizedMetadata.entityId,
      fileUrl: normalizedMetadata.fileUrl,
    },
    {
      $set: normalizedMetadata,
      $unset: { deletedAt: '' },
      $setOnInsert: {
        uploadedAt: normalizedMetadata.uploadedAt,
        created: new Date(),
        ...createdByPatch,
      },
    },
    { upsert: true },
  );

  publishRcmRealtimeEvent({
    eventType: 'DOCUMENT_REPOSITORY_UPDATED',
    title: 'Document uploaded',
    message: `${uploadedFile.fileName} was added to the document repository.`,
    entityType: 'document',
    entityId: String(normalizedMetadata.entityId),
  });
}

export const uploadController = {
  // Single file upload
  async upload(req: Request, res: Response) {
    let incomingFile: any = (req as any).file;

    // Fallback to Base64 from body if no multipart file provided
    if (!incomingFile && req.body.contentBase64) {
      const { contentBase64, fileName, mimeType } = req.body;
      incomingFile = {
        originalname: fileName || 'upload',
        mimetype: mimeType || 'application/octet-stream',
        buffer: Buffer.from(contentBase64, 'base64'),
        size: Buffer.from(contentBase64, 'base64').length,
      };
    }

    if (!incomingFile) {
      throw new AppError('File or contentBase64 is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const uploadedFile = await uploadService.uploadFile({
      file: incomingFile,
      moduleName: String(req.query.type || req.body.folder || 'general'),
    });

    try {
      await registerUploadedDocument(req, uploadedFile);
    } catch (error) {
      console.warn(
        'Document repository registration failed after upload. The uploaded file was saved and parent record sync can retry it.',
        error,
      );
    }

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      respMessage: 'File uploaded successfully',
      data: uploadedFile,
      meta: null,
      errors: null,
    });
  },

  // Multiple files upload (up to 10 images)
  async uploadMultiple(req: Request, res: Response) {
    const files = (req as any).files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      throw new AppError('At least one file is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const uploadedFiles = await Promise.all(
      files.map((file) =>
        uploadService.uploadFile({
          file,
          moduleName: String(req.query.type || req.body.folder || 'general'),
        })
      )
    );

    return res.status(HTTP_STATUS.CREATED).json({
      success: true,
      statusCode: HTTP_STATUS.CREATED,
      respMessage: `${uploadedFiles.length} file(s) uploaded successfully`,
      data: uploadedFiles,
      meta: { count: uploadedFiles.length },
      errors: null,
    });
  },
};
