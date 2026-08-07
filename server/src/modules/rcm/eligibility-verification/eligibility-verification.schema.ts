import { z } from 'zod';

const serviceTypeCodeSchema = z
  .string()
  .trim()
  .min(1, 'Service type code is required')
  .regex(/^[A-Z0-9]{1,3}$/i, 'Service type code must be 1 to 3 alphanumeric characters');

const eligibilityStatusValues = ['Eligible', 'Ineligible', 'Pending', 'Unable to Verify', 'Completed'] as const;
const coverageStatusValues = ['Active', 'Inactive', 'Terminated', 'Pending', 'Not Covered', 'Out of Network'] as const;
const verificationSourceValues = ['Manual', 'Payer Portal', 'Payer Phone', 'IVR', 'Clearinghouse'] as const;
const inactiveCoverageStatuses = new Set(['Inactive', 'Terminated', 'Not Covered']);

const eligibilityStatusSchema = z.enum(eligibilityStatusValues);
const coverageStatusSchema = z.enum(coverageStatusValues);
const verificationSourceSchema = z.enum(verificationSourceValues);
const optionalNonNegativeNumber = z.coerce.number().min(0).optional();
const optionalCoinsurancePercent = z.coerce.number().min(0).max(100).optional();

function applyManualEligibilityBusinessRules(
  value: {
    planActive: boolean;
    eligibilityStatus: (typeof eligibilityStatusValues)[number];
    coverageStatus: (typeof coverageStatusValues)[number];
    referralRequired: boolean;
    authorizationRequired: boolean;
    benefitNotes?: string;
    verificationSource: (typeof verificationSourceValues)[number];
    rawResponseReference?: string;
  },
  context: z.RefinementCtx
) {
  if (value.coverageStatus === 'Active' && !value.planActive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Plan active must be enabled when coverage status is Active.',
      path: ['planActive'],
    });
  }

  if (inactiveCoverageStatuses.has(value.coverageStatus) && value.planActive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Plan active cannot be enabled for inactive, terminated, or not-covered statuses.',
      path: ['coverageStatus'],
    });
  }

  if (value.eligibilityStatus === 'Eligible' && !value.planActive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Eligible verifications must have an active plan.',
      path: ['eligibilityStatus'],
    });
  }

  if (value.eligibilityStatus === 'Ineligible' && value.planActive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Ineligible verifications cannot have plan active enabled.',
      path: ['eligibilityStatus'],
    });
  }

  if (
    (!value.planActive ||
      value.referralRequired ||
      value.authorizationRequired ||
      value.eligibilityStatus === 'Pending' ||
      value.eligibilityStatus === 'Unable to Verify') &&
    !value.benefitNotes?.trim()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Benefit notes are required for inactive, pending, unable-to-verify, referral, or authorization cases.',
      path: ['benefitNotes'],
    });
  }

  if (value.verificationSource !== 'Manual' && !value.rawResponseReference?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reference number is required when the verification source is portal, phone, IVR, or clearinghouse.',
      path: ['rawResponseReference'],
    });
  }
}

export const createEligibilityVerificationSchema = z.object({
  body: z.object({
    appointmentId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    insuranceId: z.string().trim().min(24, 'Insurance policy is required'),
    payerId: z.string().trim().optional(),
    serviceTypeCode: serviceTypeCodeSchema,
    serviceDate: z.coerce.date().optional(),
    coveragePriority: z.string().trim().optional(),
    eligibilityStatus: eligibilityStatusSchema,
    coverageStatus: coverageStatusSchema,
    planActive: z.boolean(),
    copayAmount: optionalNonNegativeNumber,
    coinsurancePercent: optionalCoinsurancePercent,
    deductibleRemaining: optionalNonNegativeNumber,
    outOfPocketRemaining: optionalNonNegativeNumber,
    referralRequired: z.boolean(),
    authorizationRequired: z.boolean(),
    benefitNotes: z.string().trim().optional(),
    verificationSource: verificationSourceSchema,
    rawResponseReference: z.string().trim().optional(),
    active: z.boolean(),
  }).superRefine(applyManualEligibilityBusinessRules),
});

export const updateEligibilityVerificationSchema = z.object({
  body: z.object({
    appointmentId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    insuranceId: z.string().trim().min(24, 'Insurance policy is required'),
    payerId: z.string().trim().optional(),
    serviceTypeCode: serviceTypeCodeSchema,
    serviceDate: z.coerce.date().optional(),
    coveragePriority: z.string().trim().optional(),
    eligibilityStatus: eligibilityStatusSchema,
    coverageStatus: coverageStatusSchema,
    planActive: z.boolean(),
    copayAmount: optionalNonNegativeNumber,
    coinsurancePercent: optionalCoinsurancePercent,
    deductibleRemaining: optionalNonNegativeNumber,
    outOfPocketRemaining: optionalNonNegativeNumber,
    referralRequired: z.boolean(),
    authorizationRequired: z.boolean(),
    benefitNotes: z.string().trim().optional(),
    verificationSource: verificationSourceSchema,
    rawResponseReference: z.string().trim().optional(),
    active: z.boolean(),
  }).superRefine(applyManualEligibilityBusinessRules),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const runEligibilityVerificationSchema = z.object({
  body: z.object({
    appointmentId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    insuranceId: z.string().trim().min(24),
    serviceTypeCode: serviceTypeCodeSchema.optional(),
    serviceDate: z.coerce.date().optional(),
    coveragePriority: z.string().trim().optional(),
    procedureCodes: z.array(z.string().trim().min(1)).max(20).optional(),
  }),
});
