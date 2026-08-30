import { z } from 'zod';

export const setLanguageEnabledSchema = z.object({
  body: z.object({
    enabled: z.boolean(),
  }),
  params: z.object({
    code: z.string().min(2).max(5),
  }),
});
