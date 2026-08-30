import { z } from 'zod';

export const createAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    purchaseDate: z.coerce.date().optional(),
    cost: z.number().optional(),
    currentValue: z.number().optional(),
    custodian: z.string().optional(),
    location: z.string().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateAssetSchema = z.object({
  body: z.object({
    name: z.string().min(1).optional(),
    category: z.string().optional(),
    purchaseDate: z.coerce.date().optional(),
    cost: z.number().optional(),
    currentValue: z.number().optional(),
    custodian: z.string().optional(),
    location: z.string().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
