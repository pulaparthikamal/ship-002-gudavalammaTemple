import { z } from 'zod';

export const updateTokenStatusSchema = z.object({
  body: z.object({
    isValid: z.boolean(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
