import { z } from 'zod'
import { FilePreviewGrid } from '@/components/rcm/FilePreviewGrid'
import { hasAnyText, phonePattern, stateCodePattern, zipCodePattern } from '@/models/rcmValidation'
import type { AttachmentLink, AttachmentLinkFormValues } from '@/types/common'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type {
  InsurancePolicy,
  InsurancePolicyCard,
  InsurancePolicyCardFormValues,
  InsurancePolicyCreatePayload,
  InsurancePolicyFormValues,
  InsurancePolicySubscriber,
  InsurancePolicySubscriberFormValues,
  InsurancePolicyVerification,
  InsurancePolicyVerificationFormValues,
} from '@/types/insurancePolicy'

const coverageTypeOptions: CrudSelectOption[] = [
  { label: 'Commercial', value: 'Commercial' },
  { label: 'Medicare', value: 'Medicare' },
  { label: 'Medicaid', value: 'Medicaid' },
  { label: 'Tricare', value: 'Tricare' },
  { label: 'Workers Compensation', value: 'Workers Compensation' },
  { label: 'Self Pay', value: 'Self Pay' },
  { label: 'Other', value: 'Other' },
]

const coveragePriorityOptions: CrudSelectOption[] = [
  { label: 'Primary', value: 'Primary' },
  { label: 'Secondary', value: 'Secondary' },
  { label: 'Tertiary', value: 'Tertiary' },
  { label: 'Quaternary', value: 'Quaternary' },
]

const policyStatusOptions: CrudSelectOption[] = [
  { label: 'Active', value: 'Active' },
  { label: 'Pending', value: 'Pending' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Terminated', value: 'Terminated' },
  { label: 'Cancelled', value: 'Cancelled' },
]

const relationshipToSubscriberOptions: CrudSelectOption[] = [
  { label: 'Self', value: 'Self' },
  { label: 'Spouse', value: 'Spouse' },
  { label: 'Child', value: 'Child' },
  { label: 'Other', value: 'Other' },
  { label: 'Unknown', value: 'Unknown' },
]

const stateOptions: CrudSelectOption[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
].map((state) => ({ label: state, value: state }))

const genderOptions: CrudSelectOption[] = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
  { label: 'Unknown', value: 'Unknown' },
]

const insuranceAttachmentTypeOptions: CrudSelectOption[] = [
  { label: 'Insurance card', value: 'Insurance Card' },
  { label: 'Plan document', value: 'Plan Document' },
  { label: 'Eligibility response', value: 'Eligibility Response' },
  { label: 'Authorization letter', value: 'Authorization Letter' },
  { label: 'Other', value: 'Other' },
]

export const insurancePolicyApiDetails = {
  endpoint: '/rcm/insurance-policies',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const optionalPhoneField = z
  .string()
  .trim()
  .refine((value) => !value || phonePattern.test(value), 'Enter a valid phone number')

const insurancePolicySubscriberFormSchema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  dob: z.date().nullable(),
  gender: z.string().trim(),
  phone: optionalPhoneField,
  email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
  addressLine1: z.string().trim(),
  addressLine2: z.string().trim(),
  city: z.string().trim(),
  state: z.string().trim().refine((value) => !value || stateCodePattern.test(value), 'Use the 2-letter state code'),
  zipCode: z.string().trim().refine((value) => !value || zipCodePattern.test(value), 'Enter a valid ZIP code'),
})

const insurancePolicyCardFormSchema = z.object({
  frontImageUrl: z.string().trim(),
  backImageUrl: z.string().trim(),
})

