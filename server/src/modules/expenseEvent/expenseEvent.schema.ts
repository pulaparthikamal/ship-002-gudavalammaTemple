import { z } from 'zod';

export const createExpenseEventSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    budget: z.number().min(0).optional(),
    notes: z.string().optional(),
  }),
});

export const updateExpenseEventSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    startDate: z.string().min(1).optional(),
    endDate: z.string().min(1).optional(),
    budget: z.number().min(0).optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
