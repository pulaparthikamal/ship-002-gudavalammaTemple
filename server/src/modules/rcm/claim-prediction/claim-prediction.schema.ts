import { z } from 'zod';

export const predictionRequestSchema = z.object({
  claimId: z.string().optional(),
  cptCode: z.string().min(1, 'CPT Code is required'),
  payerId: z.string().optional(),
  lineNumber: z.number().optional(),
  units: z.number().optional(),
  renderingProviderId: z.string().optional(),
  billingProviderId: z.string().optional(),
  facilityId: z.string().optional(),
  placeOfServiceCode: z.string().optional(),
  pricingState: z.string().optional(),
  chargeAmount: z.number().optional(),
}).refine((value) => Boolean(value.claimId || value.payerId), {
  message: 'Payer ID is required when claim ID is not provided',
  path: ['payerId'],
});

export type PredictionRequest = z.infer<typeof predictionRequestSchema>;
