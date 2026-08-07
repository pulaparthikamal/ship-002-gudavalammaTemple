import path from 'path';
import mongoose from 'mongoose';
import { Document } from './document.model';
import type { AttachmentLink } from '../../../types/common.types';
import { publishRcmRealtimeEvent } from '../events/rcm-event-stream.service';

interface RegistryAttachment extends AttachmentLink {
  sourceTag: string;
  mimeType?: string;
  fileSize?: number;
}

interface SyncEntityDocumentsOptions {
  entityType: string;
  entityId: string;
  patientId?: string;
  attachments: RegistryAttachment[];
  sourceTags?: string[];
  userId?: string;
}

interface NormalizedRegistryAttachment {
  sourceTag: string;
  documentType?: string;
  title?: string;
  fileUrl: string;
  description?: string;
  mimeType?: string;
  fileSize?: number;
}

function normalizeText(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function fileNameFromPath(fileUrl: string) {
  try {
    const normalizedPath = fileUrl.split('?')[0] ?? fileUrl;
    const lastSegment = normalizedPath.split('/').filter(Boolean).at(-1);
    return lastSegment ? decodeURIComponent(path.basename(lastSegment)) : fileUrl;
  } catch {
    return fileUrl;
  }
}

function toObjectId(value?: string) {
  return value && mongoose.Types.ObjectId.isValid(value)
    ? new mongoose.Types.ObjectId(value)
    : undefined;
}

function normalizeAttachments(attachments: RegistryAttachment[]) {
  return attachments
    .map((attachment): Partial<NormalizedRegistryAttachment> => ({
      sourceTag: normalizeText(attachment.sourceTag),
      documentType: normalizeText(attachment.documentType),
      title: normalizeText(attachment.title),
      fileUrl: normalizeText(attachment.fileUrl),
      description: normalizeText(attachment.description),
      mimeType: normalizeText(attachment.mimeType),
      fileSize: typeof attachment.fileSize === 'number' && attachment.fileSize >= 0 ? attachment.fileSize : undefined,
    }))
    .filter((attachment): attachment is NormalizedRegistryAttachment => Boolean(attachment.sourceTag && attachment.fileUrl));
}

function buildLinkedIdPatch(entityType: string, entityObjectId: mongoose.Types.ObjectId) {
  const linkedIds: Record<string, mongoose.Types.ObjectId> = {};

  if (entityType === 'encounter') linkedIds.encounterId = entityObjectId;
  if (entityType === 'claim') linkedIds.claimId = entityObjectId;
  if (entityType === 'denial') linkedIds.denialId = entityObjectId;
  if (entityType === 'appeal') linkedIds.appealId = entityObjectId;
  if (entityType === 'era' || entityType === 'eraEobProcessing') linkedIds.eraId = entityObjectId;
  if (entityType === 'paymentPosting') linkedIds.paymentPostingId = entityObjectId;

  return linkedIds;
}

export async function syncEntityDocuments({
  entityType,
  entityId,
  patientId,
  attachments,
  sourceTags: expectedSourceTags,
  userId,
}: SyncEntityDocumentsOptions) {
  const normalizedEntityType = normalizeText(entityType);
  const normalizedEntityId = normalizeText(entityId);
  const entityObjectId = toObjectId(normalizedEntityId);
  const patientObjectId = toObjectId(patientId);
  const userObjectId = toObjectId(userId);

  if (!normalizedEntityType || !entityObjectId) {
    return;
  }

  const normalizedAttachments = normalizeAttachments(attachments);
  const sourceTags = Array.from(new Set([
    ...(expectedSourceTags ?? []),
    ...normalizedAttachments.map((attachment) => attachment.sourceTag),
  ].map(normalizeText).filter((value): value is string => Boolean(value))));

  await Promise.all(
    normalizedAttachments.map((attachment) => {
      const fileUrl = attachment.fileUrl as string;
      const sourceTag = attachment.sourceTag as string;
      const documentType = attachment.documentType ?? 'Uploaded Document';
      const documentCategory = documentType;
      const uploadSource = sourceTag.replace(/^source:/, '');
      const fileName = attachment.title ?? fileNameFromPath(fileUrl);
      const tags = Array.from(new Set([sourceTag, normalizedEntityType, documentType].filter(Boolean)));
      const linkedIds = buildLinkedIdPatch(normalizedEntityType, entityObjectId);

      return Document.updateOne(
        {
          entityType: normalizedEntityType,
          entityId: entityObjectId,
          fileUrl,
        },
        {
          $set: {
            ...(patientObjectId ? { patientId: patientObjectId } : {}),
            ...linkedIds,
            documentType,
            documentCategory,
            uploadSource,
            fileName,
            fileUrl,
            mimeType: attachment.mimeType,
            fileType: attachment.mimeType,
            ...(typeof attachment.fileSize === 'number' ? { fileSize: attachment.fileSize } : {}),
            description: attachment.description,
            tags,
            active: true,
            isDeleted: false,
            updated: new Date(),
            ...(userObjectId ? { updatedBy: userObjectId } : {}),
          },
          $unset: {
            deletedAt: '',
          },
          $setOnInsert: {
            uploadedAt: new Date(),
            created: new Date(),
            ...(userObjectId ? { createdBy: userObjectId } : {}),
          },
        },
        { upsert: true }
      );
    })
  );

  if (normalizedAttachments.length) {
    publishRcmRealtimeEvent({
      eventType: 'DOCUMENT_REPOSITORY_UPDATED',
      title: 'Document repository updated',
      message: `${normalizedAttachments.length} document record${normalizedAttachments.length === 1 ? '' : 's'} synced.`,
      entityType: 'document',
      entityId: normalizedEntityId,
    });
  }

  if (!sourceTags.length) {
    return;
  }

  const activeFileUrls = normalizedAttachments.map((attachment) => attachment.fileUrl);

  await Document.updateMany(
    {
      entityType: normalizedEntityType,
      entityId: entityObjectId,
      tags: { $in: sourceTags },
      fileUrl: { $nin: activeFileUrls },
      isDeleted: false,
    },
    {
      $set: {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updated: new Date(),
        ...(userObjectId ? { updatedBy: userObjectId } : {}),
      },
    }
  );

  publishRcmRealtimeEvent({
    eventType: 'DOCUMENT_REPOSITORY_UPDATED',
    title: 'Document repository updated',
    message: 'Linked document records were removed.',
    entityType: 'document',
    entityId,
  });
}

export async function markEntityDocumentsDeleted(entityType: string, entityId: string, userId?: string) {
  const normalizedEntityType = normalizeText(entityType);
  const entityObjectId = toObjectId(entityId);
  const userObjectId = toObjectId(userId);

  if (!normalizedEntityType || !entityObjectId) {
    return;
  }

  await Document.updateMany(
    {
      entityType: normalizedEntityType,
      entityId: entityObjectId,
      isDeleted: false,
    },
    {
      $set: {
        active: false,
        isDeleted: true,
        deletedAt: new Date(),
        updated: new Date(),
        ...(userObjectId ? { updatedBy: userObjectId } : {}),
      },
    }
  );
}
