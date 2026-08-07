import { z } from 'zod';
import { ENCOUNTER_VISIT_STATUS_OPTIONS } from './encounter.constants';

const vitalsSchema = z.object({
  temperature: z.coerce.number().optional(),
  bloodPressure: z.string().trim().optional(),
  pulse: z.coerce.number().optional(),
  height: z.coerce.number().optional(),
  weight: z.coerce.number().optional(),
  bmi: z.coerce.number().optional(),
});

const checkoutSchema = z.object({
  checkOutTime: z.coerce.date().optional(),
  followUpRequired: z.boolean().optional(),
  balanceDue: z.coerce.number().optional(),
  followUpInstructions: z.string().trim().optional(),
});

const encounterVisitStatusSchema = z.enum(ENCOUNTER_VISIT_STATUS_OPTIONS);

export const createEncounterSchema = z.object({
  body: z.object({
    appointmentId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    renderingProviderId: z.string().trim().optional(),
    supervisingProviderId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    encounterDate: z.coerce.date().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    visitStatus: encounterVisitStatusSchema.optional(),
    chiefComplaint: z.string().trim().optional(),
    historyOfPresentIllness: z.string().trim().optional(),
    clinicalNotes: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    procedureCodes: z.array(z.string().trim()).optional(),
    procedureCodeUnits: z.record(z.string(), z.coerce.number().positive()).optional(),
    vitals: vitalsSchema.partial().optional(),
    checkout: checkoutSchema.partial().optional(),
    active: z.boolean().optional(),
  }),
});

export const updateEncounterSchema = z.object({
  body: z.object({
    appointmentId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    renderingProviderId: z.string().trim().optional(),
    supervisingProviderId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    encounterDate: z.coerce.date().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    visitStatus: encounterVisitStatusSchema.optional(),
    chiefComplaint: z.string().trim().optional(),
    historyOfPresentIllness: z.string().trim().optional(),
    clinicalNotes: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    procedureCodes: z.array(z.string().trim()).optional(),
    procedureCodeUnits: z.record(z.string(), z.coerce.number().positive()).optional(),
    vitals: vitalsSchema.partial().optional(),
    checkout: checkoutSchema.partial().optional(),
    active: z.boolean().optional(),
  }),
  params: z.object({
    id: z.string().min(24),
  }),
});

export const completeEncounterSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
});

export const suggestEncounterAiCodesSchema = z.object({
  params: z.object({
    id: z.string().min(24),
  }),
  body: z.object({
    applySuggestions: z.boolean().optional(),
    replaceExistingCodes: z.boolean().optional(),
    appointmentId: z.string().trim().optional(),
    patientId: z.string().trim().optional(),
    providerId: z.string().trim().optional(),
    renderingProviderId: z.string().trim().optional(),
    supervisingProviderId: z.string().trim().optional(),
    facilityId: z.string().trim().optional(),
    encounterDate: z.coerce.date().optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().optional(),
    visitStatus: encounterVisitStatusSchema.optional(),
    chiefComplaint: z.string().trim().optional(),
    historyOfPresentIllness: z.string().trim().optional(),
    clinicalNotes: z.string().trim().optional(),
    diagnosisCodes: z.array(z.string().trim()).optional(),
    procedureCodes: z.array(z.string().trim()).optional(),
    procedureCodeUnits: z.record(z.string(), z.coerce.number().positive()).optional(),
    vitals: vitalsSchema.partial().optional(),
    checkout: checkoutSchema.partial().optional(),
    active: z.boolean().optional(),
  }),
});
