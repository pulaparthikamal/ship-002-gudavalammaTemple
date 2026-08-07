import { z } from 'zod';
import { CHARGE_CODING_REVIEW_STATUS_OPTIONS, CHARGE_STATUS_OPTIONS } from './charge.constants';

const chargeLinesSchema = z.object({
  lineNumber: z.coerce.number().optional(),
  cptCode: z.string().trim().optional(),
  icdCodes: z.array(z.string().trim()).optional(),
  icdPointers: z.array(z.coerce.number()).optional(),
  modifiers: z.array(z.string().trim()).optional(),
  units: z.coerce.number().optional(),
  chargeAmount: z.coerce.number().optional(),
  diagnosisLinking: z.string().trim().optional(),
  renderingProviderId: z.string().trim().optional(),
  expectedAllowedAmount: z.coerce.number().optional(),
  feeScheduleId: z.string().trim().optional(),
  pricingStatus: z.string().trim().optional(),
  pricingMessage: z.string().trim().optional(),
});

const chargeStatusSchema = z.enum(CHARGE_STATUS_OPTIONS);
const codingReviewStatusSchema = z.enum(CHARGE_CODING_REVIEW_STATUS_OPTIONS);

export const createChargeSchema = z.object({
  body: z.object({
    encounterId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    serviceDate: z.coerce.date().optional(),
    placeOfService: z.string().trim().optional(),
    totalChargeAmount: z.coerce.number().optional(),
    chargeStatus: chargeStatusSchema.optional(),
    codingReviewStatus: codingReviewStatusSchema.optional(),
    documentationComplete: z.boolean().optional(),
    validationErrors: z.array(z.string().trim()).optional(),
    createdBy: z.string().trim().optional(),
    reviewedBy: z.string().trim().optional(),
    chargeLines: z.array(chargeLinesSchema).optional(),
    active: z.boolean().optional(),
  }),
});

export const updateChargeSchema = z.object({
  body: z.object({
    encounterId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    serviceDate: z.coerce.date().optional(),
    placeOfService: z.string().trim().optional(),
    totalChargeAmount: z.coerce.number().optional(),
    chargeStatus: chargeStatusSchema.optional(),
    codingReviewStatus: codingReviewStatusSchema.optional(),
    documentationComplete: z.boolean().optional(),
    validationErrors: z.array(z.string().trim()).optional(),
    createdBy: z.string().trim().optional(),
    reviewedBy: z.string().trim().optional(),
    chargeLines: z.array(chargeLinesSchema).optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const createChargeFromEncounterSchema = z.object({
  params: z.object({
    encounterId: z.string().min(24),
  }),
});

export const submitChargeForReviewSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});
