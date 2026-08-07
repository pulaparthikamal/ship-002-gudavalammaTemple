import { z } from 'zod';
import { normalizeUsState } from '../shared/state-normalization';

export const ruleSchema = z.object({
  ruleId: z.string().min(1, 'Rule ID is required'),
  type: z.string().min(1, 'Type is required'),
  message: z.string().min(1, 'Message is required'),
  severity: z.string().min(1, 'Severity is required'),
  payerId: z.string().trim().optional().transform((value) => value || undefined),
  providerId: z.string().trim().optional().transform((value) => value || undefined),
  facilityId: z.string().trim().optional().transform((value) => value || undefined),
  state: z.string().trim().optional().transform((value) => normalizeUsState(value)),
  placeOfServiceCode: z.string().trim().optional().transform((value) => value || undefined),
  planName: z.string().trim().optional().transform((value) => value || undefined),
  groupNumber: z.string().trim().optional().transform((value) => value || undefined),
  network: z.string().trim().optional().transform((value) => value || undefined),
  coverageType: z.string().trim().optional().transform((value) => value || undefined),
  codes: z.array(z.string()).optional(),
  code: z.string().optional(),
  limit: z.string().optional(),
  requiredFields: z.array(z.string()).optional(),
  effectiveDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  expiryDate: z.string().optional().transform((val) => (val ? new Date(val) : undefined)),
  active: z.boolean().optional().default(true),
});

export const updateRuleSchema = ruleSchema.partial();
