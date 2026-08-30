import { z } from 'zod';

export const translateEntriesSchema = z.object({
  params: z.object({
    locale: z.string().min(2).max(5),
  }),
  body: z.object({
    entries: z
      .array(
        z.object({
          key: z.string().min(1),
          text: z.string(),
        })
      )
      .max(2000),
  }),
});
