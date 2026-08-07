import { z } from 'zod';

export const createAdjustmentSchema = z.object({
  body: z.object({
    eraEobProcessingId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    claimLineId: z.string().trim().optional(),
    adjustmentType: z.string().trim().optional(),
    adjustmentGroupCode: z.string().trim().optional(),
    adjustmentReasonCode: z.string().trim().optional(),
    adjustmentAmount: z.coerce.number().optional(),
    remarkCodes: z.array(z.string().trim()).optional(),
    source: z.string().trim().optional(),
    writeOffFlag: z.boolean().optional(),
    approvedBy: z.string().trim().optional(),
    adjustmentDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateAdjustmentSchema = z.object({
  body: z.object({
    eraEobProcessingId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    claimLineId: z.string().trim().optional(),
    adjustmentType: z.string().trim().optional(),
    adjustmentGroupCode: z.string().trim().optional(),
    adjustmentReasonCode: z.string().trim().optional(),
    adjustmentAmount: z.coerce.number().optional(),
    remarkCodes: z.array(z.string().trim()).optional(),
    source: z.string().trim().optional(),
    writeOffFlag: z.boolean().optional(),
    approvedBy: z.string().trim().optional(),
    adjustmentDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
