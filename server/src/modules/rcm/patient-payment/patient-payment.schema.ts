import { z } from 'zod';

export const createPatientPaymentSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    patientBillingId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    claimLineId: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'ACH', 'CHECK', 'ONLINE']).optional(),
    idempotencyKey: z.string().trim().optional(),
    externalTransactionId: z.string().trim().optional(),
    amount: z.coerce.number().positive('Patient payment amount must be greater than zero.'),
    appliedAmount: z.coerce.number().optional(),
    overpaymentAmount: z.coerce.number().optional(),
    referenceNumber: z.string().trim().optional(),
    receiptNumber: z.string().trim().optional(),
    receiptMetadata: z.record(z.unknown()).optional(),
    paymentStatus: z.string().trim().optional(),
    collectedAtFrontDesk: z.boolean().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updatePatientPaymentSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    patientBillingId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    claimLineId: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    paymentMethod: z.enum(['CASH', 'CARD', 'ACH', 'CHECK', 'ONLINE']).optional(),
    idempotencyKey: z.string().trim().optional(),
    externalTransactionId: z.string().trim().optional(),
    amount: z.coerce.number().optional(),
    appliedAmount: z.coerce.number().optional(),
    overpaymentAmount: z.coerce.number().optional(),
    referenceNumber: z.string().trim().optional(),
    receiptNumber: z.string().trim().optional(),
    receiptMetadata: z.record(z.unknown()).optional(),
    paymentStatus: z.string().trim().optional(),
    collectedAtFrontDesk: z.boolean().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
