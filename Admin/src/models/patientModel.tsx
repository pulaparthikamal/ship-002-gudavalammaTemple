import { z } from 'zod'
import { FilePreviewGrid } from '@/components/rcm/FilePreviewGrid'
import { hasAnyText, phonePattern, stateCodePattern, zipCodePattern } from '@/models/rcmValidation'
import type { AttachmentLink, AttachmentLinkFormValues } from '@/types/common'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type {
  Patient,
  PatientAddress,
  PatientCreatePayload,
  PatientEmergencyContact,
  PatientEmergencyContactFormValues,
  PatientFormValues,
  PatientGuarantor,
} from '@/types/patient'

const genderOptions: CrudSelectOption[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
  { label: 'Unknown', value: 'Unknown' },
]

const sexOptions: CrudSelectOption[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
  { label: 'Unknown', value: 'Unknown' },
]

const maritalStatusOptions: CrudSelectOption[] = [
  { label: 'Single', value: 'Single' },
  { label: 'Married', value: 'Married' },
  { label: 'Divorced', value: 'Divorced' },
  { label: 'Separated', value: 'Separated' },
  { label: 'Widowed', value: 'Widowed' },
  { label: 'Unknown', value: 'Unknown' },
]

const patientStatusOptions: CrudSelectOption[] = [
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
]

const employmentStatusOptions: CrudSelectOption[] = [
  { label: 'Employed', value: 'Employed' },
  { label: 'Self-employed', value: 'Self-employed' },
  { label: 'Unemployed', value: 'Unemployed' },
  { label: 'Retired', value: 'Retired' },
  { label: 'Student', value: 'Student' },
  { label: 'Unknown', value: 'Unknown' },
]

const communicationMethodOptions: CrudSelectOption[] = [
  { label: 'Phone', value: 'Phone' },
  { label: 'Text', value: 'Text' },
  { label: 'Email', value: 'Email' },
  { label: 'Mail', value: 'Mail' },
  { label: 'Patient portal', value: 'Patient portal' },
]

const stateOptions: CrudSelectOption[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
].map((state) => ({ label: state, value: state }))

const raceOptions: CrudSelectOption[] = [
  { label: 'American Indian or Alaska Native', value: 'American Indian or Alaska Native' },
  { label: 'Asian', value: 'Asian' },
  { label: 'Black or African American', value: 'Black or African American' },
  { label: 'Native Hawaiian or Other Pacific Islander', value: 'Native Hawaiian or Other Pacific Islander' },
  { label: 'White', value: 'White' },
  { label: 'Other', value: 'Other' },
  { label: 'Declined to answer', value: 'Declined to answer' },
  { label: 'Unknown', value: 'Unknown' },
]

const ethnicityOptions: CrudSelectOption[] = [
  { label: 'Hispanic or Latino', value: 'Hispanic or Latino' },
  { label: 'Not Hispanic or Latino', value: 'Not Hispanic or Latino' },
  { label: 'Declined to answer', value: 'Declined to answer' },
  { label: 'Unknown', value: 'Unknown' },
]

const relationshipOptions: CrudSelectOption[] = [
  { label: 'Self', value: 'Self' },
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Parent', value: 'Parent' },
  { label: 'Child', value: 'Child' },
  { label: 'Sibling', value: 'Sibling' },
  { label: 'Guardian', value: 'Guardian' },
  { label: 'Partner', value: 'Partner' },
  { label: 'Caregiver', value: 'Caregiver' },
  { label: 'Friend', value: 'Friend' },
  { label: 'Other', value: 'Other' },
]

const patientAttachmentTypeOptions: CrudSelectOption[] = [
  { label: 'Patient photo', value: 'Patient Photo' },
  { label: 'Government ID', value: 'Government ID' },
  { label: 'HIPAA consent', value: 'HIPAA Consent' },
  { label: 'Financial consent', value: 'Financial Consent' },
  { label: 'Registration form', value: 'Registration Form' },
  { label: 'Other', value: 'Other' },
]

export const patientApiDetails = {
  endpoint: '/rcm/patients',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const optionalPhoneField = z
  .string()
  .trim()
  .refine((value) => !value || phonePattern.test(value), 'Enter a valid phone number')

const patientEmergencyContactFormSchema = z
  .object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  relationship: z.string().trim(),
    phone: optionalPhoneField,
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
  })
  .superRefine((value, context) => {
    const hasAnyValue = hasAnyText([value.firstName, value.lastName, value.relationship, value.phone, value.email])

    if (!hasAnyValue) {
      return
    }

    if (!value.firstName.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emergency contact first name is required.',
        path: ['firstName'],
      })
    }

    if (!value.lastName.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Emergency contact last name is required.',
        path: ['lastName'],
      })
    }

    if (!value.relationship.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Relationship is required for an emergency contact.',
        path: ['relationship'],
      })
    }

    if (!value.phone.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Phone is required for an emergency contact.',
        path: ['phone'],
      })
    }
  })

