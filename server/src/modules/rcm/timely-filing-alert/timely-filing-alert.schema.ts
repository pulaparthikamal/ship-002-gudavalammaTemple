import { z } from 'zod';

export const timelyFilingAlertIdSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const refreshTimelyFilingAlertsSchema = z.object({
  body: z.object({}).optional(),
});
