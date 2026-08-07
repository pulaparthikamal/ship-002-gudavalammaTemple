import { z } from 'zod';

export const createEraEobProcessingSchema = z.object({
  body: z.object({
    payerId: z.string().trim().optional(),
    payerName: z.string().trim().optional(),
    paymentId: z.string().trim().optional(),
    eraReceived: z.boolean().optional(),
    eraFileReference: z.string().trim().optional(),
    eraBatchId: z.string().trim().optional(),
    depositId: z.string().trim().optional(),
    raw835FileReference: z.string().trim().optional(),
    rawPayloadRedacted: z.string().optional(),
    raw835Payload: z.string().optional(),
    rawPayloadStored: z.boolean().optional(),
    idempotencyKey: z.string().trim().optional(),
    sourceType: z.string().trim().optional(),
    checkNumber: z.string().trim().optional(),
    paymentTraceNumber: z.string().trim().optional(),
    paymentMethod: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    totalAmount: z.coerce.number().optional(),
    totalPaymentAmount: z.coerce.number().optional(),
    depositAmount: z.coerce.number().optional(),
    postedAmount: z.coerce.number().optional(),
    claimPaidAmount: z.coerce.number().optional(),
    serviceLinePaidAmount: z.coerce.number().optional(),
    adjustmentTotal: z.coerce.number().optional(),
    patientResponsibilityTotal: z.coerce.number().optional(),
    unmatchedAmount: z.coerce.number().optional(),
    reconciliationStatus: z.enum(['RECEIVED', 'PARSED', 'POSTED', 'PARTIALLY_POSTED', 'RECONCILED', 'EXCEPTION']).optional(),
    accountingLocked: z.boolean().optional(),
    accountingLockedAt: z.coerce.date().optional(),
    accountingLockedBy: z.string().trim().optional(),
    accountingLockReason: z.string().trim().optional(),
    accountingUnlockedAt: z.coerce.date().optional(),
    accountingUnlockedBy: z.string().trim().optional(),
    accountingUnlockReason: z.string().trim().optional(),
    exceptionReason: z.string().trim().optional(),
    receivedDate: z.coerce.date().optional(),
    importStatus: z.string().trim().optional(),
    parsedStatus: z.string().trim().optional(),
    fileMetadata: z.record(z.unknown()).optional(),
    matchedClaims: z.array(z.record(z.unknown())).optional(),
    unmatchedClaims: z.array(z.record(z.unknown())).optional(),
    parseErrors: z.array(z.string().trim()).optional(),
    importErrors: z.array(z.string().trim()).optional(),
    active: z.boolean().optional(),
  }),
});

export const updateEraEobProcessingSchema = z.object({
  body: z.object({
    payerId: z.string().trim().optional(),
    payerName: z.string().trim().optional(),
    paymentId: z.string().trim().optional(),
    eraReceived: z.boolean().optional(),
    eraFileReference: z.string().trim().optional(),
    eraBatchId: z.string().trim().optional(),
    depositId: z.string().trim().optional(),
    raw835FileReference: z.string().trim().optional(),
    rawPayloadRedacted: z.string().optional(),
    raw835Payload: z.string().optional(),
    rawPayloadStored: z.boolean().optional(),
    idempotencyKey: z.string().trim().optional(),
    sourceType: z.string().trim().optional(),
    checkNumber: z.string().trim().optional(),
    paymentTraceNumber: z.string().trim().optional(),
    paymentMethod: z.string().trim().optional(),
    paymentDate: z.coerce.date().optional(),
    totalAmount: z.coerce.number().optional(),
    totalPaymentAmount: z.coerce.number().optional(),
    depositAmount: z.coerce.number().optional(),
    postedAmount: z.coerce.number().optional(),
    claimPaidAmount: z.coerce.number().optional(),
    serviceLinePaidAmount: z.coerce.number().optional(),
    adjustmentTotal: z.coerce.number().optional(),
    patientResponsibilityTotal: z.coerce.number().optional(),
    unmatchedAmount: z.coerce.number().optional(),
    reconciliationStatus: z.enum(['RECEIVED', 'PARSED', 'POSTED', 'PARTIALLY_POSTED', 'RECONCILED', 'EXCEPTION']).optional(),
    accountingLocked: z.boolean().optional(),
    accountingLockedAt: z.coerce.date().optional(),
    accountingLockedBy: z.string().trim().optional(),
    accountingLockReason: z.string().trim().optional(),
    accountingUnlockedAt: z.coerce.date().optional(),
    accountingUnlockedBy: z.string().trim().optional(),
    accountingUnlockReason: z.string().trim().optional(),
    exceptionReason: z.string().trim().optional(),
    receivedDate: z.coerce.date().optional(),
    importStatus: z.string().trim().optional(),
    parsedStatus: z.string().trim().optional(),
    fileMetadata: z.record(z.unknown()).optional(),
    matchedClaims: z.array(z.record(z.unknown())).optional(),
    unmatchedClaims: z.array(z.record(z.unknown())).optional(),
    parseErrors: z.array(z.string().trim()).optional(),
    importErrors: z.array(z.string().trim()).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const import835Schema = z.object({
  body: z.object({
    raw835Text: z.string().min(1, 'Raw X12 835 text is required.'),
    fileMetadata: z.record(z.unknown()).optional(),
    payerId: z.string().trim().optional(),
    payerName: z.string().trim().optional(),
    eraFileReference: z.string().trim().optional(),
    eraBatchId: z.string().trim().optional(),
    depositId: z.string().trim().optional(),
    depositAmount: z.coerce.number().optional(),
    idempotencyKey: z.string().trim().optional(),
    sourceType: z.string().trim().optional(),
    receivedDate: z.coerce.date().optional(),
  }),
});

export const lockEraEobProcessingSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'Lock reason is required.').optional(),
  }).optional(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const unlockEraEobProcessingSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'Unlock reason is required.'),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const replayEraEobProcessingSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1, 'Replay reason is required.'),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
