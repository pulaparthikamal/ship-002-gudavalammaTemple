import { z } from 'zod';

export const retryClaimSubmissionSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const ingestClaimAcknowledgementSchema = z.object({
  body: z.object({
    submissionTraceId: z.string().trim().optional(),
    externalSubmissionId: z.string().trim().optional(),
    claimId: z.string().trim().optional(),
    batchId: z.string().trim().optional(),
    acknowledgementType: z.string().trim().optional(),
    acknowledgementStatus: z.string().trim().optional(),
    transmissionStatus: z.string().trim().optional(),
    trackingSource: z.enum(['REAL', 'SIMULATED']).optional(),
    responseType: z.enum(['SUBMISSION', 'ACK_999', 'ACK_277CA', 'STATUS_UPDATE']).optional(),
    claimControlNumber: z.string().trim().optional(),
    clearinghouseTraceNumber: z.string().trim().optional(),
    payerClaimNumber: z.string().trim().optional(),
    statusCode: z.string().trim().optional(),
    statusDescription: z.string().trim().optional(),
    receivedDate: z.coerce.date().optional(),
    rejectionLevel: z.string().trim().optional(),
    rejectionSource: z.string().trim().optional(),
    rejectionReasonCodes: z.array(z.string().trim()).optional(),
    stcCategoryCode: z.string().trim().optional(),
    stcStatusCode: z.string().trim().optional(),
    stcEntityCode: z.string().trim().optional(),
    affectedServiceLine: z.string().trim().optional(),
    nextActionRequired: z.string().trim().optional(),
    rawPayload: z.unknown().optional(),
  }),
});
