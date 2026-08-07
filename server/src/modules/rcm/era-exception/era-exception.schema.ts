import { z } from 'zod';
import { ERA_EXCEPTION_STATUSES, ERA_EXCEPTION_TYPES } from './era-exception.model';

const eraExceptionBody = z.object({
  exceptionType: z.enum(ERA_EXCEPTION_TYPES),
  severity: z.string().trim().optional(),
  status: z.enum(ERA_EXCEPTION_STATUSES).optional(),
  assignedTo: z.string().trim().optional(),
  resolutionNotes: z.string().trim().optional(),
  ignoredReason: z.string().trim().optional(),
  relatedClaim: z.string().trim().optional(),
  relatedERA: z.string().trim().optional(),
  relatedPaymentPosting: z.string().trim().optional(),
  relatedDenial: z.string().trim().optional(),
  relatedARWorkItem: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export const createEraExceptionSchema = z.object({ body: eraExceptionBody });
export const updateEraExceptionSchema = z.object({
  params: z.object({ id: z.string().min(24) }),
  body: eraExceptionBody.partial(),
});
export const eraExceptionActionSchema = z.object({
  params: z.object({
    id: z.string().min(24),
    action: z.string().trim().min(2),
  }),
  body: z.object({
    reason: z.string().trim().optional(),
    resolutionNotes: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    severity: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    appealId: z.string().trim().optional(),
    correctedClaimId: z.string().trim().optional(),
    paymentPostingId: z.string().trim().optional(),
    payerRecoveredAmount: z.number().nonnegative().optional(),
    payerPaidAmount: z.number().nonnegative().optional(),
    patientRecoveredAmount: z.number().nonnegative().optional(),
    patientResponsibilityAmount: z.number().nonnegative().optional(),
    contractualAdjustmentAmount: z.number().nonnegative().optional(),
  }).optional(),
});
