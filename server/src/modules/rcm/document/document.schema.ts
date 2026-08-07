import { z } from 'zod';

export const createDocumentSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    encounterId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    appealId: z.string().trim().optional(),
    eraId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    documentCategory: z.string().trim().optional(),
    uploadSource: z.string().trim().optional(),
    documentType: z.string().trim().optional(),
    fileName: z.string().trim().optional(),
    fileType: z.string().trim().optional(),
    fileSize: z.number().nonnegative().optional(),
    fileUrl: z.string().trim().optional(),
    mimeType: z.string().trim().optional(),
    uploadedBy: z.string().trim().optional(),
    uploadedAt: z.coerce.date().optional(),
    tags: z.array(z.string().trim()).optional(),
    description: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateDocumentSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    encounterId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    appealId: z.string().trim().optional(),
    eraId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    entityType: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    documentCategory: z.string().trim().optional(),
    uploadSource: z.string().trim().optional(),
    documentType: z.string().trim().optional(),
    fileName: z.string().trim().optional(),
    fileType: z.string().trim().optional(),
    fileSize: z.number().nonnegative().optional(),
    fileUrl: z.string().trim().optional(),
    mimeType: z.string().trim().optional(),
    uploadedBy: z.string().trim().optional(),
    uploadedAt: z.coerce.date().optional(),
    tags: z.array(z.string().trim()).optional(),
    description: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const uploadDocumentFileSchema = z.object({
  body: z.object({
    fileName: z.string().trim().min(1),
    contentBase64: z.string().trim().min(1),
    mimeType: z.string().trim().optional(),
    folder: z.string().trim().optional(),
  }),
});
