import { z } from 'zod';

export const createFacilitySchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    icon: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateFacilitySchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    icon: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
