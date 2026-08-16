import { z } from 'zod';

const liabilityStatus = z.enum(['open', 'paid']);

export const createLiabilitySchema = z.object({
  body: z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    amount: z.number(),
    dueDate: z.coerce.date().optional(),
    creditor: z.string().optional(),
    status: liabilityStatus.optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateLiabilitySchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    category: z.string().optional(),
    amount: z.number().optional(),
    dueDate: z.coerce.date().optional(),
    creditor: z.string().optional(),
    status: liabilityStatus.optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
