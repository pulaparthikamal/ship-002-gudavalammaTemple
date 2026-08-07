import { z } from 'zod';

const patientBillingLineItemSchema = z.object({
  claimLineId: z.string().trim().optional(),
  procedureCode: z.string().trim().optional(),
  serviceDate: z.coerce.date().optional(),
  description: z.string().trim().optional(),
  allowedAmount: z.coerce.number().optional(),
  insurancePaid: z.coerce.number().optional(),
  adjustments: z.coerce.number().optional(),
  patientResponsibility: z.coerce.number().optional(),
});

const patientBillingBodySchema = z.object({
  patientId: z.string().trim().optional(),
  chargeId: z.string().trim().optional(),
  encounterId: z.string().trim().optional(),
  claimId: z.string().trim().optional(),
  paymentPostingId: z.string().trim().optional(),
  statementNumber: z.string().trim().optional(),
  statementDate: z.coerce.date().optional(),
  statementCycle: z.string().trim().optional(),
  billingCycle: z.string().trim().optional(),
  originalBalance: z.coerce.number().optional(),
  currentBalance: z.coerce.number().optional(),
  insurancePaid: z.coerce.number().optional(),
  adjustments: z.coerce.number().optional(),
  patientPayments: z.coerce.number().optional(),
  patientBalance: z.coerce.number().optional(),
  amountPaid: z.coerce.number().optional(),
  amountDue: z.coerce.number().optional(),
  dueDate: z.coerce.date().optional(),
  lastStatementSent: z.coerce.date().optional(),
  collectionsFlag: z.boolean().optional(),
  writeOffFlag: z.boolean().optional(),
  refundFlag: z.boolean().optional(),
  refundAmount: z.coerce.number().optional(),
  creditBalanceAmount: z.coerce.number().optional(),
  paymentPlanId: z.string().trim().optional(),
  statementStatus: z.string().trim().optional(),
  status: z.enum(['DRAFT', 'READY_TO_SEND', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'COLLECTIONS_READY', 'VOID']).optional(),
  agingBucket: z.string().trim().optional(),
  lineItems: z.array(patientBillingLineItemSchema).optional(),
  active: z.boolean().optional(),
});

export const createPatientBillingSchema = z.object({
  body: patientBillingBodySchema,
});

export const updatePatientBillingSchema = z.object({
  body: patientBillingBodySchema.partial(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createPatientBillingFromPostingSchema = z.object({
  params: z.object({
    paymentPostingId: z.string().min(24),
  }),
});

export const patientBillingActionSchema = z.object({
  params: z.object({
    id: z.string().min(24),
    action: z.string().trim().min(1),
  }),
  body: z.object({
    reason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});
