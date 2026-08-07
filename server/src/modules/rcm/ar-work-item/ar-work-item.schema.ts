import { z } from 'zod';

const followUpHistorySchema = z.object({
  followUpDate: z.coerce.date().optional(),
  followUpType: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  performedBy: z.string().trim().optional(),
});

const contactHistorySchema = z.object({
  contactDate: z.coerce.date().optional(),
  contactType: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  outcome: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  performedBy: z.string().trim().optional(),
});

const arWorkItemBodySchema = z.object({
  claimId: z.string().trim().optional(),
  claimLineId: z.string().trim().optional(),
  denialId: z.string().trim().optional(),
  appealId: z.string().trim().optional(),
  correctedClaimId: z.string().trim().optional(),
  paymentPostingId: z.string().trim().optional(),
  patientId: z.string().trim().optional(),
  payerId: z.string().trim().optional(),
  category: z.enum([
    'PAYER_FOLLOW_UP',
    'DENIAL_REWORK',
    'UNDERPAYMENT',
    'NO_RESPONSE',
    'APPEAL_FOLLOW_UP',
    'CORRECTED_CLAIM_FOLLOW_UP',
    'PAYMENT_VARIANCE',
  ]).optional(),
  balanceAmount: z.coerce.number().optional(),
  expectedAmount: z.coerce.number().optional(),
  paidAmount: z.coerce.number().optional(),
  varianceAmount: z.coerce.number().optional(),
  agingBucket: z.string().trim().optional(),
  denialCode: z.string().trim().optional(),
  denialCategory: z.string().trim().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
  status: z.enum([
    'OPEN',
    'IN_PROGRESS',
    'WAITING_ON_PAYER',
    'WAITING_ON_INTERNAL',
    'RESOLVED',
    'ESCALATED',
    'CLOSED',
  ]).optional(),
  owner: z.string().trim().optional(),
  followUpDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  reason: z.string().trim().optional(),
  nextAction: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  dedupeKey: z.string().trim().optional(),
  sourceType: z.string().trim().optional(),
  sourceId: z.string().trim().optional(),
  assignedTo: z.string().trim().optional(),
  team: z.string().trim().optional(),
  rootCauseAnalysis: z.string().trim().optional(),
  suggestedFix: z.string().trim().optional(),
  nextFollowUpDate: z.coerce.date().optional(),
  appealRequired: z.boolean().optional(),
  correctedClaimRequired: z.boolean().optional(),
  escalationFlag: z.boolean().optional(),
  followUpHistory: z.array(followUpHistorySchema).optional(),
  contactHistory: z.array(contactHistorySchema).optional(),
  active: z.boolean().optional(),
});

export const createArWorkItemSchema = z.object({
  body: arWorkItemBodySchema,
});

export const updateArWorkItemSchema = z.object({
  body: arWorkItemBodySchema.partial(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const arWorkItemStatusSchema = z.object({
  body: z.object({
    status: z.enum(['OPEN', 'IN_PROGRESS', 'WAITING_ON_PAYER', 'WAITING_ON_INTERNAL', 'RESOLVED', 'ESCALATED', 'CLOSED']),
    owner: z.string().trim().optional(),
    reason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    nextAction: z.string().trim().optional(),
    followUpDate: z.coerce.date().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const arWorkItemContactSchema = z.object({
  body: contactHistorySchema,
  params: z.object({
    id: z.string().min(24),
  }),
});

export const generateArWorkItemsSchema = z.object({
  body: z.object({
    pendingResponseDays: z.coerce.number().optional(),
    appealFollowUpDays: z.coerce.number().optional(),
    correctedClaimFollowUpDays: z.coerce.number().optional(),
  }).optional(),
});