const insurancePolicyVerificationFormSchema = z.object({
  lastVerifiedDateTime: z.date().nullable(),
  nextVerificationDueDate: z.date().nullable(),
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

export const insurancePolicyFormSchema = z
  .object({
    _id: z.string().optional(),
    patientId: z.string().trim().min(1, 'Patient is required'),
    payerId: z.string().trim().min(1, 'Payer is required'),
    ediPayerId: z.string().trim(),
    payerType: z.string().trim(),
    coverageType: z.string().trim().min(1, 'Coverage type is required'),
    planName: z.string().trim().min(1, 'Plan name is required'),
    memberId: z.string().trim().min(1, 'Member ID is required'),
    subscriberId: z.string().trim(),
    groupNumber: z.string().trim(),
    dependentNumber: z.string().trim(),
    coveragePriority: z.string().trim().min(1, 'Coverage priority is required'),
    network: z.string().trim(),
    effectiveDate: z.date().nullable(),
    terminationDate: z.date().nullable(),
    policyStatus: z.string().trim().min(1, 'Policy status is required'),
    relationshipToSubscriber: z.string().trim().min(1, 'Relationship to subscriber is required'),
    insuranceVerifiedFlag: z.boolean(),
    subscriber: insurancePolicySubscriberFormSchema,
    card: insurancePolicyCardFormSchema,
    verification: insurancePolicyVerificationFormSchema,
    attachments: z.array(attachmentLinkFormSchema).max(6),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.effectiveDate && value.terminationDate && value.terminationDate < value.effectiveDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Termination date cannot be earlier than the effective date.',
        path: ['terminationDate'],
      })
    }

    if (value.policyStatus !== 'Pending' && !value.effectiveDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Effective date is required for an active insurance policy.',
        path: ['effectiveDate'],
      })
    }

    if (value.relationshipToSubscriber !== 'Self') {
      if (!value.subscriber.firstName.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber first name is required when the patient is not the subscriber.',
          path: ['subscriber', 'firstName'],
        })
      }

      if (!value.subscriber.lastName.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber last name is required when the patient is not the subscriber.',
          path: ['subscriber', 'lastName'],
        })
      }

      if (!value.subscriber.dob) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber date of birth is required when the patient is not the subscriber.',
          path: ['subscriber', 'dob'],
        })
      }
    }

    const hasAnySubscriberAddress = hasAnyText([
      value.subscriber.addressLine1,
      value.subscriber.city,
      value.subscriber.state,
      value.subscriber.zipCode,
    ])

    if (hasAnySubscriberAddress) {
      if (!value.subscriber.addressLine1.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber address line 1 is required when a subscriber address is provided.',
          path: ['subscriber', 'addressLine1'],
        })
      }

      if (!value.subscriber.city.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber city is required when a subscriber address is provided.',
          path: ['subscriber', 'city'],
        })
      }

      if (!value.subscriber.state.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber state is required when a subscriber address is provided.',
          path: ['subscriber', 'state'],
        })
      }

      if (!value.subscriber.zipCode.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Subscriber ZIP code is required when a subscriber address is provided.',
          path: ['subscriber', 'zipCode'],
        })
      }
    }

    if (value.insuranceVerifiedFlag && !value.verification.lastVerifiedDateTime) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Last verified date/time is required once insurance is marked verified.',
        path: ['verification', 'lastVerifiedDateTime'],
      })
    }

    if (
      value.verification.lastVerifiedDateTime &&
      value.verification.nextVerificationDueDate &&
      value.verification.nextVerificationDueDate < value.verification.lastVerifiedDateTime
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Next verification due date cannot be earlier than the last verified date/time.',
        path: ['verification', 'nextVerificationDueDate'],
      })
    }
  }) as z.ZodType<InsurancePolicyFormValues>

export const insurancePolicyDefaultValues: InsurancePolicyFormValues = {
  _id: '',
  patientId: '',
  payerId: '',
  ediPayerId: '',
  payerType: '',
  coverageType: '',
  planName: '',
  memberId: '',
  subscriberId: '',
  groupNumber: '',
  dependentNumber: '',
  coveragePriority: '',
  network: '',
  effectiveDate: null,
  terminationDate: null,
  policyStatus: 'Active',
  relationshipToSubscriber: '',
  insuranceVerifiedFlag: false,
  subscriber: {
    firstName: '',
    lastName: '',
    dob: null,
    gender: '',
    phone: '',
    email: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    zipCode: '',
  },
  card: {
    frontImageUrl: '',
    backImageUrl: '',
  },
  verification: {
    lastVerifiedDateTime: null,
    nextVerificationDueDate: null,
  },
  attachments: [],
  active: true,
}

