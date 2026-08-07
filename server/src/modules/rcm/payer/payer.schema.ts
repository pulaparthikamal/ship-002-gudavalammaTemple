import { z } from 'zod';

export const createPayerSchema = z.object({
  body: z.object({
    payerId: z.string().trim().optional(),
    payerName: z.string().trim().optional(),
    ediPayerId: z.string().trim().optional(),
    payerType: z.string().trim().optional(),
    claimsSubmissionMethod: z.string().trim().optional(),
    eligibilityApiSupported: z.boolean().optional(),
    authPortalUrl: z.string().trim().optional(),
    payerAddressLine1: z.string().trim().optional(),
    payerAddressLine2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    zipCode: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    timelyFilingDays: z.coerce.number().optional(),
    appealTimelyFilingDays: z.coerce.number().optional(),
    activeFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

export const updatePayerSchema = z.object({
  body: z.object({
    payerId: z.string().trim().optional(),
    payerName: z.string().trim().optional(),
    ediPayerId: z.string().trim().optional(),
    payerType: z.string().trim().optional(),
    claimsSubmissionMethod: z.string().trim().optional(),
    eligibilityApiSupported: z.boolean().optional(),
    authPortalUrl: z.string().trim().optional(),
    payerAddressLine1: z.string().trim().optional(),
    payerAddressLine2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    zipCode: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    timelyFilingDays: z.coerce.number().optional(),
    appealTimelyFilingDays: z.coerce.number().optional(),
    activeFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});