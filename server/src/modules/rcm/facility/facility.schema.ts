import { z } from 'zod';

export const createFacilitySchema = z.object({
  body: z.object({
    facilityName: z.string().trim().optional(),
    facilityCode: z.string().trim().optional(),
    npi: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    placeOfServiceCode: z.string().trim().optional(),
    addressLine1: z.string().trim().optional(),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    zipCode: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    fax: z.string().trim().optional(),
    activeFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateFacilitySchema = z.object({
  body: z.object({
    facilityName: z.string().trim().optional(),
    facilityCode: z.string().trim().optional(),
    npi: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    placeOfServiceCode: z.string().trim().optional(),
    addressLine1: z.string().trim().optional(),
    addressLine2: z.string().trim().optional(),
    city: z.string().trim().optional(),
    state: z.string().trim().optional(),
    zipCode: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    fax: z.string().trim().optional(),
    activeFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});