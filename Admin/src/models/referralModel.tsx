import { z } from 'zod'
import { cptCodePattern, icd10CodePattern, splitMultiValueText } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Referral, ReferralCreatePayload, ReferralFormValues } from '@/types/referral'

export const referralApiDetails = {
  endpoint: '/rcm/referrals',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const referralTypeOptions = [
  'Specialist',
  'Procedure',
  'Therapy',
  'Diagnostic',
  'Second Opinion',
]

const referralStatusOptions = [
  'Pending',
  'Approved',
  'Active',
  'Denied',
  'Expired',
  'Closed',
  'Cancelled',
]

export const referralFormSchema = z
  .object({
    _id: z.string().optional(),
    patientId: z.string().trim().min(1, 'Patient is required'),
    appointmentId: z.string().trim(),
    insuranceId: z.string().trim(),
    facilityId: z.string().trim(),
    referringProviderId: z.string().trim(),
    referredToProviderId: z.string().trim(),
    payerId: z.string().trim().min(1, 'Payer is required'),
    referralNumber: z.string().trim(),
    referralType: z.string().trim().min(1, 'Referral type is required'),
    diagnosisCodes: z.string().trim(),
    procedureCodes: z.string().trim(),
    startDate: z.date().nullable(),
    endDate: z.date().nullable(),
    referralStatus: z.string().trim().min(1, 'Referral status is required'),
    approvedVisits: z.number().nullable(),
    usedVisits: z.number().nullable(),
    remainingVisits: z.number().nullable(),
    notes: z.string().trim(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    const invalidDiagnosisCodes = splitMultiValueText(value.diagnosisCodes).filter((code) => !icd10CodePattern.test(code))
    const invalidProcedureCodes = splitMultiValueText(value.procedureCodes).filter((code) => !cptCodePattern.test(code))

    if (!value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Start date is required.',
        path: ['startDate'],
      })
    }

    if (value.startDate && value.endDate && value.endDate < value.startDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'End date cannot be earlier than the start date.',
        path: ['endDate'],
      })
    }

    if (['Approved', 'Active'].includes(value.referralStatus) && !value.referralNumber.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Referral number is required for approved or active referrals.',
        path: ['referralNumber'],
      })
    }

    if (invalidDiagnosisCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid diagnosis code(s): ${invalidDiagnosisCodes.join(', ')}`,
        path: ['diagnosisCodes'],
      })
    }

    if (invalidProcedureCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid procedure code(s): ${invalidProcedureCodes.join(', ')}`,
        path: ['procedureCodes'],
      })
    }

    if (value.approvedVisits !== null && value.approvedVisits < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Approved visits cannot be negative.',
        path: ['approvedVisits'],
      })
    }

    if (value.usedVisits !== null && value.usedVisits < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Used visits cannot be negative.',
        path: ['usedVisits'],
      })
    }

    if (value.remainingVisits !== null && value.remainingVisits < 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Remaining visits cannot be negative.',
        path: ['remainingVisits'],
      })
    }

    if (
      value.approvedVisits !== null &&
      value.usedVisits !== null &&
      value.usedVisits > value.approvedVisits
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Used visits cannot exceed approved visits.',
        path: ['usedVisits'],
      })
    }

    if (
      value.approvedVisits !== null &&
      value.usedVisits !== null &&
      value.remainingVisits !== null &&
      value.remainingVisits !== value.approvedVisits - value.usedVisits
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Remaining visits must equal approved visits minus used visits.',
        path: ['remainingVisits'],
      })
    }
  }) as z.ZodType<ReferralFormValues>

export const referralDefaultValues: ReferralFormValues = {
  _id: '',
  patientId: '',
  appointmentId: '',
  insuranceId: '',
  facilityId: '',
  referringProviderId: '',
  referredToProviderId: '',
  payerId: '',
  referralNumber: '',
  referralType: '',
  diagnosisCodes: '',
  procedureCodes: '',
  startDate: null,
  endDate: null,
  referralStatus: '',
  approvedVisits: null,
  usedVisits: null,
  remainingVisits: null,
  notes: '',
  active: true,
}

