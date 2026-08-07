import { z } from 'zod';

const denialPredictionSchema = z.object({
  riskScore: z.coerce.number().optional(),
  riskLevel: z.string().trim().optional(),
  predictedReasons: z.array(z.string().trim()).optional(),
  recommendedFixes: z.array(z.string().trim()).optional(),
  modelVersion: z.string().trim().optional(),
  predictedAt: z.coerce.date().optional(),
  confidenceScore: z.coerce.number().optional(),
  reviewRequired: z.boolean().optional(),
});

export const createClaimAiReviewSchema = z.object({
  body: z.object({
    claimId: z.string().trim().optional(),
    reviewStatus: z.string().trim().optional(),
    blockingReasons: z.array(z.string().trim()).optional(),
    overrideReason: z.string().trim().optional(),
    denialPrediction: denialPredictionSchema.partial().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateClaimAiReviewSchema = z.object({
  body: z.object({
    claimId: z.string().trim().optional(),
    reviewStatus: z.string().trim().optional(),
    blockingReasons: z.array(z.string().trim()).optional(),
    overrideReason: z.string().trim().optional(),
    denialPrediction: denialPredictionSchema.partial().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const overrideClaimAiReviewSchema = z.object({
  body: z.object({
    overrideReason: z.string().trim().min(3, 'Override reason is required.'),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
