import { z } from 'zod';

export const createAuditLogSchema = z.object({
  body: z.object({
    entityType: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    action: z.string().trim().optional(),
    fieldName: z.string().trim().optional(),
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
    changedBy: z.string().trim().optional(),
    timestamp: z.coerce.date().optional(),
    sourceModule: z.string().trim().optional(),
    ipAddress: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateAuditLogSchema = z.object({
  body: z.object({
    entityType: z.string().trim().optional(),
    entityId: z.string().trim().optional(),
    action: z.string().trim().optional(),
    fieldName: z.string().trim().optional(),
    oldValue: z.any().optional(),
    newValue: z.any().optional(),
    changedBy: z.string().trim().optional(),
    timestamp: z.coerce.date().optional(),
    sourceModule: z.string().trim().optional(),
    ipAddress: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
