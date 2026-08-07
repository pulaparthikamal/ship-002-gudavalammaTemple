import { z } from 'zod';

export const createCorrectedClaimSchema = z.object({
  body: z.object({
    originalClaimId: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    sourceDenialId: z.string().trim().optional(),
    correctedFromClaimId: z.string().trim().optional(),
    clonedClaimId: z.string().trim().optional(),
    correctionReason: z.string().trim().optional(),
    correctionType: z.string().trim().optional(),
    frequencyCode: z.string().trim().optional(),
    resubmissionReason: z.string().trim().optional(),
    correctedFrequencyCode: z.string().trim().optional(),
    correctedClaimStatus: z.string().trim().optional(),
    correctedFieldsChanged: z.array(z.string().trim()).optional(),
    correctedFields: z.array(z.record(z.unknown())).optional(),
    lineageChain: z.array(z.string().trim()).optional(),
    correctionAudit: z.array(z.record(z.unknown())).optional(),
    submittedDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateCorrectedClaimSchema = z.object({
  body: z.object({
    originalClaimId: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    sourceDenialId: z.string().trim().optional(),
    correctedFromClaimId: z.string().trim().optional(),
    clonedClaimId: z.string().trim().optional(),
    correctionReason: z.string().trim().optional(),
    correctionType: z.string().trim().optional(),
    frequencyCode: z.string().trim().optional(),
    resubmissionReason: z.string().trim().optional(),
    correctedFrequencyCode: z.string().trim().optional(),
    correctedClaimStatus: z.string().trim().optional(),
    correctedFieldsChanged: z.array(z.string().trim()).optional(),
    correctedFields: z.array(z.record(z.unknown())).optional(),
    lineageChain: z.array(z.string().trim()).optional(),
    correctionAudit: z.array(z.record(z.unknown())).optional(),
    submittedDate: z.coerce.date().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const correctedClaimCorrectionsSchema = z.object({
  body: z.object({
    correctionReason: z.string().trim().optional(),
    correctionType: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    coveragePriority: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    priorAuthorizationId: z.string().trim().optional(),
    referralId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    billingProviderId: z.string().trim().optional(),
    renderingProviderId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    claimLines: z.array(z.object({
      claimLineId: z.string().trim(),
      modifiers: z.array(z.string().trim()).optional(),
      icdPointers: z.array(z.coerce.number()).optional(),
      priorAuthorizationId: z.string().trim().optional(),
      referralId: z.string().trim().optional(),
    })).optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const correctedClaimFromDenialSchema = z.object({
  body: z.object({
    correctionType: z.enum(['REPLACEMENT', 'VOID']).optional(),
    correctionReason: z.string().trim().optional(),
  }).optional(),
  params: z.object({
    denialId: z.string().min(24),
  }),
});

export const correctedClaimFromClaimSchema = z.object({
  body: z.object({
    correctionType: z.enum(['REPLACEMENT', 'VOID']).optional(),
    correctionReason: z.string().trim().optional(),
  }).optional(),
  params: z.object({
    claimId: z.string().min(24),
  }),
});
