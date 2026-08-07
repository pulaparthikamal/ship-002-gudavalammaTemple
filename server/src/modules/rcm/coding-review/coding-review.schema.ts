import { z } from 'zod';
import {
  CODING_REVIEW_RISK_LEVEL_OPTIONS,
  CODING_REVIEW_SCRUB_STATUS_OPTIONS,
} from './coding-review.constants';

const scrubStatusSchema = z.enum(CODING_REVIEW_SCRUB_STATUS_OPTIONS);
const codingRiskLevelSchema = z.enum(CODING_REVIEW_RISK_LEVEL_OPTIONS);

export const createCodingReviewSchema = z.object({
  body: z.object({
    chargeId: z.string().trim().optional(),
    encounterId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    scrubStatus: scrubStatusSchema.optional(),
    codingRiskLevel: codingRiskLevelSchema.optional(),
    missingDocumentationFlag: z.boolean().optional(),
    modifierIssues: z.array(z.string().trim()).optional(),
    icdCptMismatchFlag: z.boolean().optional(),
    ncciEditFlag: z.boolean().optional(),
    lcdNcdEditFlag: z.boolean().optional(),
    payerSpecificRuleFailures: z.array(z.string().trim()).optional(),
    validationErrors: z.array(z.string().trim()).optional(),
    aiSuggestedCodes: z.array(z.string().trim()).optional(),
    aiSuggestedFixes: z.array(z.string().trim()).optional(),
    reviewedBy: z.string().trim().optional(),
    reviewedAt: z.coerce.date().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateCodingReviewSchema = z.object({
  body: z.object({
    chargeId: z.string().trim().optional(),
    encounterId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    scrubStatus: scrubStatusSchema.optional(),
    codingRiskLevel: codingRiskLevelSchema.optional(),
    missingDocumentationFlag: z.boolean().optional(),
    modifierIssues: z.array(z.string().trim()).optional(),
    icdCptMismatchFlag: z.boolean().optional(),
    ncciEditFlag: z.boolean().optional(),
    lcdNcdEditFlag: z.boolean().optional(),
    payerSpecificRuleFailures: z.array(z.string().trim()).optional(),
    validationErrors: z.array(z.string().trim()).optional(),
    aiSuggestedCodes: z.array(z.string().trim()).optional(),
    aiSuggestedFixes: z.array(z.string().trim()).optional(),
    reviewedBy: z.string().trim().optional(),
    reviewedAt: z.coerce.date().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createCodingReviewFromChargeSchema = z.object({
  params: z.object({
    chargeId: z.string().min(24),
  }),
});

export const approveCodingReviewSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});
