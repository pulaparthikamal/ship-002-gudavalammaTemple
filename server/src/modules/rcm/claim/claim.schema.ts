import { z } from 'zod';
import {
  CLAIM_COVERAGE_PRIORITY_OPTIONS,
  CLAIM_PAYMENT_STATUS_OPTIONS,
  CLAIM_SCRUB_STATUS_OPTIONS,
  CLAIM_STATUS_OPTIONS,
  CLAIM_SUBMISSION_STATUS_OPTIONS,
  CLAIM_TYPE_OPTIONS,
  CLAIM_CLOSURE_STATUS_OPTIONS,
} from './claim.constants';

const claimLinesSchema = z.object({
  lineNumber: z.coerce.number().optional(),
  chargeLineId: z.string().trim().optional(),
  cptCode: z.string().trim().optional(),
  modifiers: z.array(z.string().trim()).optional(),
  icdPointers: z.array(z.coerce.number()).optional(),
  units: z.coerce.number().optional(),
  chargeAmount: z.coerce.number().optional(),
  renderingProviderId: z.string().trim().optional(),
  placeOfService: z.string().trim().optional(),
  serviceDateFrom: z.coerce.date().optional(),
  serviceDateTo: z.coerce.date().optional(),
  expectedAllowedAmount: z.coerce.number().optional(),
  expectedInsurancePayment: z.coerce.number().optional(),
  expectedPatientResponsibility: z.coerce.number().optional(),
  patientCopayAmount: z.coerce.number().optional(),
  patientCoinsuranceAmount: z.coerce.number().optional(),
  deductibleAppliedAmount: z.coerce.number().optional(),
  feeScheduleId: z.string().trim().optional(),
  pricingMatchedBy: z.string().trim().optional(),
  pricingSource: z.string().trim().optional(),
  pricingSnapshotDate: z.coerce.date().optional(),
  coverageRuleSnapshot: z.record(z.unknown()).optional(),
  payerRuleSnapshot: z.record(z.unknown()).optional(),
  eligibilityVerificationId: z.string().trim().optional(),
  priorAuthorizationId: z.string().trim().optional(),
  referralId: z.string().trim().optional(),
  authorizationRequired: z.boolean().optional(),
  referralRequired: z.boolean().optional(),
  networkStatus: z.string().trim().optional(),
});