const attachmentLinkFormSchema = z
  .object({
    documentType: z.string().trim(),
    title: z.string().trim(),
    fileUrl: z.string().trim(),
    description: z.string().trim(),
  })
  .superRefine((value, context) => {
    const hasAnyValue = Object.values(value).some((item) => item.trim())

    if (!hasAnyValue) {
      return
    }

    if (!value.documentType.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Document type is required when adding an attachment.',
        path: ['documentType'],
      })
    }

    if (!value.title.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Title is required when adding an attachment.',
        path: ['title'],
      })
    }

    if (!value.fileUrl.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'File URL is required when adding an attachment.',
        path: ['fileUrl'],
      })
    }
  })

export const patientFormSchema = z
  .object({
    _id: z.string().optional(),
    medicalRecordNumber: z.string().trim().min(1, 'Medical record number is required'),
    firstName: z.string().trim().min(1, 'First name is required'),
    middleName: z.string().trim(),
    lastName: z.string().trim().min(1, 'Last name is required'),
    suffix: z.string().trim(),
    dateOfBirth: z
      .date({ message: 'Date of birth is required' })
      .nullable()
      .refine((value) => value !== null, 'Date of birth is required'),
    gender: z.string().trim().min(1, 'Gender is required'),
    sex: z.string().trim(),
    maritalStatus: z.string().trim(),
    mobileNumber: optionalPhoneField,
    alternatePhoneNumber: optionalPhoneField,
    email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
    preferredLanguage: z.string().trim(),
    interpreterRequired: z.boolean(),
    race: z.string().trim(),
    ethnicity: z.string().trim(),
    patientStatus: z.string().trim().min(1, 'Patient status is required'),
    ssnLast4: z
      .string()
      .trim()
      .regex(/^$|^\d{4}$/, 'Enter the last 4 digits of SSN'),
    employmentStatus: z.string().trim(),
    employerName: z.string().trim(),
    preferredCommunicationMethod: z.string().trim(),
    deceased: z.boolean(),
    dateOfDeath: z.date().nullable(),
    consentToText: z.boolean(),
    consentToCall: z.boolean(),
    consentToEmail: z.boolean(),
    hipaaConsentSigned: z.boolean(),
    financialConsentSigned: z.boolean(),
    address: z.object({
      addressLine1: z.string().trim().min(1, 'Address line 1 is required'),
      addressLine2: z.string().trim(),
      city: z.string().trim().min(1, 'City is required'),
      state: z
        .string()
        .trim()
        .min(1, 'State is required')
        .regex(stateCodePattern, 'Use the 2-letter state code'),
      zipCode: z
        .string()
        .trim()
        .min(1, 'ZIP code is required')
        .regex(zipCodePattern, 'Enter a valid ZIP code'),
      country: z.string().trim().min(1, 'Country is required'),
    }),
    guarantor: z.object({
      firstName: z.string().trim(),
      lastName: z.string().trim(),
      relationshipToPatient: z.string().trim(),
      phone: optionalPhoneField,
      email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
      addressLine1: z.string().trim(),
      addressLine2: z.string().trim(),
      city: z.string().trim(),
      state: z.string().trim(),
      zipCode: z.string().trim(),
    }),
    emergencyContacts: z.array(patientEmergencyContactFormSchema).max(5),
    attachments: z.array(attachmentLinkFormSchema).max(6),
    duplicateCheckFlag: z.boolean(),
    mergeRequiredFlag: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.deceased && !value.dateOfDeath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date of death is required when the patient is marked deceased.',
        path: ['dateOfDeath'],
      })
    }

    if (!value.deceased && value.dateOfDeath) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Clear the date of death or mark the patient as deceased.',
        path: ['dateOfDeath'],
      })
    }

    if (value.dateOfBirth && value.dateOfDeath && value.dateOfDeath < value.dateOfBirth) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Date of death cannot be earlier than date of birth.',
        path: ['dateOfDeath'],
      })
    }

    if (!value.mobileNumber.trim() && !value.email.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one primary contact method is required.',
        path: ['mobileNumber'],
      })
    }

    if (value.interpreterRequired && !value.preferredLanguage.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Preferred language is required when an interpreter is needed.',
        path: ['preferredLanguage'],
      })
    }

    if (value.consentToText && !value.mobileNumber.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A mobile number is required when text consent is enabled.',
        path: ['mobileNumber'],
      })
    }

    if (value.consentToCall && !value.mobileNumber.trim() && !value.alternatePhoneNumber.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A phone number is required when call consent is enabled.',
        path: ['mobileNumber'],
      })
    }

    if (value.consentToEmail && !value.email.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'An email address is required when email consent is enabled.',
        path: ['email'],
      })
    }

    if (value.preferredCommunicationMethod === 'Text' && !value.consentToText) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enable text consent before selecting text as the preferred communication method.',
        path: ['preferredCommunicationMethod'],
      })
    }

    if (value.preferredCommunicationMethod === 'Phone' && !value.consentToCall) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enable call consent before selecting phone as the preferred communication method.',
        path: ['preferredCommunicationMethod'],
      })
    }

    if (value.preferredCommunicationMethod === 'Email' && !value.consentToEmail) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enable email consent before selecting email as the preferred communication method.',
        path: ['preferredCommunicationMethod'],
      })
    }

    const guarantor = value.guarantor
    const hasAnyGuarantorValue = hasAnyText([
      guarantor.firstName,
      guarantor.lastName,
      guarantor.relationshipToPatient,
      guarantor.phone,
      guarantor.email,
      guarantor.addressLine1,
      guarantor.addressLine2,
      guarantor.city,
      guarantor.state,
      guarantor.zipCode,
    ])

    if (hasAnyGuarantorValue) {
      if (!guarantor.firstName.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor first name is required.',
          path: ['guarantor', 'firstName'],
        })
      }

      if (!guarantor.lastName.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor last name is required.',
          path: ['guarantor', 'lastName'],
        })
      }

      if (!guarantor.relationshipToPatient.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Relationship to patient is required for a guarantor.',
          path: ['guarantor', 'relationshipToPatient'],
        })
      }

      if (!guarantor.phone.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor phone is required.',
          path: ['guarantor', 'phone'],
        })
      }

      if (!guarantor.addressLine1.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor address line 1 is required.',
          path: ['guarantor', 'addressLine1'],
        })
      }

      if (!guarantor.city.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor city is required.',
          path: ['guarantor', 'city'],
        })
      }

      if (!guarantor.state.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor state is required.',
          path: ['guarantor', 'state'],
        })
      } else if (!stateCodePattern.test(guarantor.state.trim())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Use the 2-letter state code for the guarantor.',
          path: ['guarantor', 'state'],
        })
      }

      if (!guarantor.zipCode.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Guarantor ZIP code is required.',
          path: ['guarantor', 'zipCode'],
        })
      } else if (!zipCodePattern.test(guarantor.zipCode.trim())) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Enter a valid guarantor ZIP code.',
          path: ['guarantor', 'zipCode'],
        })
      }
    }

    if (value.mergeRequiredFlag && !value.duplicateCheckFlag) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Duplicate check must be flagged before merge can be required.',
        path: ['mergeRequiredFlag'],
      })
    }
  }) as z.ZodType<PatientFormValues>

