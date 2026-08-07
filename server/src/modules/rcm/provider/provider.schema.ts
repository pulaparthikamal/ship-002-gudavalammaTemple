import { z } from 'zod';

export const createProviderSchema = z.object({
  body: z.object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    credentials: z.string().trim().optional(),
    specialty: z.string().trim().optional(),
    npi: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    taxonomyCode: z.string().trim().optional(),
    licenseNumber: z.string().trim().optional(),
    deaNumber: z.string().trim().optional(),
    providerType: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    fax: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    activeFlag: z.boolean().optional(),
    billingProviderFlag: z.boolean().optional(),
    renderingProviderFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateProviderSchema = z.object({
  body: z.object({
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    credentials: z.string().trim().optional(),
    specialty: z.string().trim().optional(),
    npi: z.string().trim().optional(),
    taxId: z.string().trim().optional(),
    taxonomyCode: z.string().trim().optional(),
    licenseNumber: z.string().trim().optional(),
    deaNumber: z.string().trim().optional(),
    providerType: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    fax: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    activeFlag: z.boolean().optional(),
    billingProviderFlag: z.boolean().optional(),
    renderingProviderFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