export function createReferralFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ReferralFormValues> {
  void referenceOptions
  return {
    schema: referralFormSchema,
    defaultValues: referralDefaultValues,
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
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
      },
      {
        name: 'appointmentId',
        label: 'Appointment',
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select appointment',
        options: referenceOptions.appointments ?? [],
      },
      {
        name: 'insuranceId',
        label: 'Insurance policy',
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select insurance policy',
        options: referenceOptions.insurancePolicies ?? [],
      },
      {
        name: 'facilityId',
        label: 'Facility',
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select facility',
        options: referenceOptions.facilities ?? [],
      },
      {
        name: 'referringProviderId',
        label: 'Referring provider',
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select referring provider',
        options: referenceOptions.providers ?? [],
      },
      {
        name: 'referredToProviderId',
        label: 'Referred-to provider',
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select receiving provider',
        options: referenceOptions.providers ?? [],
      },
      {
        name: 'payerId',
        label: 'Payer',
        section: 'Referral',
        type: 'autocomplete',
        placeholder: 'Select payer',
        options: referenceOptions.payers ?? [],
      },
      {
        name: 'referralNumber',
        label: 'Referral number',
        section: 'Referral',
        type: 'text',
        placeholder: 'Referral number',
      },
      {
        name: 'referralType',
        label: 'Referral type',
        section: 'Referral',
        type: 'select',
        placeholder: 'Select referral type',
        options: referralTypeOptions.map((value) => ({ label: value, value })),
      },
      {
        name: 'startDate',
        label: 'Start date',
        section: 'Referral',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'endDate',
        label: 'End date',
        section: 'Referral',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'referralStatus',
        label: 'Referral status',
        section: 'Referral',
        type: 'select',
        placeholder: 'Select referral status',
        options: referralStatusOptions.map((value) => ({ label: value, value })),
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
        name: 'procedureCodes',
        label: 'Procedure codes',
        section: 'Clinical',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
      },
      {
        name: 'approvedVisits',
        label: 'Approved visits',
        section: 'Visit Limits',
        type: 'number',
      },
      {
        name: 'usedVisits',
        label: 'Used visits',
        section: 'Visit Limits',
        type: 'number',
      },
      {
        name: 'remainingVisits',
        label: 'Remaining visits',
        section: 'Visit Limits',
        type: 'number',
      },
      {
        name: 'notes',
        label: 'Notes',
        section: 'Visit Limits',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
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

export function mapReferralToFormValues(item: Referral): ReferralFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    appointmentId: item.appointmentId ?? '',
    insuranceId: item.insuranceId ?? '',
    facilityId: item.facilityId ?? '',
    referringProviderId: item.referringProviderId ?? '',
    referredToProviderId: item.referredToProviderId ?? '',
    payerId: item.payerId ?? '',
    referralNumber: item.referralNumber ?? '',
    referralType: item.referralType ?? '',
    diagnosisCodes: formatStringList(item.diagnosisCodes),
    procedureCodes: formatStringList(item.procedureCodes),
    startDate: toFormDate(item.startDate),
    endDate: toFormDate(item.endDate),
    referralStatus: item.referralStatus ?? '',
    approvedVisits: item.approvedVisits ?? null,
    usedVisits: item.usedVisits ?? null,
    remainingVisits: item.remainingVisits ?? null,
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapReferralFormToPayload(values: ReferralFormValues): ReferralCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    appointmentId: optionalText(values.appointmentId),
    insuranceId: optionalText(values.insuranceId),
    facilityId: optionalText(values.facilityId),
    referringProviderId: optionalText(values.referringProviderId),
    referredToProviderId: optionalText(values.referredToProviderId),
    payerId: optionalText(values.payerId),
    referralNumber: optionalText(values.referralNumber),
    referralType: optionalText(values.referralType),
    diagnosisCodes: parseStringList(values.diagnosisCodes),
    procedureCodes: parseStringList(values.procedureCodes),
    startDate: optionalDate(values.startDate),
    endDate: optionalDate(values.endDate),
    referralStatus: optionalText(values.referralStatus),
    approvedVisits: optionalNumber(values.approvedVisits),
    usedVisits: optionalNumber(values.usedVisits),
    remainingVisits: optionalNumber(values.remainingVisits),
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getReferralLabel(item: Referral, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.referralNumber, item.referralStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createReferralTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Referral>> {
  return [
    {
      key: 'record',
      header: 'Referral',
      sortField: 'referralNumber',
      exportValue: (item) => getReferralLabel(item, referenceOptions),
      render: (item) => getReferralLabel(item, referenceOptions),
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
      key: 'referralStatus',
      header: 'referral Status',
      filterable: true,
      field: 'referralStatus',
      sortField: 'referralStatus',
      exportValue: (item) => item.referralStatus ?? '-',
      render: (item) => item.referralStatus ?? '-',
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

export function renderReferralDetails(item: Referral, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Referral</h3>
        {renderSection([
          ['referral ID', item.referralId],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['appointment ID', formatReferenceLabel(referenceOptions.appointments, item.appointmentId)],
          ['insurance policy', formatReferenceLabel(referenceOptions.insurancePolicies, item.insuranceId)],
          ['facility ID', formatReferenceLabel(referenceOptions.facilities, item.facilityId)],
          ['referring Provider ID', formatReferenceLabel(referenceOptions.providers, item.referringProviderId)],
          ['referred To Provider ID', formatReferenceLabel(referenceOptions.providers, item.referredToProviderId)],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['referral Number', item.referralNumber ?? '-'],
          ['referral Type', item.referralType ?? '-'],
          ['diagnosis Codes', (item.diagnosisCodes ?? []).join(', ') || '-'],
          ['procedure Codes', (item.procedureCodes ?? []).join(', ') || '-'],
          ['start Date', formatDate(item.startDate)],
          ['end Date', formatDate(item.endDate)],
          ['referral Status', item.referralStatus ?? '-'],
          ['approved Visits', formatNumber(item.approvedVisits)],
          ['used Visits', formatNumber(item.usedVisits)],
          ['remaining Visits', formatNumber(item.remainingVisits)],
          ['notes', item.notes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderReferralGridItem(item: Referral, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getReferralLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">patient ID</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">referral Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.referralStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
