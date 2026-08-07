import { z } from 'zod';

const optionalDateSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.date().optional()
);

const addressSchema = z.object({
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
  country: z.string().trim().optional(),
});

const guarantorSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  relationshipToPatient: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  addressLine1: z.string().trim().optional(),
  addressLine2: z.string().trim().optional(),
  city: z.string().trim().optional(),
  state: z.string().trim().optional(),
  zipCode: z.string().trim().optional(),
});

const emergencyContactSchema = z.object({
  firstName: z.string().trim().optional(),
  lastName: z.string().trim().optional(),
  relationship: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
});

const attachmentSchema = z.object({
  documentType: z.string().trim().optional(),
  title: z.string().trim().optional(),
  fileUrl: z.string().trim().optional(),
  description: z.string().trim().optional(),
});

const createPatientBodySchema = z
  .object({
    medicalRecordNumber: z.string().trim().min(1),
    firstName: z.string().trim().min(1),
    middleName: z.string().trim().optional(),
    lastName: z.string().trim().min(1),
    suffix: z.string().trim().optional(),
    dateOfBirth: z.coerce.date(),
    gender: z.string().trim().min(1),
    sex: z.string().trim().optional(),
    maritalStatus: z.string().trim().optional(),
    mobileNumber: z.string().trim().optional(),
    alternatePhoneNumber: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    preferredLanguage: z.string().trim().optional(),
    interpreterRequired: z.boolean().optional(),
    race: z.string().trim().optional(),
    ethnicity: z.string().trim().optional(),
    patientStatus: z.string().trim().optional(),
    ssnLast4: z.string().trim().regex(/^$|^\d{4}$/).optional(),
    employmentStatus: z.string().trim().optional(),
    employerName: z.string().trim().optional(),
    preferredCommunicationMethod: z.string().trim().optional(),
    deceased: z.boolean().optional(),
    dateOfDeath: optionalDateSchema,
    consentToText: z.boolean().optional(),
    consentToCall: z.boolean().optional(),
    consentToEmail: z.boolean().optional(),
    hipaaConsentSigned: z.boolean().optional(),
    financialConsentSigned: z.boolean().optional(),
    address: addressSchema.optional(),
    guarantor: guarantorSchema.optional(),
    emergencyContacts: z.array(emergencyContactSchema).max(5).optional(),
    attachments: z.array(attachmentSchema).max(6).optional(),
    duplicateCheckFlag: z.boolean().optional(),
    mergeRequiredFlag: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .superRefine((value, context) => {
    if (value.deceased && !value.dateOfDeath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date of death is required when the patient is marked deceased.',
        path: ['dateOfDeath'],
      });
    }

    if (!value.deceased && value.dateOfDeath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date of death can only be provided for a deceased patient.',
        path: ['dateOfDeath'],
      });
    }

    if (value.dateOfDeath && value.dateOfDeath < value.dateOfBirth) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date of death cannot be before date of birth.',
        path: ['dateOfDeath'],
      });
    }
  });

const updatePatientBodySchema = z.object({
  medicalRecordNumber: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  middleName: z.string().trim().optional(),
  lastName: z.string().trim().min(1).optional(),
  suffix: z.string().trim().optional(),
  dateOfBirth: optionalDateSchema,
  gender: z.string().trim().min(1).optional(),
  sex: z.string().trim().optional(),
  maritalStatus: z.string().trim().optional(),
  mobileNumber: z.string().trim().optional(),
  alternatePhoneNumber: z.string().trim().optional(),
  email: z.string().trim().email().optional().or(z.literal('')),
  preferredLanguage: z.string().trim().optional(),
  interpreterRequired: z.boolean().optional(),
  race: z.string().trim().optional(),
  ethnicity: z.string().trim().optional(),
  patientStatus: z.string().trim().optional(),
  ssnLast4: z.string().trim().regex(/^$|^\d{4}$/).optional(),
  employmentStatus: z.string().trim().optional(),
  employerName: z.string().trim().optional(),
  preferredCommunicationMethod: z.string().trim().optional(),
  deceased: z.boolean().optional(),
  dateOfDeath: optionalDateSchema,
  consentToText: z.boolean().optional(),
  consentToCall: z.boolean().optional(),
  consentToEmail: z.boolean().optional(),
  hipaaConsentSigned: z.boolean().optional(),
  financialConsentSigned: z.boolean().optional(),
  address: addressSchema.partial().optional(),
  guarantor: guarantorSchema.partial().optional(),
  emergencyContacts: z.array(emergencyContactSchema).max(5).optional(),
  attachments: z.array(attachmentSchema).max(6).optional(),
  duplicateCheckFlag: z.boolean().optional(),
  mergeRequiredFlag: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const createPatientSchema = z.object({
  body: createPatientBodySchema,
});

export const updatePatientSchema = z.object({
  body: updatePatientBodySchema,
  params: z.object({
    id: z.string().min(24),
  }),
});
