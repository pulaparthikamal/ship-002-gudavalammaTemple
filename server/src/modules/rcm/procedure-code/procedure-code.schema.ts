import { z } from 'zod';

export const procedureCodeSchema = z.object({
  code: z.string().min(1, 'Code is required'),
  description: z.string().min(1, 'Description is required'),
  chargeFee: z.number().min(0, 'Charge fee must be non-negative'),
  category: z.string().min(1, 'Category is required'),
  requiresAuth: z.boolean().optional().default(false),
  frequencyLimit: z.string().optional(),
  active: z.boolean().optional().default(true),
});

export const updateProcedureCodeSchema = procedureCodeSchema.partial();
