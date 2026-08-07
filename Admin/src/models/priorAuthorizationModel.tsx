import { z } from 'zod'
import { cptCodePattern, icd10CodePattern, placeOfServicePattern, splitMultiValueText } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { PriorAuthorization, PriorAuthorizationCreatePayload, PriorAuthorizationFormValues } from '@/types/priorAuthorization'

export const priorAuthorizationApiDetails = {
  endpoint: '/rcm/prior-authorizations',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const authorizationTypeOptions = [
  'Pre-Service',
  'Concurrent',
  'Retro',
  'Specialty Drug',
]

const authorizationStatusOptions = [
  'Pending',
  'Submitted',
  'In Review',
  'Approved',
  'Denied',
  'Expired',
  'Cancelled',
]

const placeOfServiceOptions: CrudSelectOption[] = [
  { label: '11 - Office', value: '11' },
  { label: '19 - Off Campus Outpatient Hospital', value: '19' },
  { label: '22 - On Campus Outpatient Hospital', value: '22' },
  { label: '24 - Ambulatory Surgical Center', value: '24' },
  { label: '49 - Independent Clinic', value: '49' },
  { label: '02 - Telehealth Other than Home', value: '02' },
  { label: '10 - Telehealth in Patient Home', value: '10' },
]

export const priorAuthorizationFormSchema = z
  .object({
    _id: z.string().optional(),
    patientId: z.string().trim().min(1, 'Patient is required'),
    insuranceId: z.string().trim().min(1, 'Insurance policy is required'),
    payerId: z.string().trim().min(1, 'Payer is required'),
    providerId: z.string().trim().min(1, 'Provider is required'),
    facilityId: z.string().trim().min(1, 'Facility is required'),
    serviceDate: z.date().nullable(),
    placeOfService: z
      .string()
      .trim()
      .refine((value) => !value || placeOfServicePattern.test(value), 'Place of service must be a 2-digit code'),
    procedureCodes: z.string().trim(),
    diagnosisCodes: z.string().trim(),
    modifiers: z.string().trim(),
    authorizationRequired: z.boolean(),
    authorizationType: z.string().trim(),
    requestDate: z.date().nullable(),
    requestedUnits: z.number().nullable(),
    approvedUnits: z.number().nullable(),
    authNumber: z.string().trim(),
    authorizationStatus: z.string().trim(),
    expirationDate: z.date().nullable(),
    denialReason: z.string().trim(),
    notes: z.string().trim(),
    statusHistory: z.string().trim(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    const invalidProcedureCodes = splitMultiValueText(value.procedureCodes).filter((code) => !cptCodePattern.test(code))
    const invalidDiagnosisCodes = splitMultiValueText(value.diagnosisCodes).filter((code) => !icd10CodePattern.test(code))

    if (invalidProcedureCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid procedure code(s): ${invalidProcedureCodes.join(', ')}`,
        path: ['procedureCodes'],
      })
    }

    if (invalidDiagnosisCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid diagnosis code(s): ${invalidDiagnosisCodes.join(', ')}`,
        path: ['diagnosisCodes'],
      })
    }

    if (value.authorizationRequired && !value.serviceDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Service date is required when authorization is needed.',
        path: ['serviceDate'],
      })
    }

    if (value.authorizationRequired && !value.requestDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Request date is required when authorization is needed.',
        path: ['requestDate'],
      })
    }

    if (value.authorizationRequired && !value.placeOfService.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Place of service is required when authorization is needed.',
        path: ['placeOfService'],
      })
    }

    if (value.authorizationRequired && !splitMultiValueText(value.procedureCodes).length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one procedure code is required when authorization is needed.',
        path: ['procedureCodes'],
      })
    }

    if (value.authorizationRequired && !splitMultiValueText(value.diagnosisCodes).length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one diagnosis code is required when authorization is needed.',
        path: ['diagnosisCodes'],
      })
    }

    if (value.authorizationRequired && (value.requestedUnits === null || value.requestedUnits <= 0)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Requested units must be greater than zero when authorization is needed.',
        path: ['requestedUnits'],
      })
    }

    if (value.authorizationRequired && !value.authorizationType.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Authorization type is required when authorization is needed.',
        path: ['authorizationType'],
      })
    }

    if (value.authorizationRequired && !value.authorizationStatus.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Authorization status is required when authorization is needed.',
        path: ['authorizationStatus'],
      })
    }

    if (value.requestedUnits !== null && value.requestedUnits < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Requested units cannot be negative.',
        path: ['requestedUnits'],
      })
    }

    if (value.approvedUnits !== null && value.approvedUnits < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Approved units cannot be negative.',
        path: ['approvedUnits'],
      })
    }

    if (
      value.requestedUnits !== null &&
      value.approvedUnits !== null &&
      value.approvedUnits > value.requestedUnits
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Approved units cannot exceed requested units.',
        path: ['approvedUnits'],
      })
    }

    if (value.authorizationStatus === 'Approved' && !value.authNumber.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Authorization number is required for approved authorizations.',
        path: ['authNumber'],
      })
    }

    if (value.authorizationStatus === 'Denied' && !value.denialReason.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Denial reason is required when authorization is denied.',
        path: ['denialReason'],
      })
    }

    if (value.requestDate && value.expirationDate && value.expirationDate < value.requestDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Expiration date cannot be earlier than the request date.',
        path: ['expirationDate'],
      })
    }
  }) as z.ZodType<PriorAuthorizationFormValues>

