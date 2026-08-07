import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import { Document } from './document.model';
import { AppError } from '../../../utils/error.util';
import { HTTP_STATUS } from '../../../constants/httpStatus.constants';
import { t } from '../../../i18n';
import { appConfig } from '../../../config/app.config';
import { envConfig } from '../../../config/env.config';

const MAX_UPLOAD_SIZE_BYTES = 200 * 1024 * 1024; // 200 MB (covers HD video)

const MIME_EXTENSION_MAP: Record<string, string> = {
  // Images
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/tiff': '.tiff',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
  // Video
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-msvideo': '.avi',
  'video/mpeg': '.mpeg',
  'video/ogg': '.ogv',
  'video/3gpp': '.3gp',
};

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function sanitizePathSegment(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sanitizeBaseFileName(value: string) {
  const extension = path.extname(value);
  const baseName = path.basename(value, extension);
  const sanitizedBaseName = sanitizePathSegment(baseName) || 'document';

  return {
    baseName: sanitizedBaseName,
    extension: extension.toLowerCase(),
  };
}

function inferExtension(fileName: string, mimeType?: string) {
  const { extension } = sanitizeBaseFileName(fileName);

  if (extension) {
    return extension;
  }

  return mimeType ? MIME_EXTENSION_MAP[mimeType] ?? '' : '';
}

function decodeBase64Content(contentBase64: string) {
  const normalizedContent = contentBase64.includes(',')
    ? contentBase64.split(',').pop() ?? ''
    : contentBase64;

  const fileBuffer = Buffer.from(normalizedContent, 'base64');

  if (!fileBuffer.length) {
    throw new AppError('Uploaded file content is invalid.', HTTP_STATUS.BAD_REQUEST);
  }

  return fileBuffer;
}

export const documentService = {
  async uploadFile(data: any, _locale: string) {
    const fileName = normalizeText(data.fileName);

    if (!fileName) {
      throw new AppError('File name is required.', HTTP_STATUS.BAD_REQUEST);
    }

    const folderName = sanitizePathSegment(normalizeText(data.folder) ?? 'general') || 'general';
    const mimeType = normalizeText(data.mimeType);
    const fileBuffer = decodeBase64Content(String(data.contentBase64 ?? ''));

    if (fileBuffer.length > (envConfig.uploadMaxFileSizeMb * 1024 * 1024)) {
      throw new AppError(`Uploaded file exceeds the ${envConfig.uploadMaxFileSizeMb} MB size limit.`, HTTP_STATUS.BAD_REQUEST);
    }

    const { baseName } = sanitizeBaseFileName(fileName);
    const extension = inferExtension(fileName, mimeType);
    const storedFileName = `${Date.now()}-${randomUUID()}-${baseName}${extension}`;

    let relativePath = path.join('rcm', folderName);
    
    // Redirect social media related uploads to SocialMediaAutomation folder
    if (folderName.includes('social') || folderName.includes('automation')) {
      const isVideo = mimeType?.startsWith('video') || extension === '.mp4' || extension === '.mov';
      const subFolder = isVideo ? 'uploadedVideos' : 'uploadedImages';
      relativePath = path.join('SocialMediaAutomation', subFolder);
    }

    const absoluteDirectory = path.resolve(process.cwd(), envConfig.uploadRootDir, relativePath);
    const absoluteFilePath = path.join(absoluteDirectory, storedFileName);
    const publicFilePath = `${appConfig.apiPrefix}/uploads/${relativePath}/${storedFileName}`;

    await fs.mkdir(absoluteDirectory, { recursive: true });
    await fs.writeFile(absoluteFilePath, fileBuffer);

    return {
      fileName,
      fileUrl: publicFilePath,
      mimeType,
      sizeBytes: fileBuffer.length,
    };
  },

  async create(data: any, locale: string, createdBy: string) {
    const item = await Document.create({
      ...data,
      documentCategory: data.documentCategory ?? data.documentType,
      documentType: data.documentType ?? data.documentCategory,
      fileType: data.fileType ?? data.mimeType,
      mimeType: data.mimeType ?? data.fileType,
      active: data.active ?? true,
      uploadedAt: data.uploadedAt ?? new Date(),
      created: new Date(),
      updated: new Date(),
      createdBy,
    });

    return item;
  },

  async getById(id: string, locale: string) {
    const item = await Document.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('document.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return item;
  },

  async update(id: string, data: any, locale: string, updatedBy: string) {
    const item = await Document.findOne({ _id: id, isDeleted: false });

    if (!item) {
      throw new AppError(t('document.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    Object.assign(item, {
      ...data,
      documentCategory: data.documentCategory ?? data.documentType ?? item.documentCategory,
      documentType: data.documentType ?? data.documentCategory ?? item.documentType,
      fileType: data.fileType ?? data.mimeType ?? item.fileType,
      mimeType: data.mimeType ?? data.fileType ?? item.mimeType,
      updatedBy,
      updated: new Date(),
    });

    await item.save();
    return item;
  },

  async softDelete(id: string, locale: string, updatedBy: string) {
    const item = await Document.findOneAndUpdate(
      { _id: id, isDeleted: false },
      {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updatedBy,
        updated: new Date(),
      },
      { new: true }
    );

    if (!item) {
      throw new AppError(t('document.notFound', {}, locale), HTTP_STATUS.NOT_FOUND);
    }

    return true;
  },
};