export const patientDefaultValues: PatientFormValues = {
  _id: '',
  medicalRecordNumber: '',
  firstName: '',
  middleName: '',
  lastName: '',
  suffix: '',
  dateOfBirth: null,
  gender: '',
  sex: '',
  maritalStatus: 'Single',
  mobileNumber: '',
  alternatePhoneNumber: '',
  email: '',
  preferredLanguage: '',
  interpreterRequired: false,
  race: '',
  ethnicity: '',
  patientStatus: 'Active',
  ssnLast4: '',
  employmentStatus: '',
  employerName: '',
  preferredCommunicationMethod: '',
  deceased: false,
  dateOfDeath: null,
  consentToText: false,
  consentToCall: false,
  consentToEmail: false,
  hipaaConsentSigned: false,
  financialConsentSigned: false,
  address: {
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'US',
  },
  guarantor: {
    firstName: '',
    lastName: '',
    relationshipToPatient: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
  },
  emergencyContacts: [],
  attachments: [],
  duplicateCheckFlag: false,
  mergeRequiredFlag: false,
  active: true,
}

export const patientFormConfig: CrudFormConfig<PatientFormValues> = {
  schema: patientFormSchema,
  defaultValues: patientDefaultValues,
  columns: 3,
  fields: [
    {
      name: '_id',
      label: 'ID',
      type: 'hidden',
    },
    {
      name: 'medicalRecordNumber',
      label: 'MRN',
      section: 'Patient',
      type: 'text',
      placeholder: 'Enter medical record number',
    },
    {
      name: 'patientStatus',
      label: 'Patient status',
      section: 'Patient',
      type: 'select',
      placeholder: 'Choose status',
      options: patientStatusOptions,
    },
    {
      name: 'firstName',
      label: 'First name',
      section: 'Patient',
      type: 'text',
      placeholder: 'First name',
    },
    {
      name: 'middleName',
      label: 'Middle name',
      section: 'Patient',
      type: 'text',
      placeholder: 'Middle name',
    },
    {
      name: 'lastName',
      label: 'Last name',
      section: 'Patient',
      type: 'text',
      placeholder: 'Last name',
    },
    {
      name: 'suffix',
      label: 'Suffix',
      section: 'Patient',
      type: 'text',
      placeholder: 'Jr, Sr, III',
    },
    {
      name: 'dateOfBirth',
      label: 'Date of birth',
      section: 'Patient',
      type: 'date',
      placeholder: 'Choose date of birth',
      date: {
        maxDate: new Date(),
        showButtonBar: true,
      },
    },
    {
      name: 'gender',
      label: 'Administrative gender (payer)',
      section: 'Patient',
      type: 'select',
      placeholder: 'Choose gender',
      options: genderOptions,
      helperText: 'Used for payer matching, eligibility, and registration records.',
    },
    {
      name: 'sex',
      label: 'Sex assigned at birth',
      section: 'Patient',
      type: 'select',
      placeholder: 'Choose sex assigned at birth',
      options: sexOptions,
      helperText: 'Capture only when clinical documentation or the payer requires it.',
    },
    {
      name: 'maritalStatus',
      label: 'Marital status',
      section: 'Patient',
      type: 'select',
      placeholder: 'Choose marital status',
      options: maritalStatusOptions,
    },
    {
      name: 'interpreterRequired',
      label: 'Interpreter needed',
      section: 'Communication',
      type: 'switch',
      helperText: 'Use this when the patient needs spoken-language or ASL support during care or registration.',
      switch: {
        checkedLabel: 'Required',
        uncheckedLabel: 'Not required',
      },
    },
    {
      name: 'preferredLanguage',
      label: 'Preferred language',
      section: 'Communication',
      type: 'text',
      placeholder: 'English, Spanish, Telugu, etc.',
      helperText: 'Required when interpreter support is needed.',
    },
    {
      name: 'mobileNumber',
      label: 'Mobile number',
      section: 'Communication',
      type: 'text',
      placeholder: 'Primary phone',
    },
    {
      name: 'alternatePhoneNumber',
      label: 'Alternate phone',
      section: 'Communication',
      type: 'text',
      placeholder: 'Secondary phone',
    },
    {
      name: 'email',
      label: 'Email',
      section: 'Communication',
      type: 'email',
      placeholder: 'patient@example.com',
    },
    {
      name: 'consentToText',
      label: 'Consent to text',
      section: 'Communication',
      type: 'switch',
    },
    {
      name: 'consentToCall',
      label: 'Consent to call',
      section: 'Communication',
      type: 'switch',
    },
    {
      name: 'consentToEmail',
      label: 'Consent to email',
      section: 'Communication',
      type: 'switch',
    },
    {
      name: 'hipaaConsentSigned',
      label: 'HIPAA consent signed',
      section: 'Communication',
      type: 'switch',
    },
    {
      name: 'financialConsentSigned',
      label: 'Financial consent signed',
      section: 'Communication',
      type: 'switch',
    },
    {
      name: 'preferredCommunicationMethod',
      label: 'Preferred communication method',
      section: 'Communication',
      type: 'select',
      placeholder: 'Choose communication method',
      options: communicationMethodOptions,
      helperText: 'Only choose a method the patient has consented to receive.',
    },
    {
      name: 'deceased',
      label: 'Deceased',
      section: 'Patient',
      type: 'switch',
      hideOnAddForm: true,
      switch: {
        checkedLabel: 'Yes',
        uncheckedLabel: 'No',
      },
    },
    {
      name: 'dateOfDeath',
      label: 'Date of death',
      section: 'Patient',
      type: 'date',
      placeholder: 'Choose date of death',
      hideOnAddForm: true,
      date: {
        maxDate: new Date(),
        showButtonBar: true,
      },
    },
    {
      name: 'address.addressLine1',
      label: 'Address line 1',
      section: 'Address',
      type: 'text',
      placeholder: 'Address line 1',
    },
    {
      name: 'address.addressLine2',
      label: 'Address line 2',
      section: 'Address',
      type: 'text',
      placeholder: 'Address line 2',
    },
    {
      name: 'address.city',
      label: 'City',
      section: 'Address',
      type: 'text',
      placeholder: 'City',
    },
    {
      name: 'address.state',
      label: 'State',
      section: 'Address',
      type: 'select',
      placeholder: 'Choose state',
      options: stateOptions,
    },
    {
      name: 'address.zipCode',
      label: 'ZIP code',
      section: 'Address',
      type: 'text',
      placeholder: 'ZIP code',
    },
    {
      name: 'address.country',
      label: 'Country',
      section: 'Address',
      type: 'text',
      placeholder: 'US',
    },
    {
      name: 'race',
      label: 'Race',
      section: 'Demographics',
      type: 'select',
      placeholder: 'Select race',
      options: raceOptions,
    },
    {
      name: 'ethnicity',
      label: 'Ethnicity',
      section: 'Demographics',
      type: 'select',
      placeholder: 'Select ethnicity',
      options: ethnicityOptions,
    },
    {
      name: 'ssnLast4',
      label: 'SSN last 4',
      section: 'Demographics',
      type: 'text',
      placeholder: 'Last 4 digits',
    },
    {
      name: 'employmentStatus',
      label: 'Employment status',
      section: 'Demographics',
      type: 'select',
      placeholder: 'Choose employment status',
      options: employmentStatusOptions,
    },
    {
      name: 'employerName',
      label: 'Employer name',
      section: 'Demographics',
      type: 'text',
      placeholder: 'Employer name',
    },
    {
      name: 'duplicateCheckFlag',
      label: 'Duplicate check flag',
      type: 'hidden',
    },
    {
      name: 'mergeRequiredFlag',
      label: 'Merge required flag',
      type: 'hidden',
    },
    {
      name: 'guarantor.firstName',
      label: 'Guarantor first name',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor first name',
    },
    {
      name: 'guarantor.lastName',
      label: 'Guarantor last name',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor last name',
    },
    {
      name: 'guarantor.relationshipToPatient',
      label: 'Guarantor relationship',
      section: 'Guarantor',
      type: 'select',
      placeholder: 'Choose relationship',
      options: relationshipOptions,
    },
    {
      name: 'guarantor.phone',
      label: 'Guarantor phone',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor phone',
    },
    {
      name: 'guarantor.email',
      label: 'Guarantor email',
      section: 'Guarantor',
      type: 'email',
      placeholder: 'guarantor@example.com',
    },
    {
      name: 'guarantor.addressLine1',
      label: 'Guarantor address line 1',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor address line 1',
    },
    {
      name: 'guarantor.addressLine2',
      label: 'Guarantor address line 2',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor address line 2',
    },
    {
      name: 'guarantor.city',
      label: 'Guarantor city',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor city',
    },
    {
      name: 'guarantor.state',
      label: 'Guarantor state',
      section: 'Guarantor',
      type: 'select',
      placeholder: 'Choose state',
      options: stateOptions,
    },
    {
      name: 'guarantor.zipCode',
      label: 'Guarantor ZIP code',
      section: 'Guarantor',
      type: 'text',
      placeholder: 'Guarantor ZIP code',
    },
    {
      name: 'emergencyContacts',
      label: 'Emergency contacts',
      section: 'Emergency Contacts',
      type: 'emergencyContacts',
      fullWidth: true,
      helperText: 'Add only the contacts that should be reached for patient care or registration issues.',
      emergencyContacts: {
        maxItems: 5,
        relationshipOptions,
      },
    },
    {
      name: 'attachments',
      label: 'Patient documents',
      section: 'Documents',
      type: 'attachments',
      fullWidth: true,
      helperText: 'Upload patient ID, consent forms, registration paperwork, and other supporting documents.',
      attachments: {
        maxItems: 6,
        accept: '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/*',
        documentTypeOptions: patientAttachmentTypeOptions,
        uploadFolder: 'patient-documents',
        documentMetadata: (values) => {
          const patientId = values._id?.trim()

          if (!patientId) {
            return undefined
          }

          return {
            patientId,
            entityType: 'patient',
            entityId: patientId,
            documentCategory: 'Patient Document',
            documentType: 'Patient Document',
            uploadSource: 'Patients',
            active: true,
          }
        },
      },
    },
    {
      name: 'active',
      label: 'Active record',
      type: 'hidden',
    }
  ],
}