export const priorAuthorizationDefaultValues: PriorAuthorizationFormValues = {
  _id: '',
  patientId: '',
  insuranceId: '',
  payerId: '',
  providerId: '',
  facilityId: '',
  serviceDate: null,
  placeOfService: '',
  procedureCodes: '',
  diagnosisCodes: '',
  modifiers: '',
  authorizationRequired: true,
  authorizationType: 'Pre-Service',
  requestDate: new Date(),
  requestedUnits: null,
  approvedUnits: null,
  authNumber: '',
  authorizationStatus: 'Pending',
  expirationDate: null,
  denialReason: '',
  notes: '',
  statusHistory: '',
  active: true,
}

export function createPriorAuthorizationFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<PriorAuthorizationFormValues> {
  void referenceOptions
  return {
    schema: priorAuthorizationFormSchema,
    defaultValues: priorAuthorizationDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'patientId',
        label: 'Patient',
        section: 'Authorization Request',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
      },
      {
        name: 'insuranceId',
        label: 'Insurance policy',
        section: 'Authorization Request',
        type: 'autocomplete',
        placeholder: 'Select insurance policy',
        options: referenceOptions.insurancePolicies ?? [],
      },
      {
        name: 'payerId',
        label: 'Payer',
        section: 'Authorization Request',
        type: 'autocomplete',
        placeholder: 'Select payer',
        options: referenceOptions.payers ?? [],
      },
      {
        name: 'providerId',
        label: 'Provider',
        section: 'Authorization Request',
        type: 'autocomplete',
        placeholder: 'Select provider',
        options: referenceOptions.providers ?? [],
      },
      {
        name: 'facilityId',
        label: 'Facility',
        section: 'Authorization Request',
        type: 'autocomplete',
        placeholder: 'Select facility',
        options: referenceOptions.facilities ?? [],
      },
      {
        name: 'serviceDate',
        label: 'Service date',
        section: 'Authorization Request',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'placeOfService',
        label: 'Place of service',
        section: 'Authorization Request',
        type: 'select',
        placeholder: 'Select POS',
        options: placeOfServiceOptions,
      },
      {
        name: 'authorizationRequired',
        label: 'Authorization required',
        section: 'Authorization Request',
        type: 'switch',
        helperText: 'Usually prefilled by eligibility/CPT-payer rules. Keep enabled when a manual auth request is needed.',
      },
      {
        name: 'authorizationType',
        label: 'Authorization type',
        section: 'Authorization Request',
        type: 'select',
        placeholder: 'Select authorization type',
        options: authorizationTypeOptions.map((value) => ({ label: value, value })),
      },
      {
        name: 'requestDate',
        label: 'Request date',
        section: 'Authorization Request',
        type: 'date',
        helperText: 'Defaults to today for a new auth request.',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'procedureCodes',
        label: 'Procedure codes',
        section: 'Clinical',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
      },
      {
        name: 'diagnosisCodes',
        label: 'Diagnosis codes',
        section: 'Clinical',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
      },
      {
        name: 'modifiers',
        label: 'Modifiers',
        section: 'Clinical',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
      },
      {
        name: 'requestedUnits',
        label: 'Requested units',
        section: 'Clinical',
        type: 'number',
        min: 1,
      },
      {
        name: 'approvedUnits',
        label: 'Approved units',
        section: 'Payer Decision',
        type: 'number',
        min: 0,
        hideOnAddForm: true,
      },
      {
        name: 'authNumber',
        label: 'Authorization number',
        section: 'Payer Decision',
        type: 'text',
        placeholder: 'Authorization number',
        hideOnAddForm: true,
      },
      {
        name: 'authorizationStatus',
        label: 'Authorization status',
        section: 'Payer Decision',
        type: 'select',
        placeholder: 'Select authorization status',
        options: authorizationStatusOptions.map((value) => ({ label: value, value })),
        hideOnAddForm: true,
      },
      {
        name: 'expirationDate',
        label: 'Expiration date',
        section: 'Payer Decision',
        type: 'date',
        hideOnAddForm: true,
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'denialReason',
        label: 'Denial reason',
        section: 'Payer Decision',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        hideOnAddForm: true,
      },
      {
        name: 'notes',
        label: 'Notes',
        section: 'Clinical',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        placeholder: 'Clinical notes, medical necessity details, or payer-specific instructions',
      },
      {
        name: 'statusHistory',
        label: 'Status history',
        section: 'Payer Decision',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
        hideOnAddForm: true,
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

export function mapPriorAuthorizationToFormValues(item: PriorAuthorization): PriorAuthorizationFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    insuranceId: item.insuranceId ?? '',
    payerId: item.payerId ?? '',
    providerId: item.providerId ?? '',
    facilityId: item.facilityId ?? '',
    serviceDate: toFormDate(item.serviceDate),
    placeOfService: item.placeOfService ?? '',
    procedureCodes: formatStringList(item.procedureCodes),
    diagnosisCodes: formatStringList(item.diagnosisCodes),
    modifiers: formatStringList(item.modifiers),
    authorizationRequired: item.authorizationRequired,
    authorizationType: item.authorizationType ?? '',
    requestDate: toFormDate(item.requestDate),
    requestedUnits: item.requestedUnits ?? null,
    approvedUnits: item.approvedUnits ?? null,
    authNumber: item.authNumber ?? '',
    authorizationStatus: item.authorizationStatus ?? '',
    expirationDate: toFormDate(item.expirationDate),
    denialReason: item.denialReason ?? '',
    notes: item.notes ?? '',
    statusHistory: formatStringList(item.statusHistory),
    active: item.active,
  }
}

