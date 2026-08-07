import { z } from 'zod';

const optionalDateSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional()
);

const subscriberSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  dob: optionalDateSchema,
  gender: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
});

const cardSchema = z.object({
  frontImageUrl: z.string().trim().optional(),
  backImageUrl: z.string().trim().optional(),
});

const verificationSchema = z.object({
  lastVerifiedDateTime: optionalDateSchema,
  nextVerificationDueDate: optionalDateSchema,
});

const attachmentSchema = z.object({
  documentType: z.string().trim().optional(),
  title: z.string().trim().optional(),
  fileUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

const createInsurancePolicyBodySchema = z
  .object({
    patientId: z.string().trim().min(1),
    payerId: z.string().trim().min(1),
    ediPayerId: z.string().trim().optional(),
    payerType: z.string().trim().optional(),
    coverageType: z.string().trim().min(1),
    planName: z.string().trim().min(1),
    memberId: z.string().trim().min(1),
    subscriberId: z.string().trim().optional(),
    groupNumber: z.string().trim().optional(),
    dependentNumber: z.string().trim().optional(),
    coveragePriority: z.string().trim().min(1),
    coordinationOfBenefitsOrder: z.coerce.number().optional(),
    network: z.string().trim().optional(),
    effectiveDate: optionalDateSchema,
    terminationDate: optionalDateSchema,
    policyStatus: z.string().trim().min(1),
    relationshipToSubscriber: z.string().trim().min(1),
    insuranceVerifiedFlag: z.boolean().optional(),
    subscriber: subscriberSchema.optional(),
    card: cardSchema.optional(),
    verification: verificationSchema.optional(),
    attachments: z.array(attachmentSchema).max(6).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.effectiveDate && value.terminationDate && value.terminationDate < value.effectiveDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Termination date cannot be before effective date.',
        path: ['terminationDate'],
      });
    }

    if (
      value.verification?.lastVerifiedDateTime &&
      value.verification?.nextVerificationDueDate &&
      value.verification.nextVerificationDueDate < value.verification.lastVerifiedDateTime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Next verification due date cannot be before the last verified date.',
        path: ['verification', 'nextVerificationDueDate'],
      });
    }
  });

const updateInsurancePolicyBodySchema = z
  .object({
    patientId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    ediPayerId: z.string().trim().optional(),
    payerType: z.string().trim().optional(),
    coverageType: z.string().trim().optional(),
    planName: z.string().trim().optional(),
    memberId: z.string().trim().optional(),
    subscriberId: z.string().trim().optional(),
    groupNumber: z.string().trim().optional(),
    dependentNumber: z.string().trim().optional(),
    coveragePriority: z.string().trim().optional(),
    coordinationOfBenefitsOrder: z.coerce.number().optional(),
    network: z.string().trim().optional(),
    effectiveDate: optionalDateSchema,
    terminationDate: optionalDateSchema,
    policyStatus: z.string().trim().optional(),
    relationshipToSubscriber: z.string().trim().optional(),
    insuranceVerifiedFlag: z.boolean().optional(),
    subscriber: subscriberSchema.partial().optional(),
    card: cardSchema.partial().optional(),
    verification: verificationSchema.partial().optional(),
    attachments: z.array(attachmentSchema).max(6).optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.effectiveDate && value.terminationDate && value.terminationDate < value.effectiveDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Termination date cannot be before effective date.',
        path: ['terminationDate'],
      });
    }

    if (
      value.verification?.lastVerifiedDateTime &&
      value.verification?.nextVerificationDueDate &&
      value.verification.nextVerificationDueDate < value.verification.lastVerifiedDateTime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Next verification due date cannot be before the last verified date.',
        path: ['verification', 'nextVerificationDueDate'],
      });
    }
  });

export const createInsurancePolicySchema = z.object({
  body: createInsurancePolicyBodySchema,
});

export const updateInsurancePolicySchema = z.object({
  body: updateInsurancePolicyBodySchema,
  params: z.object({
    id: z.string().min(24),
  }),
});
