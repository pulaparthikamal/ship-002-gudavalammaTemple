import { z } from 'zod';

const CPT_CODE_PATTERN = /^[A-Z0-9]{5}$/i;
const REVENUE_CODE_PATTERN = /^\d{4}$/;
const PLACE_OF_SERVICE_PATTERN = /^\d{2}$/;
const MODIFIER_PATTERN = /^[A-Z0-9]{2}$/i;
const ICD_10_CODE_PATTERN = /^[A-TV-Z][0-9][0-9A-Z](?:\.[0-9A-Z]{1,4})?$/i;

const chargeMasterBodyFields = {
  cptCode: z.string().trim().min(1),
  description: z.string().trim().min(1),
  revenueCode: z.string().trim().optional(),
  defaultChargeAmount: z.coerce.number().positive(),
  defaultAllowedAmount: z.coerce.number().min(0).optional(),
  placeOfService: z.string().trim().min(1),
  modifiersAllowed: z.array(z.string().trim()).optional(),
  diagnosisRestrictions: z.array(z.string().trim()).optional(),
  effectiveDate: z.coerce.date(),
  terminationDate: z.coerce.date().optional(),
  activeFlag: z.boolean().optional(),
  active: z.boolean().optional(),
};

const chargeMasterBodySchema = z.object(chargeMasterBodyFields).superRefine((value, context) => {
  if (!CPT_CODE_PATTERN.test(value.cptCode)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cptCode'],
      message: 'CPT/HCPCS code must be a valid 5-character code.',
    });
  }

  if (value.revenueCode && !REVENUE_CODE_PATTERN.test(value.revenueCode)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['revenueCode'],
      message: 'Revenue code must be a valid 4-digit code.',
    });
  }

  if (!PLACE_OF_SERVICE_PATTERN.test(value.placeOfService)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['placeOfService'],
      message: 'Place of service must be a valid 2-digit code.',
    });
  }

  if (
    value.terminationDate instanceof Date
    && value.terminationDate.getTime() < value.effectiveDate.getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminationDate'],
      message: 'Termination date must be on or after the effective date.',
    });
  }

  if (
    typeof value.defaultAllowedAmount === 'number'
    && value.defaultAllowedAmount > value.defaultChargeAmount
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['defaultAllowedAmount'],
      message: 'Default allowed amount should not exceed the default charge amount.',
    });
  }

  const invalidModifier = (value.modifiersAllowed ?? []).find((item) => !MODIFIER_PATTERN.test(item));
  if (invalidModifier) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['modifiersAllowed'],
      message: `Modifier ${invalidModifier} must be a valid 2-character value.`,
    });
  }

  const invalidDiagnosisRestriction = (value.diagnosisRestrictions ?? []).find(
    (item) => !ICD_10_CODE_PATTERN.test(item)
  );
  if (invalidDiagnosisRestriction) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['diagnosisRestrictions'],
      message: `Diagnosis restriction ${invalidDiagnosisRestriction} must be a valid ICD-10 code.`,
    });
  }
});

export const createChargeMasterSchema = z.object({
  body: chargeMasterBodySchema,
});

export const updateChargeMasterSchema = z.object({
  body: z.object(chargeMasterBodyFields).partial().superRefine((value, context) => {
    if (value.cptCode !== undefined && !CPT_CODE_PATTERN.test(value.cptCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['cptCode'],
        message: 'CPT/HCPCS code must be a valid 5-character code.',
      });
    }

    if (value.revenueCode !== undefined && value.revenueCode && !REVENUE_CODE_PATTERN.test(value.revenueCode)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['revenueCode'],
        message: 'Revenue code must be a valid 4-digit code.',
      });
    }

    if (
      value.placeOfService !== undefined
      && !PLACE_OF_SERVICE_PATTERN.test(value.placeOfService)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['placeOfService'],
        message: 'Place of service must be a valid 2-digit code.',
      });
    }

    if (
      value.effectiveDate instanceof Date
      && value.terminationDate instanceof Date
      && value.terminationDate.getTime() < value.effectiveDate.getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['terminationDate'],
        message: 'Termination date must be on or after the effective date.',
      });
    }

    if (
      typeof value.defaultAllowedAmount === 'number'
      && typeof value.defaultChargeAmount === 'number'
      && value.defaultAllowedAmount > value.defaultChargeAmount
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['defaultAllowedAmount'],
        message: 'Default allowed amount should not exceed the default charge amount.',
      });
    }

    const invalidModifier = (value.modifiersAllowed ?? []).find((item) => !MODIFIER_PATTERN.test(item));
    if (invalidModifier) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['modifiersAllowed'],
        message: `Modifier ${invalidModifier} must be a valid 2-character value.`,
      });
    }

    const invalidDiagnosisRestriction = (value.diagnosisRestrictions ?? []).find(
      (item) => !ICD_10_CODE_PATTERN.test(item)
    );
    if (invalidDiagnosisRestriction) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['diagnosisRestrictions'],
        message: `Diagnosis restriction ${invalidDiagnosisRestriction} must be a valid ICD-10 code.`,
      });
    }
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
