import { z } from 'zod';

export const createDenialSchema = z.object({
  body: z.object({
    claimId: z.string().trim().optional(),
    claimLineId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    eraEobProcessingId: z.string().trim().optional(),
    adjustmentId: z.string().trim().optional(),
    correctedClaimId: z.string().trim().optional(),
    arWorkItemId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    cptCode: z.string().trim().optional(),
    denialCode: z.string().trim().optional(),
    carcCodes: z.array(z.string().trim()).optional(),
    rarcCodes: z.array(z.string().trim()).optional(),
    denialReason: z.string().trim().optional(),
    denialCategory: z.string().trim().optional(),
    classificationExplanation: z.string().trim().optional(),
    denialSource: z.string().trim().optional(),
    denialDate: z.coerce.date().optional(),
    denialAmount: z.coerce.number().optional(),
    preventableFlag: z.boolean().optional(),
    rootCause: z.string().trim().optional(),
    owner: z.string().trim().optional(),
    priority: z.string().trim().optional(),
    denialStatus: z.string().trim().optional(),
    reworkType: z.string().trim().optional(),
    recommendedAction: z.string().trim().optional(),
    correctionEligible: z.boolean().optional(),
    appealEligible: z.boolean().optional(),
    recoveryRecommendation: z.enum(['CORRECTED_CLAIM', 'APPEAL', 'WRITE_OFF']).optional(),
    recommendationReason: z.string().trim().optional(),
    resolutionDate: z.coerce.date().optional(),
    resolutionNotes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateDenialSchema = z.object({
  body: z.object({
    claimId: z.string().trim().optional(),
    claimLineId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    eraEobProcessingId: z.string().trim().optional(),
    adjustmentId: z.string().trim().optional(),
    correctedClaimId: z.string().trim().optional(),
    arWorkItemId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    cptCode: z.string().trim().optional(),
    denialCode: z.string().trim().optional(),
    carcCodes: z.array(z.string().trim()).optional(),
    rarcCodes: z.array(z.string().trim()).optional(),
    denialReason: z.string().trim().optional(),
    denialCategory: z.string().trim().optional(),
    classificationExplanation: z.string().trim().optional(),
    denialSource: z.string().trim().optional(),
    denialDate: z.coerce.date().optional(),
    denialAmount: z.coerce.number().optional(),
    preventableFlag: z.boolean().optional(),
    rootCause: z.string().trim().optional(),
    owner: z.string().trim().optional(),
    priority: z.string().trim().optional(),
    denialStatus: z.string().trim().optional(),
    reworkType: z.string().trim().optional(),
    recommendedAction: z.string().trim().optional(),
    correctionEligible: z.boolean().optional(),
    appealEligible: z.boolean().optional(),
    recoveryRecommendation: z.enum(['CORRECTED_CLAIM', 'APPEAL', 'WRITE_OFF']).optional(),
    recommendationReason: z.string().trim().optional(),
    resolutionDate: z.coerce.date().optional(),
    resolutionNotes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const assignDenialOwnerSchema = z.object({
  body: z.object({
    owner: z.string().trim(),
  }),
  params: z.object({ id: z.string().min(24) }),
});

export const changeDenialStatusSchema = z.object({
  body: z.object({
    denialStatus: z.string().trim(),
    resolutionNotes: z.string().trim().optional(),
  }),
  params: z.object({ id: z.string().min(24) }),
});

export const denialResolutionNotesSchema = z.object({
  body: z.object({
    resolutionNotes: z.string().trim(),
  }),
  params: z.object({ id: z.string().min(24) }),
});

export const denialReopenSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1),
  }),
  params: z.object({ id: z.string().min(24) }),
});

export const denialPreventableSchema = z.object({
  body: z.object({
    preventableFlag: z.boolean(),
  }),
  params: z.object({ id: z.string().min(24) }),
});
