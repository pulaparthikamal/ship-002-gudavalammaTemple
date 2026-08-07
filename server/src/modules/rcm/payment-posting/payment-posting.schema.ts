import { z } from 'zod';

const paymentLinesSchema = z.object({
  claimLineId: z.string().trim().optional(),
  serviceLineControlNumber: z.string().trim().optional(),
  procedureCode: z.string().trim().optional(),
  serviceDate: z.coerce.date().optional(),
  billedAmount: z.coerce.number().optional(),
  expectedAllowedAmount: z.coerce.number().optional(),
  expectedInsurancePayment: z.coerce.number().optional(),
  paidAmount: z.coerce.number().optional(),
  allowedAmount: z.coerce.number().optional(),
  adjustmentAmount: z.coerce.number().optional(),
  patientRespAmount: z.coerce.number().optional(),
  deniedAmount: z.coerce.number().optional(),
  adjustmentCodes: z.array(z.string().trim()).optional(),
  remarkCodes: z.array(z.string().trim()).optional(),
});

export const createPaymentPostingSchema = z.object({
  body: z.object({
    eraEobProcessingId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    payerClaimNumber: z.string().trim().optional(),
    claimControlNumber: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    checkNumber: z.string().trim().optional(),
    eftTraceNumber: z.string().trim().optional(),
    paymentMethod: z.string().trim().optional(),
    receivedAmount: z.coerce.number().optional(),
    postedAmount: z.coerce.number().optional(),
    patientResponsibilityAmount: z.coerce.number().optional(),
    remainingBalance: z.coerce.number().optional(),
    postingStatus: z.string().trim().optional(),
    postedBy: z.string().trim().optional(),
    postedAt: z.coerce.date().optional(),
    financialEventId: z.string().trim().optional(),
    parentFinancialEventId: z.string().trim().optional(),
    reversalOfId: z.string().trim().optional(),
    ledgerSequence: z.coerce.number().optional(),
    paymentLines: z.array(paymentLinesSchema).optional(),
    active: z.boolean().optional(),
  }),
});

export const updatePaymentPostingSchema = z.object({
  body: z.object({
    eraEobProcessingId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    payerClaimNumber: z.string().trim().optional(),
    claimControlNumber: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    checkNumber: z.string().trim().optional(),
    eftTraceNumber: z.string().trim().optional(),
    paymentMethod: z.string().trim().optional(),
    receivedAmount: z.coerce.number().optional(),
    postedAmount: z.coerce.number().optional(),
    patientResponsibilityAmount: z.coerce.number().optional(),
    remainingBalance: z.coerce.number().optional(),
    postingStatus: z.string().trim().optional(),
    postedBy: z.string().trim().optional(),
    postedAt: z.coerce.date().optional(),
    financialEventId: z.string().trim().optional(),
    parentFinancialEventId: z.string().trim().optional(),
    reversalOfId: z.string().trim().optional(),
    ledgerSequence: z.coerce.number().optional(),
    paymentLines: z.array(paymentLinesSchema).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const reversePaymentPostingSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(5),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
