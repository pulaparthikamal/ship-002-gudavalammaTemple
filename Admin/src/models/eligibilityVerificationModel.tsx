import { z } from 'zod'
import { cptCodePattern, serviceTypeCodePattern, splitMultiValueText } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type {
  EligibilityVerification,
  EligibilityVerificationCreatePayload,
  EligibilityVerificationFormValues,
  EligibilityVerificationRunFormValues,
  EligibilityVerificationRunPayload,
} from '@/types/eligibilityVerification'

export const eligibilityVerificationApiDetails = {
  endpoint: '/rcm/eligibility-verifications',
  runEndpoint: '/rcm/eligibility-verifications/run',
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

export const manualEligibilityVerificationSourceValues = [
  'Manual',
  'Payer Portal',
  'Payer Phone',
  'IVR',
  'Clearinghouse',
] as const

const eligibilityStatusValues = [
  'Eligible',
  'Ineligible',
  'Pending',
  'Unable to Verify',
  'Completed',
] as const

const coverageStatusValues = [
  'Active',
  'Inactive',
  'Terminated',
  'Pending',
  'Not Covered',
  'Out of Network',
] as const

const coveragePriorityOptions = createSelectOptions([
  'Primary',
  'Secondary',
  'Tertiary',
  'Quaternary',
])
const inactiveCoverageStatuses = new Set(['Inactive', 'Terminated', 'Not Covered'])
const serviceTypeOptions = createSelectOptions([
  { label: '30 - Health Benefit Plan Coverage', value: '30' },
  { label: '1 - Medical Care', value: '1' },
  { label: '98 - Professional Physician Visit', value: '98' },
  { label: '86 - Emergency Services', value: '86' },
  { label: '47 - Hospital', value: '47' },
  { label: '33 - Chiropractic', value: '33' },
])
const eligibilityStatusOptions = createSelectOptions([...eligibilityStatusValues])
const coverageStatusOptions = createSelectOptions([...coverageStatusValues])
const verificationSourceOptions = createSelectOptions([...manualEligibilityVerificationSourceValues])

export const eligibilityVerificationFormSchema = z
  .object({
    _id: z.string().optional(),
    appointmentId: z.string().trim(),
    patientId: z.string().trim(),
    insuranceId: z.string().trim().min(1, 'Insurance policy is required'),
    payerId: z.string().trim(),
    serviceTypeCode: z
      .string()
      .trim()
      .min(1, 'Service type code is required')
      .refine((value) => !value || serviceTypeCodePattern.test(value), 'Service type code must be 1 to 3 alphanumeric characters'),
    serviceDate: z.date().nullable(),
    coveragePriority: z.string().trim(),
    eligibilityStatus: z.enum(eligibilityStatusValues),
    coverageStatus: z.enum(coverageStatusValues),
    planActive: z.boolean(),
    copayAmount: z.number().nullable(),
    coinsurancePercent: z.number().nullable(),
    deductibleRemaining: z.number().nullable(),
    outOfPocketRemaining: z.number().nullable(),
    referralRequired: z.boolean(),
    authorizationRequired: z.boolean(),
    benefitNotes: z.string().trim(),
    checkedBy: z.string().trim(),
    checkedAt: z.date().nullable(),
    verificationSource: z.enum(manualEligibilityVerificationSourceValues),
    rawResponseReference: z.string().trim(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.copayAmount !== null && value.copayAmount < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Copay amount cannot be negative.',
        path: ['copayAmount'],
      })
    }

    if (
      value.coinsurancePercent !== null &&
      (value.coinsurancePercent < 0 || value.coinsurancePercent > 100)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Coinsurance percent must be between 0 and 100.',
        path: ['coinsurancePercent'],
      })
    }

    if (value.deductibleRemaining !== null && value.deductibleRemaining < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Deductible remaining cannot be negative.',
        path: ['deductibleRemaining'],
      })
    }

    if (value.outOfPocketRemaining !== null && value.outOfPocketRemaining < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Out-of-pocket remaining cannot be negative.',
        path: ['outOfPocketRemaining'],
      })
    }

    if (value.coverageStatus === 'Active' && !value.planActive) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plan active must be enabled when coverage status is Active.',
        path: ['planActive'],
      })
    }

    if (inactiveCoverageStatuses.has(value.coverageStatus) && value.planActive) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Plan active cannot be enabled for inactive, terminated, or not-covered statuses.',
        path: ['coverageStatus'],
      })
    }

    if (value.eligibilityStatus === 'Eligible' && !value.planActive) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Eligible verifications must have an active plan.',
        path: ['eligibilityStatus'],
      })
    }

    if (value.eligibilityStatus === 'Ineligible' && value.planActive) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Ineligible verifications cannot have plan active enabled.',
        path: ['eligibilityStatus'],
      })
    }

    if (
      (!value.planActive ||
        value.referralRequired ||
        value.authorizationRequired ||
        value.eligibilityStatus === 'Pending' ||
        value.eligibilityStatus === 'Unable to Verify') &&
      !value.benefitNotes.trim()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Benefit notes are required for inactive, pending, unable-to-verify, referral, or authorization cases.',
        path: ['benefitNotes'],
      })
    }

    if (value.verificationSource !== 'Manual' && !value.rawResponseReference.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Reference number is required when the verification source is portal, phone, IVR, or clearinghouse.',
        path: ['rawResponseReference'],
      })
    }
  }) as z.ZodType<EligibilityVerificationFormValues>

