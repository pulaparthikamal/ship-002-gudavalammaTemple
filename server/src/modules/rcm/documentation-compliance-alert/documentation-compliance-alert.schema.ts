import { z } from 'zod';

export const documentationComplianceAlertIdSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const refreshDocumentationComplianceAlertsSchema = z.object({
  body: z.object({}).optional(),
});
