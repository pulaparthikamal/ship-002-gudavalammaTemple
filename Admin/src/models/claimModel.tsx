import { z } from 'zod'
import { cptCodePattern, icd10CodePattern, isPositiveNumber, placeOfServicePattern, splitMultiValueText } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Claim, ClaimCreatePayload, ClaimFormValues, ClaimClaimLine, ClaimClaimLineFormValues } from '@/types/claim'
import type { AttachmentLink, AttachmentLinkFormValues } from '@/types/common'

export const claimApiDetails = {
  endpoint: '/rcm/claims',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

function createSelectOptions(values: Array<{ label: string; value: string }> | string[]): CrudSelectOption[] {
  return values.map((value) =>
    typeof value === 'string'
      ? {
          label: value,
          value,
        }
      : value,
  )
}

const coveragePriorityOptions = createSelectOptions(['Primary', 'Secondary', 'Tertiary'])
const claimTypeOptions = createSelectOptions(['Professional', 'Institutional'])
const claimStatusOptions = createSelectOptions([
  'Draft',
  'Ready for Submission',
  'Submitted',
  'Rejected',
  'UnderCorrection',
  'Resubmitted',
  'On Hold',
])
const scrubStatusOptions = createSelectOptions(['Passed', 'Failed'])
const submissionStatusOptions = createSelectOptions([
  'Not Submitted',
  'Queued',
  'Submitted',
  'Printed',
  'Transmitted',
  'Acknowledged',
  'Rejected',
  'Failed',
])
const paymentStatusOptions = createSelectOptions([
  'PAYMENT_RECEIVED',
  'PARTIALLY_PAID',
  'PAID',
  'PATIENT_RESPONSIBILITY',
  'DENIED',
  'UNDERPAID',
  'PAYMENT_POSTING_FAILED',
])
const frequencyCodeOptions = createSelectOptions([
  { label: '1 - Original', value: '1' },
  { label: '7 - Replacement', value: '7' },
  { label: '8 - Void', value: '8' },
])
const placeOfServiceOptions = createSelectOptions([
  { label: '11 - Office', value: '11' },
  { label: '19 - Off Campus Outpatient Hospital', value: '19' },
  { label: '22 - On Campus Outpatient Hospital', value: '22' },
  { label: '24 - Ambulatory Surgical Center', value: '24' },
  { label: '10 - Telehealth in Patient Home', value: '10' },
  { label: '02 - Telehealth Other than Home', value: '02' },
  { label: '49 - Independent Clinic', value: '49' },
])

const claimAttachmentTypeOptions = createSelectOptions([
  'Clinical Note',
  'Progress Note',
  'Consent Form',
  'Authorization Document',
  'Referral',
  'Appeal Evidence',
  'Medical Record',
  'Other Supporting Document',
])

const claimClaimLineFormSchema = z.object({
  lineNumber: z.number().nullable(),
  chargeLineId: z.string().trim(),
  cptCode: z.string().trim(),
  modifiers: z.string().trim(),
  icdPointers: z.string().trim(),
  units: z.number().nullable(),
  chargeAmount: z.number().nullable(),
  renderingProviderId: z.string().trim(),
  placeOfService: z.string().trim(),
  serviceDateFrom: z.date().nullable(),
  serviceDateTo: z.date().nullable(),
})

const attachmentLinkFormSchema = z.object({
  documentType: z.string().trim(),
  title: z.string().trim(),
  fileUrl: z.string().trim(),
  description: z.string().trim(),
})

export const claimFormSchema = z.object({
  _id: z.string().optional(),
  chargeId: z.string().trim().min(1, 'Charge is required'),
  encounterId: z.string().trim().min(1, 'Encounter is required'),
  patientId: z.string().trim().min(1, 'Patient is required'),
  payerId: z.string().trim().min(1, 'Payer is required'),
  billingProviderId: z.string().trim().min(1, 'Billing provider is required'),
  renderingProviderId: z.string().trim().min(1, 'Rendering provider is required'),
  facilityId: z.string().trim().min(1, 'Facility is required'),
  claimDate: z.date().nullable(),
  totalChargeAmount: z.number().nullable(),
  diagnosisCodes: z.string().trim(),
  coveragePriority: z.string().trim(),
  frequencyCode: z.string().trim(),
  claimType: z.string().trim(),
  claimStatus: z.string().trim(),
  scrubStatus: z.string().trim(),
  submissionStatus: z.string().trim(),
  paymentStatus: z.string().trim(),
  rejectionReason: z.string().trim(),
  originalClaimId: z.string().trim(),
  correctedFromClaimId: z.string().trim(),
  sourceDenialId: z.string().trim(),
  correctedClaimRecordId: z.string().trim(),
  correctionType: z.string().trim(),
  correctedClaimIndicator: z.boolean(),
  batchId: z.string().trim(),
  clearingHouse: z.string().trim(),
  ediStatus: z.string().trim(),
  claimLines: z.array(claimClaimLineFormSchema).min(1),
  attachments: z.array(attachmentLinkFormSchema).max(12),
  active: z.boolean(),
}).superRefine((value, context) => {
  if (!value.claimDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Claim date is required.',
      path: ['claimDate'],
    })
  }

  if (!isPositiveNumber(value.totalChargeAmount)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total charge amount must be greater than 0.',
      path: ['totalChargeAmount'],
    })
  }

  const diagnosisCodes = splitMultiValueText(value.diagnosisCodes)

  if (!diagnosisCodes.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one diagnosis code is required.',
      path: ['diagnosisCodes'],
    })
  }

  const invalidDiagnosisCodes = diagnosisCodes.filter((code) => !icd10CodePattern.test(code))

  if (invalidDiagnosisCodes.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Invalid diagnosis code(s): ${invalidDiagnosisCodes.join(', ')}`,
      path: ['diagnosisCodes'],
    })
  }

  if (value.correctedClaimIndicator && !value.originalClaimId.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Original claim ID is required for corrected claims.',
      path: ['originalClaimId'],
    })
  }

  const nonEmptyLines = value.claimLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) =>
      [
        line.lineNumber !== null,
        line.chargeLineId.trim(),
        line.cptCode.trim(),
        line.modifiers.trim(),
        line.icdPointers.trim(),
        line.units !== null,
        line.chargeAmount !== null,
        line.renderingProviderId.trim(),
        line.placeOfService.trim(),
        line.serviceDateFrom,
        line.serviceDateTo,
      ].some(Boolean),
    )

  if (!nonEmptyLines.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one claim line is required.',
      path: ['claimLines'],
    })
  }

  nonEmptyLines.forEach(({ line, index }) => {
    if (!line.cptCode.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPT/HCPCS code is required.',
        path: ['claimLines', index, 'cptCode'],
      })
    } else if (!cptCodePattern.test(line.cptCode.trim())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPT/HCPCS code must be a valid 5-character code.',
        path: ['claimLines', index, 'cptCode'],
      })
    }

    const pointers = parseNumberList(line.icdPointers)

    if (!line.icdPointers.trim() || !pointers?.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diagnosis pointers are required.',
        path: ['claimLines', index, 'icdPointers'],
      })
    } else if (pointers.some((pointer) => pointer < 1 || pointer > diagnosisCodes.length)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diagnosis pointers must reference an existing diagnosis code position.',
        path: ['claimLines', index, 'icdPointers'],
      })
    }

    if (!isPositiveNumber(line.units)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Units must be greater than 0.',
        path: ['claimLines', index, 'units'],
      })
    }

    if (!isPositiveNumber(line.chargeAmount)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge amount must be greater than 0.',
        path: ['claimLines', index, 'chargeAmount'],
      })
    }

    if (!line.renderingProviderId.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rendering provider is required for each claim line.',
        path: ['claimLines', index, 'renderingProviderId'],
      })
    }

    if (!line.placeOfService.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Place of service is required for each claim line.',
        path: ['claimLines', index, 'placeOfService'],
      })
    } else if (!placeOfServicePattern.test(line.placeOfService.trim())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Place of service must be a valid 2-digit code.',
        path: ['claimLines', index, 'placeOfService'],
      })
    }

    if (!line.serviceDateFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service-from date is required for each claim line.',
        path: ['claimLines', index, 'serviceDateFrom'],
      })
    }

    if (line.serviceDateTo && line.serviceDateFrom && line.serviceDateTo < line.serviceDateFrom) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service-to date cannot be earlier than the service-from date.',
        path: ['claimLines', index, 'serviceDateTo'],
      })
    }
  })

  const summedChargeAmount = nonEmptyLines.reduce((total, { line }) => total + (line.chargeAmount ?? 0), 0)

  if (isPositiveNumber(value.totalChargeAmount) && nonEmptyLines.length && Math.abs(summedChargeAmount - value.totalChargeAmount) > 0.01) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total charge amount must match the sum of the claim lines.',
      path: ['totalChargeAmount'],
    })
  }
}) as z.ZodType<ClaimFormValues>

function createEmptyClaimClaimLine(): ClaimClaimLineFormValues {
  return {
    lineNumber: null,
    chargeLineId: '',
    cptCode: '',
    modifiers: '',
    icdPointers: '',
    units: null,
    chargeAmount: null,
    renderingProviderId: '',
    placeOfService: '',
    serviceDateFrom: null,
    serviceDateTo: null,
  }
}

export const claimDefaultValues: ClaimFormValues = {
  _id: '',
  chargeId: '',
  encounterId: '',
  patientId: '',
  payerId: '',
  billingProviderId: '',
  renderingProviderId: '',
  facilityId: '',
  claimDate: null,
  totalChargeAmount: null,
  diagnosisCodes: '',
  coveragePriority: 'Primary',
  frequencyCode: '',
  claimType: 'Professional',
  claimStatus: 'Draft',
  scrubStatus: 'Passed',
  submissionStatus: 'Not Submitted',
  paymentStatus: '',
  rejectionReason: '',
  originalClaimId: '',
  correctedFromClaimId: '',
  sourceDenialId: '',
  correctedClaimRecordId: '',
  correctionType: '',
  correctedClaimIndicator: false,
  batchId: '',
  clearingHouse: '',
  ediStatus: '',
  claimLines: [createEmptyClaimClaimLine(), createEmptyClaimClaimLine()],
  attachments: [],
  active: true,
}

export function createClaimFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ClaimFormValues> {
  return {
    schema: claimFormSchema,
    defaultValues: claimDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'chargeId',
        label: 'Charge',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select charge',
        options: referenceOptions.charges ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'encounterId',
        label: 'Encounter',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select encounter',
        options: referenceOptions.encounters ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'patientId',
        label: 'Patient',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'payerId',
        label: 'Payer',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select payer',
        options: referenceOptions.payers ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'billingProviderId',
        label: 'Billing provider',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select billing provider',
        options: referenceOptions.providers ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'renderingProviderId',
        label: 'Rendering provider',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select rendering provider',
        options: referenceOptions.providers ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'facilityId',
        label: 'Facility',
        section: 'Claim Header',
        type: 'autocomplete',
        placeholder: 'Select facility',
        options: referenceOptions.facilities ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'claimDate',
        label: 'Claim date',
        section: 'Claim Header',
        type: 'date',
        disableOnEditForm: true,
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'totalChargeAmount',
        label: 'Total charge amount',
        section: 'Claim Header',
        type: 'number',
        disableOnEditForm: true,
      },
      {
        name: 'coveragePriority',
        label: 'Coverage priority',
        section: 'Claim Header',
        type: 'select',
        placeholder: 'Select coverage priority',
        options: coveragePriorityOptions,
        disableOnEditForm: true,
      },
      {
        name: 'claimType',
        label: 'Claim type',
        section: 'Claim Header',
        type: 'select',
        placeholder: 'Select claim type',
        options: claimTypeOptions,
        disableOnEditForm: true,
      },
      {
        name: 'diagnosisCodes',
        label: 'Diagnosis codes',
        section: 'Claim Header',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
      },
      {
        name: 'frequencyCode',
        label: 'Frequency code',
        section: 'Claim Status',
        type: 'select',
        placeholder: 'Select frequency code',
        options: frequencyCodeOptions,
      },
      {
        name: 'claimStatus',
        label: 'Claim status',
        section: 'Claim Status',
        type: 'select',
        placeholder: 'Select claim status',
        options: claimStatusOptions,
        disableOnEditForm: true,
      },
      {
        name: 'scrubStatus',
        label: 'Scrub status',
        section: 'Claim Status',
        type: 'select',
        placeholder: 'Select scrub status',
        options: scrubStatusOptions,
        disableOnEditForm: true,
      },
      {
        name: 'submissionStatus',
        label: 'Submission status',
        section: 'Claim Status',
        type: 'select',
        placeholder: 'Select submission status',
        options: submissionStatusOptions,
        disableOnEditForm: true,
      },
      {
        name: 'paymentStatus',
        label: 'Payment status',
        section: 'Claim Status',
        type: 'select',
        placeholder: 'Select payment status',
        options: paymentStatusOptions,
        disableOnEditForm: true,
      },
      {
        name: 'rejectionReason',
        label: 'Rejection reason',
        section: 'Claim Status',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        hideOnAddForm: true,
        disableOnEditForm: true,
      },
      {
        name: 'originalClaimId',
        label: 'Original claim',
        section: 'Claim Status',
        type: 'autocomplete',
        placeholder: 'Select original claim',
        options: referenceOptions.claims ?? [],
        hideOnAddForm: true,
      },
      {
        name: 'correctedClaimIndicator',
        label: 'Corrected claim',
        section: 'Claim Status',
        type: 'switch',
      },
      {
        name: 'batchId',
        label: 'Batch ID',
        section: 'Claim Status',
        type: 'text',
        placeholder: 'Batch ID',
        hideOnAddForm: true,
        disableOnEditForm: true,
      },
      {
        name: 'clearingHouse',
        label: 'Clearinghouse',
        section: 'Claim Status',
        type: 'text',
        placeholder: 'Clearinghouse',
        hideOnAddForm: true,
        disableOnEditForm: true,
      },
      {
        name: 'ediStatus',
        label: 'EDI status',
        section: 'Claim Status',
        type: 'text',
        placeholder: 'EDI status',
        hideOnAddForm: true,
        disableOnEditForm: true,
      },
      {
        name: 'claimLines',
        label: 'Claim lines',
        section: 'Claim Lines',
        type: 'claimLines',
        fullWidth: true,
        claimLines: {
          providerOptions: referenceOptions.providers ?? [],
          placeOfServiceOptions,
        },
      },
      {
        name: 'attachments',
        label: 'Supporting documents',
        section: 'Documentation',
        type: 'attachments',
        fullWidth: true,
        helperText: 'Upload clinical notes, progress notes, authorizations, referrals, consent forms, and other claim support.',
        attachments: {
          maxItems: 12,
          accept: '.pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,application/pdf,image/png,image/jpeg,image/webp,image/tiff,image/*',
          documentTypeOptions: claimAttachmentTypeOptions,
          uploadFolder: 'claim-documents',
          documentMetadata: (values) => {
            const claimId = values._id?.trim()

            if (!claimId) {
              return undefined
            }

            return {
              claimId,
              entityType: 'claim',
              entityId: claimId,
              uploadSource: 'claim-attachments',
            }
          },
        },
      },
      {
        name: 'active',
        label: 'Active record',
        type: 'hidden',
      },
    ],
  }
}


export function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function optionalNumber(value: number | null) {
  return typeof value === 'number' ? value : undefined
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

export function formatNumber(value?: number | null) {
  return typeof value === 'number' ? String(value) : '-'
}

export function parseStringList(value: string) {
  const values = value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)

  return values.length ? values : undefined
}

export function parseNumberList(value: string) {
  const values = value
    .split(/[\n,]+/)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item))

  return values.length ? values : undefined
}

export function formatStringList(value: string[] = []) {
  return value.join('\n')
}

export function formatNumberList(value: number[] = []) {
  return value.map(String).join('\n')
}

function buildClaimClaimLines(claimLines: ClaimClaimLine[] = []): ClaimClaimLineFormValues[] {
  return Array.from({ length: Math.max(2, claimLines.length) }, (_, index) => {
    const item = claimLines[index]

    return {
      lineNumber: item?.lineNumber ?? null,
      chargeLineId: item?.chargeLineId ?? '',
      cptCode: item?.cptCode ?? '',
      modifiers: formatStringList(item?.modifiers),
      icdPointers: formatNumberList(item?.icdPointers),
      units: item?.units ?? null,
      chargeAmount: item?.chargeAmount ?? null,
      renderingProviderId: item?.renderingProviderId ?? '',
      placeOfService: item?.placeOfService ?? '',
      serviceDateFrom: toFormDate(item?.serviceDateFrom),
      serviceDateTo: toFormDate(item?.serviceDateTo),
    }
  })
}

function isClaimClaimLineEmpty(item: ClaimClaimLineFormValues) {
  return item.lineNumber === null && !item.chargeLineId.trim() && !item.cptCode.trim() && !item.modifiers.trim() && !item.icdPointers.trim() && item.units === null && item.chargeAmount === null && !item.renderingProviderId.trim() && !item.placeOfService.trim() && item.serviceDateFrom === null && item.serviceDateTo === null
}

function compactClaimClaimLines(claimLines: ClaimClaimLineFormValues[]): ClaimClaimLine[] | undefined {
  const nextItems = claimLines
    .filter((item) => !isClaimClaimLineEmpty(item))
    .map((item) => ({
      lineNumber: optionalNumber(item.lineNumber),
      chargeLineId: optionalText(item.chargeLineId),
      cptCode: optionalText(item.cptCode),
      modifiers: parseStringList(item.modifiers),
      icdPointers: parseNumberList(item.icdPointers),
      units: optionalNumber(item.units),
      chargeAmount: optionalNumber(item.chargeAmount),
      renderingProviderId: optionalText(item.renderingProviderId),
      placeOfService: optionalText(item.placeOfService),
      serviceDateFrom: optionalDate(item.serviceDateFrom),
      serviceDateTo: optionalDate(item.serviceDateTo),
    }))

  return nextItems.length ? nextItems : undefined
}

function buildAttachments(attachments: AttachmentLink[] = []): AttachmentLinkFormValues[] {
  return attachments.map((attachment) => ({
    documentType: attachment.documentType ?? '',
    title: attachment.title ?? '',
    fileUrl: attachment.fileUrl ?? '',
    description: attachment.description ?? '',
  }))
}

function compactAttachments(attachments: ClaimFormValues['attachments']): AttachmentLink[] {
  const nextAttachments = attachments
    .map((attachment) => ({
      documentType: optionalText(attachment.documentType),
      title: optionalText(attachment.title),
      fileUrl: optionalText(attachment.fileUrl),
      description: optionalText(attachment.description),
    }))
    .filter((attachment) => Object.values(attachment).some(Boolean))

  return nextAttachments
}

export function mapClaimToFormValues(item: Claim): ClaimFormValues {
  return {
    _id: item._id,
    chargeId: item.chargeId ?? '',
    encounterId: item.encounterId ?? '',
    patientId: item.patientId ?? '',
    payerId: item.payerId ?? '',
    billingProviderId: item.billingProviderId ?? '',
    renderingProviderId: item.renderingProviderId ?? '',
    facilityId: item.facilityId ?? '',
    claimDate: toFormDate(item.claimDate),
    totalChargeAmount: item.totalChargeAmount ?? null,
    diagnosisCodes: formatStringList(item.diagnosisCodes),
    coveragePriority: item.coveragePriority ?? '',
    frequencyCode: item.frequencyCode ?? '',
    claimType: item.claimType ?? '',
    claimStatus: item.claimStatus ?? '',
    scrubStatus: item.scrubStatus ?? '',
    submissionStatus: item.submissionStatus ?? '',
    paymentStatus: item.paymentStatus ?? '',
    rejectionReason: item.rejectionReason ?? '',
    originalClaimId: item.originalClaimId ?? '',
    correctedFromClaimId: item.correctedFromClaimId ?? '',
    sourceDenialId: item.sourceDenialId ?? '',
    correctedClaimRecordId: item.correctedClaimRecordId ?? '',
    correctionType: item.correctionType ?? '',
    correctedClaimIndicator: item.correctedClaimIndicator,
    batchId: item.batchId ?? '',
    clearingHouse: item.clearingHouse ?? '',
    ediStatus: item.ediStatus ?? '',
    claimLines: buildClaimClaimLines(item.claimLines),
    attachments: buildAttachments(item.attachments),
    active: item.active,
  }
}

export function mapClaimFormToPayload(values: ClaimFormValues): ClaimCreatePayload {
  return {
    chargeId: optionalText(values.chargeId),
    encounterId: optionalText(values.encounterId),
    patientId: optionalText(values.patientId),
    payerId: optionalText(values.payerId),
    billingProviderId: optionalText(values.billingProviderId),
    renderingProviderId: optionalText(values.renderingProviderId),
    facilityId: optionalText(values.facilityId),
    claimDate: optionalDate(values.claimDate),
    totalChargeAmount: optionalNumber(values.totalChargeAmount),
    diagnosisCodes: parseStringList(values.diagnosisCodes),
    coveragePriority: optionalText(values.coveragePriority),
    frequencyCode: optionalText(values.frequencyCode),
    claimType: optionalText(values.claimType),
    claimStatus: optionalText(values.claimStatus),
    scrubStatus: optionalText(values.scrubStatus),
    submissionStatus: optionalText(values.submissionStatus),
    paymentStatus: optionalText(values.paymentStatus),
    rejectionReason: optionalText(values.rejectionReason),
    originalClaimId: optionalText(values.originalClaimId),
    correctedFromClaimId: optionalText(values.correctedFromClaimId),
    sourceDenialId: optionalText(values.sourceDenialId),
    correctedClaimRecordId: optionalText(values.correctedClaimRecordId),
    correctionType: optionalText(values.correctionType),
    correctedClaimIndicator: values.correctedClaimIndicator,
    batchId: optionalText(values.batchId),
    clearingHouse: optionalText(values.clearingHouse),
    ediStatus: optionalText(values.ediStatus),
    claimLines: compactClaimClaimLines(values.claimLines),
    attachments: compactAttachments(values.attachments),
    active: values.active,
  }
}

export function getClaimRowLabel(item: Claim, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [formatDate(item.claimDate), item.claimStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createClaimTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Claim>> {
  return [
    {
      key: 'record',
      header: 'Claim',
      sortField: 'claimDate',
      exportValue: (item) => getClaimRowLabel(item, referenceOptions),
      render: (item) => getClaimRowLabel(item, referenceOptions),
    },
    {
      key: 'patientId',
      header: 'Patient',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.patients, item.patientId),
      render: (item) => formatReferenceLabel(referenceOptions.patients, item.patientId),
    },
    {
      key: 'claimStatus',
      header: 'claim Status',
      filterable: true,
      field: 'claimStatus',
      sortField: 'claimStatus',
      exportValue: (item) => item.claimStatus ?? '-',
      render: (item) => item.claimStatus ?? '-',
    },
    {
      key: 'submissionStatus',
      header: 'submission Status',
      filterable: true,
      field: 'submissionStatus',
      sortField: 'submissionStatus',
      exportValue: (item) => item.submissionStatus ?? '-',
      render: (item) => item.submissionStatus ?? '-',
    },
    {
      key: 'paymentStatus',
      header: 'payment Status',
      filterable: true,
      field: 'paymentStatus',
      sortField: 'paymentStatus',
      exportValue: (item) => item.paymentStatus ?? '-',
      render: (item) => item.paymentStatus ?? '-',
    },
    {
      key: 'closureStatus',
      header: 'closure Status',
      filterable: true,
      field: 'closureStatus',
      sortField: 'closureStatus',
      exportValue: (item) => item.closureStatus ?? '-',
      render: (item) => item.closureStatus ?? '-',
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

export function renderClaimDetails(item: Claim, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Claim</h3>
        {renderSection([
          ['claim ID', item.claimId],
          ['charge ID', formatReferenceLabel(referenceOptions.charges, item.chargeId)],
          ['encounter ID', formatReferenceLabel(referenceOptions.encounters, item.encounterId)],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['billing Provider ID', formatReferenceLabel(referenceOptions.providers, item.billingProviderId)],
          ['rendering Provider ID', formatReferenceLabel(referenceOptions.providers, item.renderingProviderId)],
          ['facility ID', formatReferenceLabel(referenceOptions.facilities, item.facilityId)],
          ['claim Date', formatDate(item.claimDate)],
          ['total Charge Amount', formatNumber(item.totalChargeAmount)],
          ['diagnosis Codes', (item.diagnosisCodes ?? []).join(', ') || '-'],
          ['coverage Priority', item.coveragePriority ?? '-'],
          ['frequency Code', item.frequencyCode ?? '-'],
          ['claim Type', item.claimType ?? '-'],
          ['claim Status', item.claimStatus ?? '-'],
          ['scrub Status', item.scrubStatus ?? '-'],
          ['submission Status', item.submissionStatus ?? '-'],
          ['payment Status', item.paymentStatus ?? '-'],
          ['closure Status', item.closureStatus ?? '-'],
          ['expected ERA By', formatDate(item.expectedEraBy)],
          ['closed At', formatDate(item.closedAt)],
          ['close Reason', item.closeReason ?? '-'],
          ['rejection Reason', item.rejectionReason ?? '-'],
          ['original Claim ID', formatReferenceLabel(referenceOptions.claims, item.originalClaimId)],
          ['parent Claim ID', formatReferenceLabel(referenceOptions.claims, item.parentClaimId)],
          ['version', formatNumber(item.version)],
          ['resubmission Count', formatNumber(item.resubmissionCount)],
          ['corrected Claim Indicator', formatBoolean(item.correctedClaimIndicator)],
          ['batch ID', item.batchId ?? '-'],
          ['clearing House', item.clearingHouse ?? '-'],
          ['edi Status', item.ediStatus ?? '-'],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">claim Lines</h3>
        {renderSection([
          ['Items', item.claimLines.length ? item.claimLines.map((line, index) => [
            `${index + 1}.`,
            `CPT ${line.cptCode ?? '-'}`,
            `POS ${line.placeOfService ?? '-'}`,
            `Billed ${formatNumber(line.chargeAmount)}`,
            `Allowed ${formatNumber(line.expectedAllowedAmount)}`,
            `Patient ${formatNumber(line.expectedPatientResponsibility)}`,
            `Insurance ${formatNumber(line.expectedInsurancePayment)}`,
            line.feeScheduleId ? `Fee ${line.feeScheduleId}` : 'Missing fee',
            line.pricingMatchedBy ?? '-',
            line.eligibilityVerificationId ? 'Eligibility attached' : 'Eligibility missing',
            line.authorizationRequired ? 'Auth required' : 'Auth not required',
            line.referralRequired ? 'Referral required' : 'Referral not required',
          ].filter(Boolean).join(' | ')).join('\n') : '-'],
        ])}
      </section>
    </div>
  )
}

export function renderClaimGridItem(item: Claim, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getClaimRowLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">patient ID</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">claim Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.claimStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