export const eligibilityVerificationDefaultValues: EligibilityVerificationFormValues = {
  _id: '',
  appointmentId: '',
  patientId: '',
  insuranceId: '',
  payerId: '',
  serviceTypeCode: '30',
  serviceDate: null,
  coveragePriority: '',
  eligibilityStatus: 'Eligible',
  coverageStatus: 'Active',
  planActive: true,
  copayAmount: null,
  coinsurancePercent: null,
  deductibleRemaining: null,
  outOfPocketRemaining: null,
  referralRequired: false,
  authorizationRequired: false,
  benefitNotes: '',
  checkedBy: '',
  checkedAt: null,
  verificationSource: 'Manual',
  rawResponseReference: '',
  active: true,
}

export const eligibilityVerificationRunFormSchema = z
  .object({
    appointmentId: z.string().trim().optional().or(z.literal('')),
    providerId: z.string().trim().optional().or(z.literal('')),
    facilityId: z.string().trim().optional().or(z.literal('')),
    insuranceId: z.string().trim().min(1, 'Insurance policy is required'),
    serviceTypeCode: z
      .string()
      .trim()
      .min(1, 'Service type code is required')
      .refine((value) => !value || serviceTypeCodePattern.test(value), 'Service type code must be 1 to 3 alphanumeric characters'),
    serviceDate: z.date().nullable().optional(),
    coveragePriority: z.string().trim().optional().or(z.literal('')),
    procedureCodesText: z.string().trim(),
  })
  .superRefine((value, context) => {
    const invalidProcedureCodes = splitMultiValueText(value.procedureCodesText).filter(
      (code) => !cptCodePattern.test(code),
    )

    if (invalidProcedureCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid procedure code(s): ${invalidProcedureCodes.join(', ')}`,
        path: ['procedureCodesText'],
      })
    }
  }) as z.ZodType<EligibilityVerificationRunFormValues>

export const eligibilityVerificationRunDefaultValues: EligibilityVerificationRunFormValues = {
  appointmentId: '',
  providerId: '',
  facilityId: '',
  insuranceId: '',
  serviceTypeCode: '30',
  serviceDate: null,
  coveragePriority: '',
  procedureCodesText: '',
}

export function createEligibilityVerificationFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<EligibilityVerificationFormValues> {
  return {
    schema: eligibilityVerificationFormSchema,
    defaultValues: eligibilityVerificationDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'appointmentId',
        label: 'Appointment',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Select appointment',
        options: referenceOptions.appointments ?? [],
        helperText: 'Optional. Link the verification to a scheduled visit when you want downstream check-in or auth logic to use this record.',
      },
      {
        name: 'patientId',
        label: 'Patient',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'insuranceId',
        label: 'Insurance policy',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Select insurance policy',
        options: referenceOptions.insurancePolicies ?? [],
      },
      {
        name: 'payerId',
        label: 'Payer',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Select payer',
        options: referenceOptions.payers ?? [],
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'serviceTypeCode',
        label: 'Service type code',
        section: 'Verification Summary',
        type: 'select',
        placeholder: 'Select service type code',
        options: serviceTypeOptions,
      },
      {
        name: 'serviceDate',
        label: 'Service date',
        section: 'Verification Summary',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'coveragePriority',
        label: 'Coverage priority',
        section: 'Verification Summary',
        type: 'select',
        placeholder: 'Select coverage priority',
        options: coveragePriorityOptions,
      },
      {
        name: 'eligibilityStatus',
        label: 'Eligibility status',
        section: 'Verification Summary',
        type: 'select',
        placeholder: 'Select eligibility status',
        options: eligibilityStatusOptions,
      },
      {
        name: 'coverageStatus',
        label: 'Coverage status',
        section: 'Verification Summary',
        type: 'select',
        placeholder: 'Select coverage status',
        options: coverageStatusOptions,
      },
      {
        name: 'planActive',
        label: 'Plan active',
        section: 'Verification Summary',
        type: 'switch',
        switch: {
          checkedLabel: 'Active',
          uncheckedLabel: 'Inactive',
        },
      },
      {
        name: 'copayAmount',
        label: 'Copay amount',
        section: 'Financials',
        type: 'number',
      },
      {
        name: 'coinsurancePercent',
        label: 'Coinsurance percent',
        section: 'Financials',
        type: 'number',
      },
      {
        name: 'deductibleRemaining',
        label: 'Deductible remaining',
        section: 'Financials',
        type: 'number',
      },
      {
        name: 'outOfPocketRemaining',
        label: 'Out-of-pocket remaining',
        section: 'Financials',
        type: 'number',
      },
      {
        name: 'referralRequired',
        label: 'Referral required',
        section: 'Financials',
        type: 'switch',
      },
      {
        name: 'authorizationRequired',
        label: 'Authorization required',
        section: 'Financials',
        type: 'switch',
      },
      {
        name: 'benefitNotes',
        label: 'Benefit notes',
        section: 'Audit',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Required when coverage is inactive, pending, unable to verify, or when referral/prior auth is needed.',
      },
      {
        name: 'checkedBy',
        label: 'Checked by',
        section: 'Audit',
        type: 'hidden',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'checkedAt',
        label: 'Checked at',
        section: 'Audit',
        type: 'hidden',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'verificationSource',
        label: 'Verification source',
        section: 'Audit',
        type: 'select',
        placeholder: 'Select verification source',
        options: verificationSourceOptions,
      },
      {
        name: 'rawResponseReference',
        label: 'Reference / confirmation #',
        section: 'Audit',
        type: 'text',
        placeholder: 'Call ref, portal confirmation, or clearinghouse ID',
        helperText: 'Required for portal, phone, IVR, and clearinghouse verifications.',
      },
      {
        name: 'active',
        label: 'Active record',
        type: 'hidden',
      },
    ],
  }
}

export function createEligibilityVerificationRunFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<EligibilityVerificationRunFormValues> {
  return {
    schema: eligibilityVerificationRunFormSchema,
    defaultValues: eligibilityVerificationRunDefaultValues,
    columns: 2,
    fields: [
      {
        name: 'appointmentId',
        label: 'Appointment',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Select appointment',
        options: referenceOptions.appointments ?? [],
        helperText: "Optional. If left blank, it uses today\\'s date and backend defaults, but it will not create appointment-linked authorization context.",
      },
      {
        name: 'insuranceId',
        label: 'Insurance policy',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Select insurance policy',
        options: referenceOptions.insurancePolicies ?? [],
        helperText: 'Pick the policy that belongs to the appointment patient.',
      },
      {
        name: 'providerId',
        label: 'Rendering provider override',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Optional provider override',
        options: referenceOptions.providers ?? [],
        helperText: 'Optional. Use this when eligibility must be checked against a specific rendering provider.',
      },
      {
        name: 'facilityId',
        label: 'Facility override',
        section: 'Verification Context',
        type: 'autocomplete',
        placeholder: 'Optional facility override',
        options: referenceOptions.facilities ?? [],
        helperText: 'Optional. Use this when payer benefits depend on the servicing facility or POS setup.',
      },
      {
        name: 'serviceTypeCode',
        label: 'Service type code',
        section: 'Request Overrides',
        type: 'select',
        placeholder: 'Select service type code',
        options: serviceTypeOptions,
        helperText: 'Defaults to 30 - Health Benefit Plan Coverage.',
      },
      {
        name: 'serviceDate',
        label: 'Service date',
        section: 'Request Overrides',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'coveragePriority',
        label: 'Coverage priority',
        section: 'Request Overrides',
        type: 'select',
        placeholder: 'Optional coverage priority',
        options: coveragePriorityOptions,
      },
      {
        name: 'procedureCodesText',
        label: 'Procedure codes',
        section: 'Request Overrides',
        type: 'textarea',
        rows: 4,
        placeholder: '99213, 93000',
        helperText: 'Optional. Enter comma-separated or one per line. Blank uses backend config defaults.',
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

export function mapEligibilityVerificationToFormValues(item: EligibilityVerification): EligibilityVerificationFormValues {
  return {
    _id: item._id,
    appointmentId: item.appointmentId ?? '',
    patientId: item.patientId ?? '',
    insuranceId: item.insuranceId ?? '',
    payerId: item.payerId ?? '',
    serviceTypeCode: item.serviceTypeCode ?? '',
    serviceDate: toFormDate(item.serviceDate),
    coveragePriority: item.coveragePriority ?? '',
    eligibilityStatus: item.eligibilityStatus ?? '',
    coverageStatus: item.coverageStatus ?? '',
    planActive: item.planActive,
    copayAmount: item.copayAmount ?? null,
    coinsurancePercent: item.coinsurancePercent ?? null,
    deductibleRemaining: item.deductibleRemaining ?? null,
    outOfPocketRemaining: item.outOfPocketRemaining ?? null,
    referralRequired: item.referralRequired,
    authorizationRequired: item.authorizationRequired,
    benefitNotes: item.benefitNotes ?? '',
    checkedBy: item.checkedBy ?? '',
    checkedAt: toFormDate(item.checkedAt),
    verificationSource: item.verificationSource ?? '',
    rawResponseReference: item.rawResponseReference ?? '',
    active: item.active,
  }
}

export function mapEligibilityVerificationFormToPayload(values: EligibilityVerificationFormValues): EligibilityVerificationCreatePayload {
  return {
    appointmentId: optionalText(values.appointmentId),
    insuranceId: optionalText(values.insuranceId),
    serviceTypeCode: optionalText(values.serviceTypeCode),
    serviceDate: values.serviceDate ?? undefined,
    coveragePriority: optionalText(values.coveragePriority ?? ''),
    eligibilityStatus: optionalText(values.eligibilityStatus),
    coverageStatus: optionalText(values.coverageStatus),
    planActive: values.planActive,
    copayAmount: optionalNumber(values.copayAmount),
    coinsurancePercent: optionalNumber(values.coinsurancePercent),
    deductibleRemaining: optionalNumber(values.deductibleRemaining),
    outOfPocketRemaining: optionalNumber(values.outOfPocketRemaining),
    referralRequired: values.referralRequired,
    authorizationRequired: values.authorizationRequired,
    benefitNotes: optionalText(values.benefitNotes),
    verificationSource: optionalText(values.verificationSource),
    rawResponseReference: optionalText(values.rawResponseReference),
    active: values.active,
  }
}

export function mapEligibilityVerificationRunFormToPayload(
  values: EligibilityVerificationRunFormValues,
): EligibilityVerificationRunPayload {
  return {
    appointmentId: values.appointmentId?.trim() || undefined,
    providerId: values.providerId?.trim() || undefined,
    facilityId: values.facilityId?.trim() || undefined,
    insuranceId: values.insuranceId.trim(),
    serviceTypeCode: optionalText(values.serviceTypeCode),
    serviceDate: values.serviceDate ?? undefined,
    coveragePriority: optionalText(values.coveragePriority ?? ''),
    procedureCodes: parseStringList(values.procedureCodesText),
  }
}

function getEligibilityVerificationLabel(item: EligibilityVerification, referenceOptions: RcmReferenceOptions = {}) {
  const patientLabel = formatReferenceLabel(referenceOptions.patients, item.patientId)
  const statusLabel = [item.eligibilityStatus, item.coverageStatus].filter((value) => value && value !== '-').join(' / ')
  const dateLabel = formatDate(item.serviceDate ?? item.checkedAt)

  return [statusLabel || item._id, patientLabel !== '-' ? patientLabel : undefined, dateLabel !== '-' ? dateLabel : undefined]
    .filter(Boolean)
    .join(' • ')
}

export function createEligibilityVerificationTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<EligibilityVerification>> {
  return [
    {
      key: 'record',
      header: 'Eligibility Verification',
      sortField: 'eligibilityStatus',
      exportValue: (item) => getEligibilityVerificationLabel(item, referenceOptions),
      render: (item) => getEligibilityVerificationLabel(item, referenceOptions),
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
      key: 'appointmentId',
      header: 'Appointment',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.appointments, item.appointmentId),
      render: (item) => formatReferenceLabel(referenceOptions.appointments, item.appointmentId),
    },
    {
      key: 'eligibilityStatus',
      header: 'Eligibility status',
      filterable: true,
      field: 'eligibilityStatus',
      sortField: 'eligibilityStatus',
      exportValue: (item) => item.eligibilityStatus ?? '-',
      render: (item) => item.eligibilityStatus ?? '-',
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

function formatJsonPayload(value?: Record<string, unknown>) {
  if (!value || typeof value !== 'object') {
    return '-'
  }

  try {
    return JSON.stringify(value, null, 2)
  } catch (error) {
    return '-'
  }
}

function renderJsonPreview(title: string, payload?: Record<string, unknown>) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  return (
    <section className="space-y-3">
      <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">{title}</h3>
      <pre className="max-h-80 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-xs leading-5 text-[var(--color-text-strong)]">
        {formatJsonPayload(payload)}
      </pre>
    </section>
  )
}

export function renderEligibilityVerificationDetails(item: EligibilityVerification, referenceOptions: RcmReferenceOptions = {}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Eligibility Verification</h3>
        {renderSection([
          ['eligibility ID', item.eligibilityId],
          ['appointment', formatReferenceLabel(referenceOptions.appointments, item.appointmentId)],
          ['patient', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['insurance policy', formatReferenceLabel(referenceOptions.insurancePolicies, item.insuranceId)],
          ['payer', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['service type code', item.serviceTypeCode ?? '-'],
          ['service date', formatDate(item.serviceDate)],
          ['coverage priority', item.coveragePriority ?? '-'],
          ['procedure codes', item.procedureCodes?.join(', ') ?? '-'],
          ['eligibility status', item.eligibilityStatus ?? '-'],
          ['coverage status', item.coverageStatus ?? '-'],
          ['plan active', formatBoolean(item.planActive)],
          ['copay amount', formatNumber(item.copayAmount)],
          ['coinsurance percent', formatNumber(item.coinsurancePercent)],
          ['deductible remaining', formatNumber(item.deductibleRemaining)],
          ['out of pocket remaining', formatNumber(item.outOfPocketRemaining)],
          ['referral required', formatBoolean(item.referralRequired)],
          ['authorization required', formatBoolean(item.authorizationRequired)],
          ['benefit notes', item.benefitNotes ?? '-'],
          ['checked by', item.checkedBy ?? '-'],
          ['checked at', formatDate(item.checkedAt)],
          ['verification source', item.verificationSource ?? '-'],
          ['vendor', item.vendorName ?? '-'],
          ['correlation ID', item.correlationId ?? '-'],
          ['external verification ID', item.externalVerificationId ?? '-'],
          ['response reference', item.rawResponseReference ?? '-'],
          ['response status code', formatNumber(item.responseStatusCode)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      {renderJsonPreview('Request Payload', item.rawRequestPayload)}
      {renderJsonPreview('Response Payload', item.rawResponsePayload)}
    </div>
  )
}

export function renderEligibilityVerificationGridItem(item: EligibilityVerification, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getEligibilityVerificationLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">patient ID</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">eligibility Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.eligibilityStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
