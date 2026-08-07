import { z } from 'zod';

export const createAppealSchema = z.object({
  body: z.object({
    claimId: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    arWorkItemId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    denialCode: z.string().trim().optional(),
    appealCategory: z.string().trim().optional(),
    dueDate: z.coerce.date().optional(),
    owner: z.string().trim().optional(),
    appealLevel: z.string().trim().optional(),
    appealReason: z.string().trim().optional(),
    appealDescription: z.string().trim().optional(),
    supportingDocuments: z.array(z.string().trim()).optional(),
    appealStatus: z.string().trim().optional(),
    submissionDate: z.coerce.date().optional(),
    submittedAt: z.coerce.date().optional(),
    payerReceivedAt: z.coerce.date().optional(),
    decisionAt: z.coerce.date().optional(),
    appealDeadline: z.coerce.date().optional(),
    submissionMethod: z.string().trim().optional(),
    payerResponse: z.string().trim().optional(),
    resolution: z.string().trim().optional(),
    outcome: z.string().trim().optional(),
    outcomeDate: z.coerce.date().optional(),
    appealOutcomeReason: z.string().trim().optional(),
    evidenceSummary: z.string().trim().optional(),
    decisionNotes: z.string().trim().optional(),
    closeReason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    outcomeCategory: z.string().trim().optional(),
    payerReferenceNumber: z.string().trim().optional(),
    expectedReprocessBy: z.coerce.date().optional(),
    relatedPaymentPostingId: z.string().trim().optional(),
    relatedEraId: z.string().trim().optional(),
    medicalNecessityNotes: z.string().trim().optional(),
    authorizationEvidence: z.string().trim().optional(),
    eligibilityEvidence: z.string().trim().optional(),
    priorPayerResponse: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateAppealSchema = z.object({
  body: z.object({
    claimId: z.string().trim().optional(),
    denialId: z.string().trim().optional(),
    arWorkItemId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    denialCode: z.string().trim().optional(),
    appealCategory: z.string().trim().optional(),
    dueDate: z.coerce.date().optional(),
    owner: z.string().trim().optional(),
    appealLevel: z.string().trim().optional(),
    appealReason: z.string().trim().optional(),
    appealDescription: z.string().trim().optional(),
    supportingDocuments: z.array(z.string().trim()).optional(),
    appealStatus: z.string().trim().optional(),
    submissionDate: z.coerce.date().optional(),
    submittedAt: z.coerce.date().optional(),
    payerReceivedAt: z.coerce.date().optional(),
    decisionAt: z.coerce.date().optional(),
    appealDeadline: z.coerce.date().optional(),
    submissionMethod: z.string().trim().optional(),
    payerResponse: z.string().trim().optional(),
    resolution: z.string().trim().optional(),
    outcome: z.string().trim().optional(),
    outcomeDate: z.coerce.date().optional(),
    appealOutcomeReason: z.string().trim().optional(),
    evidenceSummary: z.string().trim().optional(),
    decisionNotes: z.string().trim().optional(),
    payerReferenceNumber: z.string().trim().optional(),
    expectedReprocessBy: z.coerce.date().optional(),
    relatedPaymentPostingId: z.string().trim().optional(),
    relatedEraId: z.string().trim().optional(),
    medicalNecessityNotes: z.string().trim().optional(),
    authorizationEvidence: z.string().trim().optional(),
    eligibilityEvidence: z.string().trim().optional(),
    priorPayerResponse: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createAppealFromDenialSchema = z.object({
  body: z.object({
    appealReason: z.string().trim().optional(),
    appealCategory: z.string().trim().optional(),
    appealLevel: z.string().trim().optional(),
    owner: z.string().trim().optional(),
    dueDate: z.coerce.date().optional(),
  }).optional(),
  params: z.object({
    denialId: z.string().min(24),
  }),
});

export const appealStatusSchema = z.object({
  body: z.object({
    appealStatus: z.enum([
      'DRAFT',
      'PACKET_GENERATED',
      'READY',
      'SUBMITTED',
      'PAYER_RECEIVED',
      'PAYER_REVIEW',
      'IN_REVIEW',
      'MORE_INFO_REQUIRED',
      'EVIDENCE_SUBMITTED',
      'OVERTURNED',
      'PARTIALLY_OVERTURNED',
      'UPHELD',
      'WITHDRAWN',
      'CLOSED',
      'PENDING',
    ]),
    submissionDate: z.coerce.date().optional(),
    payerResponse: z.string().trim().optional(),
    resolution: z.string().trim().optional(),
    outcome: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealActionSchema = z.object({
  body: z.object({
    reason: z.string().trim().optional(),
    submissionMethod: z.string().trim().optional(),
    submissionChannel: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
    trackingNumber: z.string().trim().optional(),
    confirmationNumber: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    deliveryStatus: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CONFIRMED']).optional(),
    submittedAt: z.coerce.date().optional(),
    payerReceivedAt: z.coerce.date().optional(),
    payerReferenceNumber: z.string().trim().optional(),
    payerResponse: z.string().trim().optional(),
    decisionNotes: z.string().trim().optional(),
    closeReason: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    outcomeCategory: z.string().trim().optional(),
    outcome: z.enum(['OVERTURNED', 'PARTIALLY_OVERTURNED', 'UPHELD']).optional(),
    expectedReprocessBy: z.coerce.date().optional(),
    payerResponseDueAt: z.coerce.date().optional(),
    relatedPaymentPostingId: z.string().trim().optional(),
    relatedEraId: z.string().trim().optional(),
    evidenceItems: z.array(z.record(z.unknown())).optional(),
    correspondence: z.record(z.unknown()).optional(),
  }).optional(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealTemplatePreviewSchema = z.object({
  body: z.object({
    templateId: z.string().trim().optional(),
    templateName: z.string().trim().optional(),
    templateType: z.string().trim().optional(),
    templateVersion: z.number().int().positive().optional(),
    bodyTemplate: z.string().trim().optional(),
    active: z.boolean().optional(),
    placeholders: z.record(z.unknown()).optional(),
  }).optional(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealReadinessSchema = z.object({
  body: z.object({
    reason: z.string().trim().optional(),
  }).optional(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealFinalPacketSchema = z.object({
  body: z.object({
    reason: z.string().trim().optional(),
    allowBlockedFinalPacket: z.boolean().optional(),
    submissionMethod: z.string().trim().optional(),
    submissionChannel: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
  }).optional(),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealDocumentSchema = z.object({
  body: z.object({
    documentType: z.string().trim().optional(),
    fileName: z.string().trim(),
    fileSize: z.number().nonnegative().optional(),
    fileSizeBytes: z.number().nonnegative().optional(),
    fileReference: z.string().trim().optional(),
    fileUrl: z.string().trim().optional(),
    mimeType: z.string().trim().optional(),
    contentBase64: z.string().optional(),
    notes: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
    documentId: z.string().optional(),
  }),
});

export const appealDocumentRemoveSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(1),
  }),
  params: z.object({
    id: z.string().min(24),
    documentId: z.string().min(8),
  }),
});

export const appealCorrespondenceSchema = z.object({
  body: z.object({
    correspondenceType: z.string().trim().optional(),
    type: z.string().trim().optional(),
    timestamp: z.coerce.date().optional(),
    status: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CONFIRMED']).optional(),
    deliveryStatus: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CONFIRMED']).optional(),
    notes: z.string().trim().optional(),
    reason: z.string().trim().optional(),
    trackingNumber: z.string().trim().optional(),
    confirmationNumber: z.string().trim().optional(),
    destination: z.string().trim().optional(),
    channel: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
    submissionChannel: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
    submissionMethod: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealSubmissionProofSchema = z.object({
  body: z.object({
    channel: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
    submissionChannel: z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL']).optional(),
    confirmationNumber: z.string().trim().optional(),
    trackingNumber: z.string().trim().optional(),
    proofDocumentReference: z.string().trim().optional(),
    fileReference: z.string().trim().optional(),
    deliveredAt: z.coerce.date().optional(),
    deliveryStatus: z.enum(['PENDING', 'SENT', 'DELIVERED', 'FAILED', 'CONFIRMED']).optional(),
    destination: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    reason: z.string().trim().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const appealTemplateSchema = z.object({
  body: z.object({
    templateName: z.string().trim().min(1),
    templateType: z.string().trim().min(1),
    templateVersion: z.number().int().positive().optional(),
    bodyTemplate: z.string().trim().min(1),
    active: z.boolean().optional(),
  }),
});

export const appealPayerRuleSchema = z.object({
  body: z.object({
    payerId: z.string().trim().min(1),
    payerName: z.string().trim().optional(),
    effectiveDate: z.coerce.date().optional(),
    expirationDate: z.coerce.date().optional(),
    requiredEvidence: z.array(z.string().trim()).optional(),
    requiredForms: z.array(z.string().trim()).optional(),
    allowedSubmissionChannels: z.array(z.enum(['FAX', 'EMAIL', 'PORTAL', 'MAIL', 'MANUAL'])).optional(),
    deadlineDays: z.number().int().positive().optional(),
    appealLevels: z.array(z.string().trim()).optional(),
    active: z.boolean().optional(),
  }),
});

export const appealTemplateVersionSchema = z.object({
  body: z.object({
    templateName: z.string().trim().optional(),
    templateType: z.string().trim().optional(),
    templateVersion: z.number().int().positive().optional(),
    bodyTemplate: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    templateId: z.string().min(24),
  }),
});

export const appealTemplateStatusSchema = z.object({
  params: z.object({
    templateId: z.string().min(24),
  }),
});
