import { z } from 'zod';

export const createReferralSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    appointmentId: z.string().trim().optional(),
    insuranceId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    referringProviderId: z.string().trim().optional(),
    referredToProviderId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    referralNumber: z.string().trim().optional(),
    referralType: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    procedureCodes: z.array(z.string().trim()).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    referralStatus: z.string().trim().optional(),
    approvedVisits: z.coerce.number().optional(),
    usedVisits: z.coerce.number().optional(),
    remainingVisits: z.coerce.number().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateReferralSchema = z.object({
  body: z.object({
    patientId: z.string().trim().optional(),
    appointmentId: z.string().trim().optional(),
    insuranceId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    referringProviderId: z.string().trim().optional(),
    referredToProviderId: z.string().trim().optional(),
    payerId: z.string().trim().optional(),
    referralNumber: z.string().trim().optional(),
    referralType: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    procedureCodes: z.array(z.string().trim()).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    referralStatus: z.string().trim().optional(),
    approvedVisits: z.coerce.number().optional(),
    usedVisits: z.coerce.number().optional(),
    remainingVisits: z.coerce.number().optional(),
    notes: z.string().trim().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});