export function mapPriorAuthorizationFormToPayload(values: PriorAuthorizationFormValues): PriorAuthorizationCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    insuranceId: optionalText(values.insuranceId),
    payerId: optionalText(values.payerId),
    providerId: optionalText(values.providerId),
    facilityId: optionalText(values.facilityId),
    serviceDate: optionalDate(values.serviceDate),
    placeOfService: optionalText(values.placeOfService),
    procedureCodes: parseStringList(values.procedureCodes),
    diagnosisCodes: parseStringList(values.diagnosisCodes),
    modifiers: parseStringList(values.modifiers),
    authorizationRequired: values.authorizationRequired,
    authorizationType: optionalText(values.authorizationType),
    requestDate: optionalDate(values.requestDate),
    requestedUnits: optionalNumber(values.requestedUnits),
    approvedUnits: optionalNumber(values.approvedUnits),
    authNumber: optionalText(values.authNumber),
    authorizationStatus: optionalText(values.authorizationStatus),
    expirationDate: optionalDate(values.expirationDate),
    denialReason: optionalText(values.denialReason),
    notes: optionalText(values.notes),
    statusHistory: parseStringList(values.statusHistory),
    active: values.active,
  }
}

function getPriorAuthorizationLabel(item: PriorAuthorization, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.authNumber, item.authorizationStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createPriorAuthorizationTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<PriorAuthorization>> {
  return [
    {
      key: 'record',
      header: 'Prior Authorization',
      sortField: 'authNumber',
      exportValue: (item) => getPriorAuthorizationLabel(item, referenceOptions),
      render: (item) => getPriorAuthorizationLabel(item, referenceOptions),
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
      key: 'authorizationStatus',
      header: 'authorization Status',
      filterable: true,
      field: 'authorizationStatus',
      sortField: 'authorizationStatus',
      exportValue: (item) => item.authorizationStatus ?? '-',
      render: (item) => item.authorizationStatus ?? '-',
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

export function renderPriorAuthorizationDetails(item: PriorAuthorization, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Prior Authorization</h3>
        {renderSection([
          ['authorization ID', item.authorizationId],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['insurance ID', formatReferenceLabel(referenceOptions.insurancePolicies, item.insuranceId)],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['provider ID', formatReferenceLabel(referenceOptions.providers, item.providerId)],
          ['facility ID', formatReferenceLabel(referenceOptions.facilities, item.facilityId)],
          ['service Date', formatDate(item.serviceDate)],
          ['place Of Service', item.placeOfService ?? '-'],
          ['procedure Codes', (item.procedureCodes ?? []).join(', ') || '-'],
          ['diagnosis Codes', (item.diagnosisCodes ?? []).join(', ') || '-'],
          ['modifiers', (item.modifiers ?? []).join(', ') || '-'],
          ['authorization Required', formatBoolean(item.authorizationRequired)],
          ['authorization Type', item.authorizationType ?? '-'],
          ['request Date', formatDate(item.requestDate)],
          ['requested Units', formatNumber(item.requestedUnits)],
          ['approved Units', formatNumber(item.approvedUnits)],
          ['auth Number', item.authNumber ?? '-'],
          ['authorization Status', item.authorizationStatus ?? '-'],
          ['expiration Date', formatDate(item.expirationDate)],
          ['denial Reason', item.denialReason ?? '-'],
          ['notes', item.notes ?? '-'],
          ['status History', (item.statusHistory ?? []).join(', ') || '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderPriorAuthorizationGridItem(item: PriorAuthorization, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getPriorAuthorizationLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">patient ID</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">authorization Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.authorizationStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
