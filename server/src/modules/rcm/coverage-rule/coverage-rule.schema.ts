import { z } from 'zod';
import { normalizeUsState } from '../shared/state-normalization';
import { COVERAGE_RULE_SEVERITIES, COVERAGE_RULE_TYPES } from './coverage-rule.model';

const ruleValueSchema = z.union([
  z.record(z.unknown()),
  z.string(),
  z.number(),
  z.boolean(),
]).optional();

const coverageRuleBaseSchema = z.object({
  payerId: z.string().trim().optional().transform((value) => value || undefined),
  planName: z.string().trim().optional().transform((value) => value || undefined),
  groupNumber: z.string().trim().optional().transform((value) => value || undefined),
  state: z.string().trim().optional().transform((value) => normalizeUsState(value)),
  facilityId: z.string().trim().optional().transform((value) => value || undefined),
  providerId: z.string().trim().optional().transform((value) => value || undefined),
  cptCode: z.string().trim().optional().transform((value) => value ? value.toUpperCase() : undefined),
  diagnosisCodes: z.array(z.string().trim().transform((value) => value.toUpperCase())).optional().default([]),
  placeOfServiceCode: z.string().trim().optional().transform((value) => value || undefined),
  network: z.string().trim().optional().transform((value) => value || undefined),
  coverageType: z.string().trim().optional().transform((value) => value || undefined),
  ruleType: z.enum(COVERAGE_RULE_TYPES).or(z.string().trim().min(1)).transform((value) => value.toUpperCase()),
  severity: z.enum(COVERAGE_RULE_SEVERITIES).or(z.string().trim().min(1)).optional().transform((value) => value ? value.toUpperCase() : undefined),
  ruleValue: ruleValueSchema,
  effectiveDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  priority: z.coerce.number().optional(),
  activeFlag: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
});

export const coverageRuleSchema = coverageRuleBaseSchema.superRefine((value, context) => {
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

export const updateCoverageRuleSchema = coverageRuleBaseSchema.partial().superRefine((value, context) => {
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

export const evaluateCoverageRuleSchema = z.object({
  body: z.object({
    payerId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    insurancePolicyId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    state: z.string().trim().optional(),
    cptCode: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional().default([]),
    modifiers: z.array(z.string().trim()).optional().default([]),
    posCode: z.string().trim().optional(),
    placeOfServiceCode: z.string().trim().optional(),
    serviceDate: z.coerce.date().optional(),
    planName: z.string().trim().optional(),
    groupNumber: z.string().trim().optional(),
    network: z.string().trim().optional(),
    coverageType: z.string().trim().optional(),
    eligibilityVerificationId: z.string().trim().optional(),
  }),
});
