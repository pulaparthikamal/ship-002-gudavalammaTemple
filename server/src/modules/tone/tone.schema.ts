import { z } from 'zod';

export const createToneSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'Tone name is required',
    }).min(2, 'Tone name must be at least 2 characters'),
  }),
});
