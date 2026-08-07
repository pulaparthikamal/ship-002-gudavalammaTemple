import { z } from 'zod';
import { normalizeUsState } from '../shared/state-normalization';

export const SINGLE_CPT_CDT_ERROR = 'Only one CPT/CDT/HCPCS code allowed per fee schedule record';
const SINGLE_CPT_CDT_PATTERN = /^[A-Z0-9]{5}$/i;

export const singleCptCdtCodeSchema = z.unknown().transform((value, ctx) => {
  if (Array.isArray(value) || typeof value !== 'string') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: SINGLE_CPT_CDT_ERROR });
    return z.NEVER;
  }

  const normalizedValue = value.trim().toUpperCase();

  if (!normalizedValue || /[,\s]/.test(normalizedValue) || !SINGLE_CPT_CDT_PATTERN.test(normalizedValue)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: SINGLE_CPT_CDT_ERROR });
    return z.NEVER;
  }

  return normalizedValue;
});

const feeScheduleBaseSchema = z.object({
  payerId: z.string().min(1, 'Payer ID is required'),
  cptCode: singleCptCdtCodeSchema,
  modifiers: z.array(z.string().trim().transform((value) => value.toUpperCase())).optional().default([]),
  providerId: z.string().optional(),
  facilityId: z.string().optional(),
  state: z.string().optional().transform((value) => normalizeUsState(value)),
  placeOfServiceCode: z.string().optional().transform((value) => value?.trim() || undefined),
  planName: z.string().optional().transform((value) => value?.trim() || undefined),
  groupNumber: z.string().optional().transform((value) => value?.trim() || undefined),
  network: z.string().optional().transform((value) => value?.trim() || undefined),
  coverageType: z.string().optional().transform((value) => value?.trim() || undefined),
  allowedAmount: z.number().min(0, 'Allowed amount must be non-negative'),
  effectiveDate: z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce.date().optional()),
  expiryDate: z.preprocess((value) => (value === '' || value === null ? undefined : value), z.coerce.date().optional()),
  active: z.boolean().optional().default(true),
});

export const feeScheduleSchema = feeScheduleBaseSchema.superRefine((value, context) => {
  if (
    value.effectiveDate instanceof Date &&
    value.expiryDate instanceof Date &&
    value.expiryDate.getTime() < value.effectiveDate.getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiryDate'],
      message: 'Expiry date must be on or after the effective date.',
    });
  }
});

export const updateFeeScheduleSchema = feeScheduleBaseSchema.partial().superRefine((value, context) => {
  if (
    value.effectiveDate instanceof Date &&
    value.expiryDate instanceof Date &&
    value.expiryDate.getTime() < value.effectiveDate.getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiryDate'],
      message: 'Expiry date must be on or after the effective date.',
    });
  }
});

export const feeScheduleLookupSchema = z.object({
  body: z.object({
    payerId: z.string().min(1, 'Payer ID is required'),
    providerId: z.string().optional(),
    facilityId: z.string().optional(),
    state: z.string().optional().transform((value) => normalizeUsState(value)),
    placeOfServiceCode: z.string().optional().transform((value) => value?.trim() || undefined),
    cptCode: singleCptCdtCodeSchema,
    modifiers: z.array(z.string().trim().transform((value) => value.toUpperCase())).optional().default([]),
    planName: z.string().optional().transform((value) => value?.trim() || undefined),
    groupNumber: z.string().optional().transform((value) => value?.trim() || undefined),
    network: z.string().optional().transform((value) => value?.trim() || undefined),
    coverageType: z.string().optional().transform((value) => value?.trim() || undefined),
    serviceDate: z.coerce.date().optional(),
  }),
});