function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

function toFormDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

function formatPatientDate(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

function getPatientFullName(patient: Pick<Patient, 'firstName' | 'middleName' | 'lastName' | 'suffix'>) {
  return [patient.firstName, patient.middleName, patient.lastName, patient.suffix].filter(Boolean).join(' ')
}

function formatAddress(address: PatientAddress) {
  return [
    address.addressLine1,
    address.addressLine2,
    address.city,
    address.state,
    address.zipCode,
    address.country,
  ]
    .filter(Boolean)
    .join(', ')
}

function formatGuarantorAddress(guarantor: PatientGuarantor) {
  return [
    guarantor.addressLine1,
    guarantor.addressLine2,
    guarantor.city,
    guarantor.state,
    guarantor.zipCode,
  ]
    .filter(Boolean)
    .join(', ')
}

function formatBoolean(value?: boolean) {
  return value ? 'Yes' : 'No'
}

function buildEmergencyContacts(
  emergencyContacts: PatientEmergencyContact[] = [],
): PatientEmergencyContactFormValues[] {
  return emergencyContacts.map((contact) => ({
    firstName: contact.firstName ?? '',
    lastName: contact.lastName ?? '',
    relationship: contact.relationship ?? '',
    phone: contact.phone ?? '',
    email: contact.email ?? '',
  }))
}

function buildAttachments(attachments: AttachmentLink[] = []): AttachmentLinkFormValues[] {
  return attachments.map((attachment) => ({
    documentType: attachment.documentType ?? '',
    title: attachment.title ?? '',
    fileUrl: attachment.fileUrl ?? '',
    description: attachment.description ?? '',
  }))
}

function isEmergencyContactEmpty(contact: PatientEmergencyContactFormValues) {
  return (
    !contact.firstName.trim() &&
    !contact.lastName.trim() &&
    !contact.relationship.trim() &&
    !contact.phone.trim() &&
    !contact.email.trim()
  )
}

function isAttachmentEmpty(attachment: AttachmentLinkFormValues) {
  return (
    !attachment.documentType.trim() &&
    !attachment.title.trim() &&
    !attachment.fileUrl.trim() &&
    !attachment.description.trim()
  )
}

function compactAddress(address: PatientFormValues['address']): PatientAddress | undefined {
  const nextAddress = {
    addressLine1: optionalText(address.addressLine1),
    addressLine2: optionalText(address.addressLine2),
    city: optionalText(address.city),
    state: optionalText(address.state),
    zipCode: optionalText(address.zipCode),
    country: optionalText(address.country),
  }

  return Object.values(nextAddress).some(Boolean) ? nextAddress : undefined
}

function compactGuarantor(guarantor: PatientFormValues['guarantor']): PatientGuarantor | undefined {
  const nextGuarantor = {
    firstName: optionalText(guarantor.firstName),
    lastName: optionalText(guarantor.lastName),
    relationshipToPatient: optionalText(guarantor.relationshipToPatient),
    phone: optionalText(guarantor.phone),
    email: optionalText(guarantor.email),
    addressLine1: optionalText(guarantor.addressLine1),
    addressLine2: optionalText(guarantor.addressLine2),
    city: optionalText(guarantor.city),
    state: optionalText(guarantor.state),
    zipCode: optionalText(guarantor.zipCode),
  }

  return Object.values(nextGuarantor).some(Boolean) ? nextGuarantor : undefined
}

function compactEmergencyContacts(
  emergencyContacts: PatientFormValues['emergencyContacts'],
): PatientEmergencyContact[] | undefined {
  const nextContacts = emergencyContacts
    .filter((contact) => !isEmergencyContactEmpty(contact))
    .map((contact) => ({
      firstName: optionalText(contact.firstName),
      lastName: optionalText(contact.lastName),
      relationship: optionalText(contact.relationship),
      phone: optionalText(contact.phone),
      email: optionalText(contact.email),
    }))

  return nextContacts.length ? nextContacts : undefined
}

function compactAttachments(attachments: PatientFormValues['attachments']): AttachmentLink[] | undefined {
  const nextAttachments = attachments
    .filter((attachment) => !isAttachmentEmpty(attachment))
    .map((attachment) => ({
      documentType: optionalText(attachment.documentType),
      title: optionalText(attachment.title),
      fileUrl: optionalText(attachment.fileUrl),
      description: optionalText(attachment.description),
    }))

  return nextAttachments.length ? nextAttachments : undefined
}

export const patientTableColumns: Array<CrudTableColumn<Patient>> = [
  {
    key: 'medicalRecordNumber',
    header: 'MRN',
    field: 'medicalRecordNumber',
    sortField: 'medicalRecordNumber',
    filter: {
      key: 'medicalRecordNumber',
      type: 'regexOr',
      placeholder: 'Search MRN',
      matchModes: ['contains', 'notContains', 'startsWith', 'endsWith', 'equals', 'notEquals'],
    },
  },
  {
    key: 'patient',
    header: 'Patient',
    sortField: 'firstName',
    exportValue: (patient) => getPatientFullName(patient),
    render: (patient) => (
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">
          {getPatientFullName(patient)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          {patient.gender} • DOB {formatPatientDate(patient.dateOfBirth)}
        </p>
      </div>
    ),
  },
  {
    key: 'contact',
    header: 'Contact',
    sortable: false,
    exportValue: (patient) => patient.mobileNumber ?? patient.email ?? '',
    render: (patient) => (
      <div>
        <p className="text-sm font-medium text-[var(--color-text-strong)]">
          {patient.mobileNumber || '-'}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">{patient.email || '-'}</p>
      </div>
    ),
  },
  {
    key: 'patientStatus',
    header: 'Status',
    field: 'patientStatus',
    sortField: 'patientStatus',
    filter: {
      key: 'patientStatus',
      type: 'in',
      input: 'multiSelect',
      placeholder: 'Patient status',
      options: patientStatusOptions,
      matchModes: ['in', 'notIn'],
    },
    render: (patient) => (
      <span
        className={
          patient.patientStatus === 'Active'
            ? 'inline-flex rounded-lg bg-[var(--color-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-primary)]'
            : 'inline-flex rounded-lg bg-[var(--color-surface-muted)] px-2 py-0.5 text-[11px] font-semibold text-[var(--color-text-muted)]'
        }
      >
        {patient.patientStatus}
      </span>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    sortable: false,
    exportValue: (patient) => `${patient.address.city ?? ''} ${patient.address.state ?? ''}`.trim(),
    render: (patient) =>
      patient.address.city || patient.address.state
        ? `${patient.address.city ?? ''}${patient.address.city && patient.address.state ? ', ' : ''}${patient.address.state ?? ''}`
        : '-',
  },
  {
    key: 'updatedAt',
    header: 'Updated',
    sortField: 'updated',
    field: 'updatedAt',
    exportValue: (patient) => formatPatientDate(patient.updatedAt),
    filter: {
      key: 'updated',
      input: 'date',
      placeholder: 'Updated date',
    },
    render: (patient) => formatPatientDate(patient.updatedAt),
  },
]

export function mapPatientToFormValues(patient: Patient): PatientFormValues {
  return {
    _id: patient._id,
    medicalRecordNumber: patient.medicalRecordNumber,
    firstName: patient.firstName,
    middleName: patient.middleName ?? '',
    lastName: patient.lastName,
    suffix: patient.suffix ?? '',
    dateOfBirth: toFormDate(patient.dateOfBirth),
    gender: patient.gender,
    sex: patient.sex ?? '',
    maritalStatus: patient.maritalStatus ?? 'Single',
    mobileNumber: patient.mobileNumber ?? '',
    alternatePhoneNumber: patient.alternatePhoneNumber ?? '',
    email: patient.email ?? '',
    preferredLanguage: patient.preferredLanguage ?? '',
    interpreterRequired: patient.interpreterRequired,
    race: patient.race ?? '',
    ethnicity: patient.ethnicity ?? '',
    patientStatus: patient.patientStatus,
    ssnLast4: patient.ssnLast4 ?? '',
    employmentStatus: patient.employmentStatus ?? '',
    employerName: patient.employerName ?? '',
    preferredCommunicationMethod: patient.preferredCommunicationMethod ?? '',
    deceased: patient.deceased,
    dateOfDeath: toFormDate(patient.dateOfDeath),
    consentToText: patient.consentToText,
    consentToCall: patient.consentToCall,
    consentToEmail: patient.consentToEmail,
    hipaaConsentSigned: patient.hipaaConsentSigned,
    financialConsentSigned: patient.financialConsentSigned,
    address: {
      addressLine1: patient.address.addressLine1 ?? '',
      addressLine2: patient.address.addressLine2 ?? '',
      city: patient.address.city ?? '',
      state: patient.address.state ?? '',
      zipCode: patient.address.zipCode ?? '',
      country: patient.address.country ?? '',
    },
    guarantor: {
      firstName: patient.guarantor.firstName ?? '',
      lastName: patient.guarantor.lastName ?? '',
      relationshipToPatient: patient.guarantor.relationshipToPatient ?? '',
      phone: patient.guarantor.phone ?? '',
      email: patient.guarantor.email ?? '',
      addressLine1: patient.guarantor.addressLine1 ?? '',
      addressLine2: patient.guarantor.addressLine2 ?? '',
      city: patient.guarantor.city ?? '',
      state: patient.guarantor.state ?? '',
      zipCode: patient.guarantor.zipCode ?? '',
    },
    emergencyContacts: buildEmergencyContacts(patient.emergencyContacts),
    attachments: buildAttachments(patient.attachments),
    duplicateCheckFlag: patient.duplicateCheckFlag,
    mergeRequiredFlag: patient.mergeRequiredFlag,
    active: patient.active,
  }
}

export function mapPatientFormToPayload(values: PatientFormValues): PatientCreatePayload {
  if (!values.dateOfBirth) {
    throw new Error('Date of birth is required.')
  }

  return {
    medicalRecordNumber: values.medicalRecordNumber.trim(),
    firstName: values.firstName.trim(),
    middleName: optionalText(values.middleName),
    lastName: values.lastName.trim(),
    suffix: optionalText(values.suffix),
    dateOfBirth: values.dateOfBirth,
    gender: values.gender.trim(),
    sex: optionalText(values.sex),
    maritalStatus: optionalText(values.maritalStatus),
    mobileNumber: optionalText(values.mobileNumber),
    alternatePhoneNumber: optionalText(values.alternatePhoneNumber),
    email: optionalText(values.email),
    preferredLanguage: optionalText(values.preferredLanguage),
    interpreterRequired: values.interpreterRequired,
    race: optionalText(values.race),
    ethnicity: optionalText(values.ethnicity),
    patientStatus: values.patientStatus.trim(),
    ssnLast4: optionalText(values.ssnLast4),
    employmentStatus: optionalText(values.employmentStatus),
    employerName: optionalText(values.employerName),
    preferredCommunicationMethod: optionalText(values.preferredCommunicationMethod),
    deceased: values.deceased,
    dateOfDeath: values.dateOfDeath ?? undefined,
    consentToText: values.consentToText,
    consentToCall: values.consentToCall,
    consentToEmail: values.consentToEmail,
    hipaaConsentSigned: values.hipaaConsentSigned,
    financialConsentSigned: values.financialConsentSigned,
    address: compactAddress(values.address),
    guarantor: compactGuarantor(values.guarantor),
    emergencyContacts: compactEmergencyContacts(values.emergencyContacts),
    attachments: compactAttachments(values.attachments),
    duplicateCheckFlag: values.duplicateCheckFlag,
    mergeRequiredFlag: values.mergeRequiredFlag,
    active: values.active,
  }
}

function renderSection(items: Array<[string, string]>) {
  return (
    <dl className="overflow-hidden rounded-lg border border-[var(--color-border)]">
      {items.map(([label, value]) => (
        <div
          key={label}
          className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center"
        >
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            {label}
          </dt>
          <dd className="whitespace-pre-line break-words text-sm font-semibold text-[var(--color-text-strong)] sm:text-right">
            {value || '-'}
          </dd>
        </div>
      ))}
    </dl>
  )
}

export function renderPatientDetails(patient: Patient) {
  const emergencyContactLines =
    patient.emergencyContacts
      .map((contact, index) => {
        const contactName = [contact.firstName, contact.lastName].filter(Boolean).join(' ')
        const details = [contactName, contact.relationship, contact.phone, contact.email]
          .filter(Boolean)
          .join(' • ')

        return details ? `${index + 1}. ${details}` : null
      })
      .filter((value): value is string => Boolean(value))
      .join('\n') || '-'

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Patient</h3>
        {renderSection([
          ['MRN', patient.medicalRecordNumber],
          ['Name', getPatientFullName(patient)],
          ['Patient ID', patient.patientId],
          ['DOB', formatPatientDate(patient.dateOfBirth)],
          ['Administrative gender', patient.gender],
          ['Sex', patient.sex ?? '-'],
          ['Marital status', patient.maritalStatus ?? '-'],
          ['Status', patient.patientStatus],
          ['Mobile', patient.mobileNumber ?? '-'],
          ['Alternate phone', patient.alternatePhoneNumber ?? '-'],
          ['Email', patient.email ?? '-'],
          ['Preferred communication', patient.preferredCommunicationMethod ?? '-'],
          ['Interpreter required', formatBoolean(patient.interpreterRequired)],
          ['Deceased', formatBoolean(patient.deceased)],
          ['Date of death', formatPatientDate(patient.dateOfDeath)],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Address</h3>
        {renderSection([
          ['Address', formatAddress(patient.address) || '-'],
          ['Preferred language', patient.preferredLanguage ?? '-'],
          ['Race', patient.race ?? '-'],
          ['Ethnicity', patient.ethnicity ?? '-'],
          ['SSN last 4', patient.ssnLast4 ?? '-'],
          ['Employment status', patient.employmentStatus ?? '-'],
          ['Employer', patient.employerName ?? '-'],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Consents</h3>
        {renderSection([
          ['Consent to text', formatBoolean(patient.consentToText)],
          ['Consent to call', formatBoolean(patient.consentToCall)],
          ['Consent to email', formatBoolean(patient.consentToEmail)],
          ['HIPAA consent signed', formatBoolean(patient.hipaaConsentSigned)],
          ['Financial consent signed', formatBoolean(patient.financialConsentSigned)],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Guarantor</h3>
        {renderSection([
          [
            'Guarantor',
            [patient.guarantor.firstName, patient.guarantor.lastName].filter(Boolean).join(' ') || '-',
          ],
          ['Relationship', patient.guarantor.relationshipToPatient ?? '-'],
          ['Phone', patient.guarantor.phone ?? '-'],
          ['Email', patient.guarantor.email ?? '-'],
          ['Address', formatGuarantorAddress(patient.guarantor) || '-'],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Emergency Contacts</h3>
        {renderSection([['Contacts', emergencyContactLines]])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Documents</h3>
        <FilePreviewGrid
          items={patient.attachments.map((attachment, index) => ({
            title: attachment.title ?? `Document ${index + 1}`,
            subtitle: attachment.documentType,
            description: attachment.description,
            fileUrl: attachment.fileUrl,
          }))}
          emptyMessage="No patient documents uploaded."
        />
      </section>
    </div>
  )
}

export function renderPatientGridItem(patient: Patient) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">
          {getPatientFullName(patient)}
        </p>
        <p className="text-[11px] text-[var(--color-text-muted)]">
          MRN {patient.medicalRecordNumber}
        </p>
      </div>

      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            Status
          </dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">
            {patient.patientStatus}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            Contact
          </dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">
            {patient.mobileNumber || patient.email || '-'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            Location
          </dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">
            {patient.address.city || patient.address.state
              ? `${patient.address.city ?? ''}${patient.address.city && patient.address.state ? ', ' : ''}${patient.address.state ?? ''}`
              : '-'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
