import { z } from 'zod';

const coerceDate = z.coerce.date();

export const createAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1),
    body: z.string().min(1),
    imageUrl: z.string().optional(),
    linkedEventId: z.string().min(24).optional(),
    type: z.enum(['info', 'urgent', 'festival']).optional(),
    startAt: coerceDate,
    endAt: coerceDate.nullable().optional(),
    active: z.boolean().optional(),
    targetAudience: z.enum(['all', 'devotee', 'staff']).optional(),
    priority: z.number().optional(),
  }),
});

export const updateAnnouncementSchema = z.object({
  body: z.object({
    title: z.string().min(1).optional(),
    body: z.string().min(1).optional(),
    imageUrl: z.string().optional(),
    linkedEventId: z.string().min(24).optional(),
    type: z.enum(['info', 'urgent', 'festival']).optional(),
    startAt: coerceDate.optional(),
    endAt: coerceDate.nullable().optional(),
    active: z.boolean().optional(),
    targetAudience: z.enum(['all', 'devotee', 'staff']).optional(),
    priority: z.number().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