export function createInsurancePolicyFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<InsurancePolicyFormValues> {
  return {
    schema: insurancePolicyFormSchema,
    defaultValues: insurancePolicyDefaultValues,
    columns: 3,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'patientId',
        label: 'Patient',
        section: 'Insurance Policy',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
      },
      {
        name: 'payerId',
        label: 'Payer',
        section: 'Insurance Policy',
        type: 'autocomplete',
        placeholder: 'Select payer',
        options: referenceOptions.payers ?? [],
      },
      {
        name: 'coverageType',
        label: 'Coverage type',
        section: 'Insurance Policy',
        type: 'select',
        placeholder: 'Choose coverage type',
        options: coverageTypeOptions,
      },
      {
        name: 'planName',
        label: 'Plan name',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Plan name',
      },
      {
        name: 'memberId',
        label: 'Member ID',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Member ID on the card',
      },
      {
        name: 'subscriberId',
        label: 'Subscriber ID',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Subscriber ID if different',
      },
      {
        name: 'groupNumber',
        label: 'Group number',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Group number',
      },
      {
        name: 'dependentNumber',
        label: 'Dependent number',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Dependent number',
      },
      {
        name: 'coveragePriority',
        label: 'Coverage priority',
        section: 'Insurance Policy',
        type: 'select',
        placeholder: 'Choose coverage priority',
        options: coveragePriorityOptions,
      },
      {
        name: 'policyStatus',
        label: 'Policy status',
        section: 'Insurance Policy',
        type: 'select',
        placeholder: 'Choose policy status',
        options: policyStatusOptions,
      },
      {
        name: 'relationshipToSubscriber',
        label: 'Relationship to subscriber',
        section: 'Insurance Policy',
        type: 'select',
        placeholder: 'Choose relationship',
        options: relationshipToSubscriberOptions,
      },
      {
        name: 'network',
        label: 'Network',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Network or plan network',
      },
      {
        name: 'effectiveDate',
        label: 'Effective date',
        section: 'Insurance Policy',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'terminationDate',
        label: 'Termination date',
        section: 'Insurance Policy',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'ediPayerId',
        label: 'EDI payer ID',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Derived from payer setup',
        hideOnAddForm: true,
        disableOnEditForm: true,
        helperText: 'Filled automatically from the selected payer.',
      },
      {
        name: 'payerType',
        label: 'Payer type',
        section: 'Insurance Policy',
        type: 'text',
        placeholder: 'Derived from payer setup',
        hideOnAddForm: true,
        disableOnEditForm: true,
        helperText: 'Filled automatically from the selected payer.',
      },
      {
        name: 'insuranceVerifiedFlag',
        label: 'Insurance verified',
        section: 'Insurance Policy',
        type: 'switch',
        switch: {
          checkedLabel: 'Verified',
          uncheckedLabel: 'Pending verification',
        },
      },
      {
        name: 'subscriber.firstName',
        label: 'Subscriber first name',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber first name',
      },
      {
        name: 'subscriber.lastName',
        label: 'Subscriber last name',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber last name',
      },
      {
        name: 'subscriber.dob',
        label: 'Subscriber date of birth',
        section: 'Subscriber',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'subscriber.gender',
        label: 'Subscriber gender',
        section: 'Subscriber',
        type: 'select',
        placeholder: 'Choose gender',
        options: genderOptions,
      },
      {
        name: 'subscriber.phone',
        label: 'Subscriber phone',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber phone',
      },
      {
        name: 'subscriber.email',
        label: 'Subscriber email',
        section: 'Subscriber',
        type: 'email',
        placeholder: 'subscriber@example.com',
      },
      {
        name: 'subscriber.addressLine1',
        label: 'Subscriber address line 1',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber address line 1',
      },
      {
        name: 'subscriber.addressLine2',
        label: 'Subscriber address line 2',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber address line 2',
      },
      {
        name: 'subscriber.city',
        label: 'Subscriber city',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber city',
      },
      {
        name: 'subscriber.state',
        label: 'Subscriber state',
        section: 'Subscriber',
        type: 'select',
        placeholder: 'Choose state',
        options: stateOptions,
      },
      {
        name: 'subscriber.zipCode',
        label: 'Subscriber ZIP code',
        section: 'Subscriber',
        type: 'text',
        placeholder: 'Subscriber ZIP code',
      },
      {
        name: 'card.frontImageUrl',
        label: 'Insurance card front',
        section: 'Card',
        type: 'upload',
        helperText: 'Upload the front of the member insurance card.',
        upload: {
          accept: '.pdf,.png,.jpg,.jpeg,.webp,image/*',
          chooseLabel: 'Upload front image',
          folder: 'insurance-cards',
        },
      },
      {
        name: 'card.backImageUrl',
        label: 'Insurance card back',
        section: 'Card',
        type: 'upload',
        helperText: 'Upload the back of the member insurance card.',
        upload: {
          accept: '.pdf,.png,.jpg,.jpeg,.webp,image/*',
          chooseLabel: 'Upload back image',
          folder: 'insurance-cards',
        },
      },
      {
        name: 'verification.lastVerifiedDateTime',
        label: 'Last verified',
        section: 'Verification',
        type: 'date',
        date: {
          showButtonBar: true,
          showTime: true,
        },
      },
      {
        name: 'verification.nextVerificationDueDate',
        label: 'Next verification due',
        section: 'Verification',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'attachments',
        label: 'Insurance documents',
        section: 'Documents',
        type: 'attachments',
        fullWidth: true,
        helperText: 'Upload plan letters, COB paperwork, eligibility documents, and other supporting files.',
        attachments: {
          maxItems: 6,
          accept: '.pdf,.png,.jpg,.jpeg,.webp,image/*',
          documentTypeOptions: insuranceAttachmentTypeOptions,
          uploadFolder: 'insurance-documents',
        },
      },
      {
        name: 'active',
        label: 'Active',
        type: 'hidden',
      }
    ],
  }
}

