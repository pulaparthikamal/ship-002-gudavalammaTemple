import { z } from 'zod';

export const createDashboardSchema = z.object({
  body: z.object({
    name: z.string(),
    type: z.string(),
    config: z.record(z.any()).optional(),
    active: z.boolean().optional(),
  }),
});

export const updateDashboardSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    config: z.record(z.any()).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string(),
  }),
});
