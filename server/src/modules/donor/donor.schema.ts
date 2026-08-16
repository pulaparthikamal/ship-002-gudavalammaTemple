import { z } from 'zod';

export const createDonorSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    panNumber: z.string().optional(),
    linkedUserId: z.string().min(24).optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateDonorSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    phone: z.string().optional(),
    email: z.string().email().optional(),
    address: z.string().optional(),
    panNumber: z.string().optional(),
    linkedUserId: z.string().min(24).optional(),
    notes: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
