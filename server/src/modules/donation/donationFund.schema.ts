import { z } from 'zod';

export const createDonationFundSchema = z.object({
  body: z.object({
    slug: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
  }),
});

export const updateDonationFundSchema = z.object({
  body: z.object({
    slug: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