export function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function optionalDate(value: Date | null) {
  return value ?? undefined
}

export function toFormDate(value?: string | Date | null) {
  if (!value) {
    return null
  }

  const dateValue = value instanceof Date ? value : new Date(value)
  return Number.isNaN(dateValue.getTime()) ? null : dateValue
}

export function formatDate(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatBoolean(value?: boolean) {
  return value ? 'Yes' : 'No'
}

function deriveCoordinationOfBenefitsOrder(coveragePriority: string) {
  switch (coveragePriority) {
    case 'Primary':
      return 1
    case 'Secondary':
      return 2
    case 'Tertiary':
      return 3
    case 'Quaternary':
      return 4
    default:
      return undefined
  }
}

function isAttachmentEmpty(attachment: AttachmentLinkFormValues) {
  return (
    !attachment.documentType.trim() &&
    !attachment.title.trim() &&
    !attachment.fileUrl.trim() &&
    !attachment.description.trim()
  )
}

function compactInsurancePolicySubscriber(
  value: InsurancePolicySubscriberFormValues,
): InsurancePolicySubscriber | undefined {
  const nextValue = {
    firstName: optionalText(value.firstName),
    lastName: optionalText(value.lastName),
    dob: optionalDate(value.dob),
    gender: optionalText(value.gender),
    phone: optionalText(value.phone),
    email: optionalText(value.email),
    addressLine1: optionalText(value.addressLine1),
    addressLine2: optionalText(value.addressLine2),
    city: optionalText(value.city),
    state: optionalText(value.state),
    zipCode: optionalText(value.zipCode),
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

function compactInsurancePolicyCard(value: InsurancePolicyCardFormValues): InsurancePolicyCard | undefined {
  const nextValue = {
    frontImageUrl: optionalText(value.frontImageUrl),
    backImageUrl: optionalText(value.backImageUrl),
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

function compactInsurancePolicyVerification(
  value: InsurancePolicyVerificationFormValues,
): InsurancePolicyVerification | undefined {
  const nextValue = {
    lastVerifiedDateTime: optionalDate(value.lastVerifiedDateTime),
    nextVerificationDueDate: optionalDate(value.nextVerificationDueDate),
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

function compactAttachments(attachments: InsurancePolicyFormValues['attachments']): AttachmentLink[] | undefined {
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

function buildAttachments(attachments: AttachmentLink[] = []): AttachmentLinkFormValues[] {
  return attachments.map((attachment) => ({
    documentType: attachment.documentType ?? '',
    title: attachment.title ?? '',
    fileUrl: attachment.fileUrl ?? '',
    description: attachment.description ?? '',
  }))
}

export function mapInsurancePolicyToFormValues(item: InsurancePolicy): InsurancePolicyFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    payerId: item.payerId ?? '',
    ediPayerId: item.ediPayerId ?? '',
    payerType: item.payerType ?? '',
    coverageType: item.coverageType ?? '',
    planName: item.planName ?? '',
    memberId: item.memberId ?? '',
    subscriberId: item.subscriberId ?? '',
    groupNumber: item.groupNumber ?? '',
    dependentNumber: item.dependentNumber ?? '',
    coveragePriority: item.coveragePriority ?? '',
    network: item.network ?? '',
    effectiveDate: toFormDate(item.effectiveDate),
    terminationDate: toFormDate(item.terminationDate),
    policyStatus: item.policyStatus ?? 'Active',
    relationshipToSubscriber: item.relationshipToSubscriber ?? '',
    insuranceVerifiedFlag: item.insuranceVerifiedFlag,
    subscriber: {
      firstName: item.subscriber.firstName ?? '',
      lastName: item.subscriber.lastName ?? '',
      dob: toFormDate(item.subscriber.dob),
      gender: item.subscriber.gender ?? '',
      phone: item.subscriber.phone ?? '',
      email: item.subscriber.email ?? '',
      addressLine1: item.subscriber.addressLine1 ?? '',
      addressLine2: item.subscriber.addressLine2 ?? '',
      city: item.subscriber.city ?? '',
      state: item.subscriber.state ?? '',
      zipCode: item.subscriber.zipCode ?? '',
    },
    card: {
      frontImageUrl: item.card.frontImageUrl ?? '',
      backImageUrl: item.card.backImageUrl ?? '',
    },
    verification: {
      lastVerifiedDateTime: toFormDate(item.verification.lastVerifiedDateTime),
      nextVerificationDueDate: toFormDate(item.verification.nextVerificationDueDate),
    },
    attachments: buildAttachments(item.attachments),
    active: item.active,
  }
}

export function mapInsurancePolicyFormToPayload(values: InsurancePolicyFormValues): InsurancePolicyCreatePayload {
  return {
    patientId: values.patientId.trim(),
    payerId: values.payerId.trim(),
    ediPayerId: optionalText(values.ediPayerId),
    payerType: optionalText(values.payerType),
    coverageType: values.coverageType.trim(),
    planName: values.planName.trim(),
    memberId: values.memberId.trim(),
    subscriberId: optionalText(values.subscriberId),
    groupNumber: optionalText(values.groupNumber),
    dependentNumber: optionalText(values.dependentNumber),
    coveragePriority: values.coveragePriority.trim(),
    coordinationOfBenefitsOrder: deriveCoordinationOfBenefitsOrder(values.coveragePriority),
    network: optionalText(values.network),
    effectiveDate: optionalDate(values.effectiveDate),
    terminationDate: optionalDate(values.terminationDate),
    policyStatus: values.policyStatus.trim(),
    relationshipToSubscriber: values.relationshipToSubscriber.trim(),
    insuranceVerifiedFlag: values.insuranceVerifiedFlag,
    subscriber: compactInsurancePolicySubscriber(values.subscriber),
    card: compactInsurancePolicyCard(values.card),
    verification: compactInsurancePolicyVerification(values.verification),
    attachments: compactAttachments(values.attachments),
    active: values.active,
  }
}

function getInsurancePolicyLabel(item: InsurancePolicy, referenceOptions: RcmReferenceOptions = {}) {
  const patientLabel = formatReferenceLabel(referenceOptions.patients, item.patientId)
  const baseLabel = [item.planName, item.memberId].filter((value) => value && value !== '-').join(' / ')

  return [baseLabel || item._id, patientLabel !== '-' ? patientLabel : undefined]
    .filter(Boolean)
    .join(' • ')
}

export function createInsurancePolicyTableColumns(
  referenceOptions: RcmReferenceOptions = {},
): Array<CrudTableColumn<InsurancePolicy>> {
  return [
    {
      key: 'record',
      header: 'Insurance Policy',
      sortField: 'planName',
      exportValue: (item) => getInsurancePolicyLabel(item, referenceOptions),
      render: (item) => getInsurancePolicyLabel(item, referenceOptions),
    },
    {
      key: 'payerId',
      header: 'Payer',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
      render: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
    },
    {
      key: 'policyStatus',
      header: 'Policy status',
      filterable: true,
      field: 'policyStatus',
      sortField: 'policyStatus',
      exportValue: (item) => item.policyStatus ?? '-',
      render: (item) => item.policyStatus ?? '-',
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortField: 'updated',
      field: 'updatedAt',
      exportValue: (item) => formatDate(item.updatedAt),
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: 'Updated date',
      },
      render: (item) => formatDate(item.updatedAt),
    },
  ]
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

export function renderInsurancePolicyDetails(
  item: InsurancePolicy,
  referenceOptions: RcmReferenceOptions = {},
) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Insurance Policy</h3>
        {renderSection([
          ['Insurance ID', item.insuranceId],
          ['Patient', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['Payer', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['Coverage type', item.coverageType ?? '-'],
          ['Plan name', item.planName ?? '-'],
          ['Member ID', item.memberId ?? '-'],
          ['Subscriber ID', item.subscriberId ?? '-'],
          ['Group number', item.groupNumber ?? '-'],
          ['Dependent number', item.dependentNumber ?? '-'],
          ['Coverage priority', item.coveragePriority ?? '-'],
          ['Coordination of benefits order', item.coordinationOfBenefitsOrder ? String(item.coordinationOfBenefitsOrder) : '-'],
          ['Network', item.network ?? '-'],
          ['Effective date', formatDate(item.effectiveDate)],
          ['Termination date', formatDate(item.terminationDate)],
          ['Policy status', item.policyStatus ?? '-'],
          ['Relationship to subscriber', item.relationshipToSubscriber ?? '-'],
          ['EDI payer ID', item.ediPayerId ?? '-'],
          ['Payer type', item.payerType ?? '-'],
          ['Insurance verified', formatBoolean(item.insuranceVerifiedFlag)],
          ['Active', formatBoolean(item.active)],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Subscriber</h3>
        {renderSection([
          ['First name', item.subscriber.firstName ?? '-'],
          ['Last name', item.subscriber.lastName ?? '-'],
          ['Date of birth', formatDate(item.subscriber.dob)],
          ['Gender', item.subscriber.gender ?? '-'],
          ['Phone', item.subscriber.phone ?? '-'],
          ['Email', item.subscriber.email ?? '-'],
          ['Address line 1', item.subscriber.addressLine1 ?? '-'],
          ['Address line 2', item.subscriber.addressLine2 ?? '-'],
          ['City', item.subscriber.city ?? '-'],
          ['State', item.subscriber.state ?? '-'],
          ['ZIP code', item.subscriber.zipCode ?? '-'],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Card</h3>
        <FilePreviewGrid
          items={[
            {
              title: 'Front of card',
              fileUrl: item.card.frontImageUrl,
              alwaysShow: true,
              emptyLabel: 'No front card uploaded',
            },
            {
              title: 'Back of card',
              fileUrl: item.card.backImageUrl,
              alwaysShow: true,
              emptyLabel: 'No back card uploaded',
            },
          ]}
        />
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Verification</h3>
        {renderSection([
          ['Last verified', formatDate(item.verification.lastVerifiedDateTime)],
          ['Next verification due', formatDate(item.verification.nextVerificationDueDate)],
        ])}
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Dependent Validation</h3>
        <dl className="overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
          <div className="grid gap-1 border-b border-[var(--color-border)] px-4 py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:items-center">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Status</dt>
            <dd className="sm:text-right">
              <span className={[
                'inline-flex rounded-md px-2 py-0.5 text-xs font-semibold',
                item.dependentValidation.status === 'Needs Review'
                  ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-text)]'
                  : 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
              ].join(' ')}>
                {item.dependentValidation.status ?? 'Not checked'}
              </span>
            </dd>
          </div>
          {[
            ['Risk score', typeof item.dependentValidation.riskScore === 'number' ? `${Math.round(item.dependentValidation.riskScore * 100)}%` : '-'],
            ['Source', item.dependentValidation.source ?? '-'],
            ['Checked at', formatDate(item.dependentValidation.checkedAt)],
            ['Issues', item.dependentValidation.issues.length ? item.dependentValidation.issues.join('\n') : '-'],
            ['Suggested fixes', item.dependentValidation.suggestedFixes.length ? item.dependentValidation.suggestedFixes.join('\n') : '-'],
          ].map(([label, value]) => (
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
      </section>

      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Documents</h3>
        <FilePreviewGrid
          items={item.attachments.map((attachment, index) => ({
            title: attachment.title ?? `Document ${index + 1}`,
            subtitle: attachment.documentType,
            description: attachment.description,
            fileUrl: attachment.fileUrl,
          }))}
          emptyMessage="No insurance documents uploaded."
        />
      </section>
    </div>
  )
}

export function renderInsurancePolicyGridItem(
  item: InsurancePolicy,
  referenceOptions: RcmReferenceOptions = {},
) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">
        {getInsurancePolicyLabel(item, referenceOptions)}
      </p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            Payer
          </dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">
            {formatReferenceLabel(referenceOptions.payers, item.payerId)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">
            Policy status
          </dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">
            {item.policyStatus ?? '-'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
