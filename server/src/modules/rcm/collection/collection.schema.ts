import { z } from 'zod';

const collectionStatusEnum = z.enum([
  'REVIEW',
  'ACTIVE',
  'CONTACTED',
  'PAYMENT_PLAN',
  'SETTLED',
  'WRITTEN_OFF',
  'EXTERNAL_COLLECTIONS_READY',
  'CLOSED',
]);

const collectionStageEnum = z.enum([
  'INTERNAL_FIRST_NOTICE',
  'INTERNAL_SECOND_NOTICE',
  'FINAL_NOTICE',
  'EXTERNAL_READY',
]);

const collectionBodySchema = z.object({
  patientId: z.string().trim().optional(),
  patientBillingId: z.string().trim().optional(),
  claimId: z.string().trim().optional(),
  originalBalance: z.coerce.number().optional(),
  currentBalance: z.coerce.number().optional(),
  daysPastDue: z.coerce.number().optional(),
  collectionStage: collectionStageEnum.optional(),
  status: collectionStatusEnum.optional(),
  owner: z.string().trim().optional(),
  lastContactDate: z.coerce.date().optional(),
  nextContactDate: z.coerce.date().optional(),
  contactAttempts: z.coerce.number().optional(),
  resolution: z.string().trim().optional(),
  writeOffAmount: z.coerce.number().optional(),
  settlementAmount: z.coerce.number().optional(),
  actionAudit: z.array(z.record(z.unknown())).optional(),
  dedupeKey: z.string().trim().optional(),
  balanceAmount: z.coerce.number().optional(),
  agencyName: z.string().trim().optional(),
  referredDate: z.coerce.date().optional(),
  collectionStatus: z.string().trim().optional(),
  recoveredAmount: z.coerce.number().optional(),
  closeDate: z.coerce.date().optional(),
  notes: z.string().trim().optional(),
  active: z.boolean().optional(),
});

export const createCollectionSchema = z.object({
  body: collectionBodySchema,
});

export const updateCollectionSchema = z.object({
  body: collectionBodySchema.partial(),
  params: z.object({
    id: z.string().min(24),
    action: z.string().trim(),
  }),
});

export const generateCollectionsSchema = z.object({
  body: z.object({
    daysOverdueThreshold: z.coerce.number().optional(),
    minimumBalance: z.coerce.number().optional(),
    maxContactAttempts: z.coerce.number().optional(),
    escalationIntervalDays: z.coerce.number().optional(),
    writeOffThreshold: z.coerce.number().optional(),
    settlementAllowed: z.boolean().optional(),
  }).optional(),
});

export const collectionActionSchema = z.object({
  params: z.object({
    id: z.string().min(24),
    action: z.string().trim().min(1),
  }),
  body: z.object({
    owner: z.string().trim().optional(),
    contactType: z.string().trim().optional(),
    contactOutcome: z.string().trim().optional(),
    nextContactDate: z.coerce.date().optional(),
    resolution: z.string().trim().optional(),
    writeOffAmount: z.coerce.number().optional(),
    settlementAmount: z.coerce.number().optional(),
    reason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
  }),
});
