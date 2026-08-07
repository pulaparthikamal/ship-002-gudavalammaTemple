import { z } from 'zod';

export const createRefundSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    patientBillingId: z.string().trim().optional(),
    patientPaymentId: z.string().trim().optional(),
    refundType: z.string().trim().optional(),
    refundReason: z.string().trim().min(1),
    refundAmount: z.coerce.number().positive(),
    balanceImpactAmount: z.coerce.number().nonnegative().optional(),
    refundMethod: z.string().trim().optional(),
    idempotencyKey: z.string().trim().optional(),
    externalRefundReference: z.string().trim().optional(),
    requestedDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateRefundSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    patientBillingId: z.string().trim().optional(),
    patientPaymentId: z.string().trim().optional(),
    refundType: z.string().trim().optional(),
    refundReason: z.string().trim().optional(),
    refundAmount: z.coerce.number().optional(),
    cashOutAmount: z.coerce.number().optional(),
    balanceImpactAmount: z.coerce.number().nonnegative().optional(),
    refundMethod: z.string().trim().optional(),
    idempotencyKey: z.string().trim().optional(),
    externalRefundReference: z.string().trim().optional(),
    requestedDate: z.coerce.date().optional(),
    approvedDate: z.coerce.date().optional(),
    processedDate: z.coerce.date().optional(),
    refundStatus: z.string().trim().optional(),
    approvedBy: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const refundActionSchema = z.object({
  params: z.object({
    id: z.string().min(24),
    action: z.string().trim().min(1),
  }),
  body: z.object({
    reason: z.string().trim().min(1),
    notes: z.string().trim().optional(),
  }),
});