const attachmentSchema = z.object({
  documentType: z.string().trim().optional(),
  title: z.string().trim().optional(),
  fileUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

const coveragePrioritySchema = z.enum(CLAIM_COVERAGE_PRIORITY_OPTIONS);
const claimTypeSchema = z.enum(CLAIM_TYPE_OPTIONS);
const claimStatusSchema = z.enum(CLAIM_STATUS_OPTIONS);
const claimScrubStatusSchema = z.enum(CLAIM_SCRUB_STATUS_OPTIONS);
const claimSubmissionStatusSchema = z.enum(CLAIM_SUBMISSION_STATUS_OPTIONS);
const claimPaymentStatusSchema = z.enum(CLAIM_PAYMENT_STATUS_OPTIONS);
const claimClosureStatusSchema = z.enum(CLAIM_CLOSURE_STATUS_OPTIONS);

export const createClaimSchema = z.object({
  body: z.object({
    chargeId: z.string().trim().optional(),
    encounterId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    billingProviderId: z.string().trim().optional(),
    renderingProviderId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    claimDate: z.coerce.date().optional(),
    totalChargeAmount: z.coerce.number().optional(),
    coveragePriority: coveragePrioritySchema.optional(),
    frequencyCode: z.string().trim().optional(),
    claimType: claimTypeSchema.optional(),
    claimStatus: claimStatusSchema.optional(),
    scrubStatus: claimScrubStatusSchema.optional(),
    submissionStatus: claimSubmissionStatusSchema.optional(),
    paymentStatus: claimPaymentStatusSchema.optional(),
    closureStatus: claimClosureStatusSchema.optional(),
    closeReason: z.string().trim().optional(),
    reopenReason: z.string().trim().optional(),
    expectedEraBy: z.coerce.date().optional(),
    lastPayerFollowUpAt: z.coerce.date().optional(),
    followUpCount: z.coerce.number().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    rejectionReason: z.string().trim().optional(),
    originalClaimId: z.string().trim().optional(),
    correctedFromClaimId: z.string().trim().optional(),
    sourceDenialId: z.string().trim().optional(),
    correctedClaimRecordId: z.string().trim().optional(),
    correctionType: z.string().trim().optional(),
    lineageChain: z.array(z.string().trim()).optional(),
    correctedClaimIndicator: z.boolean().optional(),
    batchId: z.string().trim().optional(),
    clearingHouse: z.string().trim().optional(),
    ediStatus: z.string().trim().optional(),
    snapshotStatus: z.string().trim().optional(),
    snapshotIssues: z.array(z.string().trim()).optional(),
    sourceChargeUpdatedAt: z.coerce.date().optional(),
    sourceCodingReviewUpdatedAt: z.coerce.date().optional(),
    sourceCodingSnapshotHash: z.string().trim().optional(),
    claimLines: z.array(claimLinesSchema).optional(),
    attachments: z.array(attachmentSchema).max(12).optional(),
    active: z.boolean().optional(),
  }),
});

export const updateClaimSchema = z.object({
  body: z.object({
    chargeId: z.string().trim().optional(),
    encounterId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    billingProviderId: z.string().trim().optional(),
    renderingProviderId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    claimDate: z.coerce.date().optional(),
    totalChargeAmount: z.coerce.number().optional(),
    coveragePriority: coveragePrioritySchema.optional(),
    frequencyCode: z.string().trim().optional(),
    claimType: claimTypeSchema.optional(),
    claimStatus: claimStatusSchema.optional(),
    scrubStatus: claimScrubStatusSchema.optional(),
    submissionStatus: claimSubmissionStatusSchema.optional(),
    paymentStatus: claimPaymentStatusSchema.optional(),
    closureStatus: claimClosureStatusSchema.optional(),
    closeReason: z.string().trim().optional(),
    reopenReason: z.string().trim().optional(),
    expectedEraBy: z.coerce.date().optional(),
    lastPayerFollowUpAt: z.coerce.date().optional(),
    followUpCount: z.coerce.number().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    rejectionReason: z.string().trim().optional(),
    originalClaimId: z.string().trim().optional(),
    correctedFromClaimId: z.string().trim().optional(),
    sourceDenialId: z.string().trim().optional(),
    correctedClaimRecordId: z.string().trim().optional(),
    correctionType: z.string().trim().optional(),
    lineageChain: z.array(z.string().trim()).optional(),
    correctedClaimIndicator: z.boolean().optional(),
    batchId: z.string().trim().optional(),
    clearingHouse: z.string().trim().optional(),
    ediStatus: z.string().trim().optional(),
    snapshotStatus: z.string().trim().optional(),
    snapshotIssues: z.array(z.string().trim()).optional(),
    sourceChargeUpdatedAt: z.coerce.date().optional(),
    sourceCodingReviewUpdatedAt: z.coerce.date().optional(),
    sourceCodingSnapshotHash: z.string().trim().optional(),
    claimLines: z.array(claimLinesSchema).optional(),
    attachments: z.array(attachmentSchema).max(12).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const resubmitClaimSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
  body: updateClaimSchema.shape.body.optional(),
});

export const createClaimFromChargeSchema = z.object({
  params: z.object({
    chargeId: z.string().min(24),
  }),
});

export const submitClaimSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const closeClaimSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
  body: z.object({
    reason: z.string().trim().min(5),
  }),
});

export const reopenClaimSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
  body: z.object({
    reason: z.string().trim().min(5),
  }),
});

export const claimReadinessSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const claimStatusInquirySchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const refreshClaimStatusSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const claimAiReadinessReviewSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const claimAiRejectionAnalysisSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const runClaimEligibilitySchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const refreshClaimPricingSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const linkClaimAuthorizationSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
  body: z.object({
    authorizationId: z.string().trim().min(24).optional(),
  }).optional(),
});

export const linkClaimReferralSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
  body: z.object({
    referralId: z.string().trim().min(24).optional(),
  }).optional(),
});

export const scrubClaimSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

const looseObjectSchema = z.record(z.unknown()).optional();

export const predictClaimDenialSchema = z.object({
  body: z.object({
    patientDetails: looseObjectSchema,
    providerDetails: looseObjectSchema,
    insuranceDetails: looseObjectSchema,
    cptCodes: z.array(z.string().trim()).optional(),
    icdCodes: z.array(z.string().trim()).optional(),
    modifiers: z.array(z.string().trim()).optional(),
    authorizationInfo: looseObjectSchema,
    claimAmount: z.union([z.string().trim(), z.coerce.number()]).optional(),
    dateOfService: z.string().trim().optional(),
    demographics: looseObjectSchema,
    claimNotes: z.string().trim().optional(),
  }),
});
