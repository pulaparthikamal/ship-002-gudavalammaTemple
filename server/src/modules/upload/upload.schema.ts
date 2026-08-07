import { z } from 'zod';

export const uploadFileSchema = z.object({
  body: z.object({}),
  query: z.object({
    type: z.string().trim().min(1),
  }),
});
