import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { appConfig } from '../../config/app.config';
import { envConfig } from '../../config/env.config';
import { HTTP_STATUS } from '../../constants/httpStatus.constants';
import { AppError } from '../../utils/error.util';

const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/tiff',
  'image/svg+xml',
  'image/heic',
  'image/heif',
]);

const VIDEO_MIME_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
]);

const DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/tiff': '.tiff',
  'image/svg+xml': '.svg',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/x-matroska': '.mkv',
  'video/mpeg': '.mpeg',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'text/plain': '.txt',
  'text/csv': '.csv',
};

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function sanitizeBaseFileName(value: string) {
  const extension = path.extname(value);
  const baseName = path.basename(value, extension);
  const sanitizedBaseName = sanitizePathSegment(baseName) || 'file';

  return {
    baseName: sanitizedBaseName,
    extension: extension.toLowerCase(),
  };
}

function inferExtension(fileName: string, mimeType: string) {
  const { extension } = sanitizeBaseFileName(fileName);

  if (extension) {
    return extension;
  }

  return MIME_EXTENSION_MAP[mimeType] ?? '';
}

function validateMimeType(mimeType: string) {
  if (IMAGE_MIME_TYPES.has(mimeType)) {
    return 'image';
  }

  if (VIDEO_MIME_TYPES.has(mimeType)) {
    return 'video';
  }

  if (DOCUMENT_MIME_TYPES.has(mimeType)) {
    return 'document';
  }

  throw new AppError(
    'Only image, video, and document uploads are allowed.',
    HTTP_STATUS.BAD_REQUEST
  );
}

export const uploadService = {
  async uploadFile(data: {
    file: {
      originalname: string;
      mimetype: string;
      buffer: Buffer;
      size: number;
    };
    moduleName: string;
  }) {
    const normalizedMimeType = data.file.mimetype.trim().toLowerCase();
    const mediaType = validateMimeType(normalizedMimeType);
    const moduleName = sanitizePathSegment(data.moduleName);

    if (!moduleName) {
      throw new AppError('moduleName is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const fileBuffer = data.file.buffer;

    if (!fileBuffer.length) {
      throw new AppError('Uploaded file content is invalid.', HTTP_STATUS.BAD_REQUEST);
    }

    const maxUploadSizeBytes = envConfig.uploadMaxFileSizeMb * 1024 * 1024;

    if (fileBuffer.length > maxUploadSizeBytes) {
      throw new AppError(
        `Uploaded file exceeds the ${envConfig.uploadMaxFileSizeMb} MB size limit.`,
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const { baseName } = sanitizeBaseFileName(data.file.originalname);
    const extension = inferExtension(data.file.originalname, normalizedMimeType);
    const storedFileName = `${Date.now()}-${randomUUID()}-${baseName}${extension}`;

    let relativePath = moduleName;
    
    // Special handling for Social Media Automation uploads as requested by USER
    if (moduleName.includes('social') || moduleName.includes('automation')) {
      let subFolder = 'uploadedFiles';
      if (mediaType === 'image') subFolder = 'uploadedImages';
      else if (mediaType === 'video') subFolder = 'uploadedVideos';
      else if (mediaType === 'document') subFolder = 'uploadedDocuments';
      
      relativePath = path.join('SocialMediaAutomation', subFolder);
    }

    const absoluteDirectory = path.resolve(process.cwd(), envConfig.uploadRootDir, relativePath);
    const absoluteFilePath = path.join(absoluteDirectory, storedFileName);
    // Normalize relativePath with forward slashes for the public URL
    const urlPath = relativePath.replace(/\\/g, '/');
    const publicFilePath = `/uploads/${urlPath}/${storedFileName}`;

    await fs.mkdir(absoluteDirectory, { recursive: true });
    await fs.writeFile(absoluteFilePath, fileBuffer);

    return {
      fileName: data.file.originalname,
      storedFileName,
      fileUrl: publicFilePath,
      moduleName: relativePath,
      mediaType,
      mimeType: normalizedMimeType,
      sizeBytes: data.file.size,
    };
  },
};
