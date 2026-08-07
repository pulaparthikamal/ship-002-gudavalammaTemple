import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Appointment, AppointmentCreatePayload, AppointmentFormValues, AppointmentReferral, AppointmentEstimate, AppointmentEstimateFormValues, AppointmentReferralFormValues } from '@/types/appointment'

export const appointmentApiDetails = {
  endpoint: '/rcm/appointments',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

function createSelectOptions(values: string[]): CrudSelectOption[] {
  return values.map((value) => ({
    label: value,
    value,
  }))
}

const appointmentTypeOptions = createSelectOptions([
  'New Patient',
  'Follow-Up',
  'Consultation',
  'Procedure',
  'Annual Wellness',
  'Telehealth',
])

const visitTypeOptions = createSelectOptions([
  'Office Visit',
  'Preventive Visit',
  'Specialist Visit',
  'Telehealth Visit',
  'Urgent Visit',
  'Procedure Visit',
])

const appointmentStatusOptions = createSelectOptions([
  'Scheduled',
  'Confirmed',
  'Cancelled',
  'No Show',
])

const checkInStatusOptions = createSelectOptions([
  'Pending',
  'Pre-Registered',
  'Arrived',
  'Checked In',
  'Checked Out',
])

const cancellationReasonOptions = createSelectOptions([
  'Patient Request',
  'Provider Unavailable',
  'Authorization Pending',
  'Insurance Eligibility Issue',
  'Scheduling Conflict',
  'Weather',
  'Other',
])

const canonicalAppointmentTimePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

function parseAppointmentTimeParts(value?: string | null) {
  if (!value) {
    return null
  }

  const trimmedValue = value.trim()
  const canonicalMatch = trimmedValue.match(canonicalAppointmentTimePattern)

  if (canonicalMatch) {
    return {
      hours: Number(canonicalMatch[1]),
      minutes: Number(canonicalMatch[2]),
    }
  }

  const meridiemMatch = trimmedValue.match(/^(\d{1,2}):(\d{2})\s*([APap][Mm])$/)

  if (!meridiemMatch) {
    return null
  }

  let hours = Number(meridiemMatch[1])
  const minutes = Number(meridiemMatch[2])
  const meridiem = meridiemMatch[3].toUpperCase()

  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || minutes < 0 || minutes > 59) {
    return null
  }

  if (hours < 1 || hours > 12) {
    return null
  }

  if (meridiem === 'AM') {
    hours = hours === 12 ? 0 : hours
  } else {
    hours = hours === 12 ? 12 : hours + 12
  }

  return {
    hours,
    minutes,
  }
}

function normalizeAppointmentTimeValue(value?: string | null) {
  const parts = parseAppointmentTimeParts(value)

  if (!parts) {
    return value?.trim() ?? ''
  }

  return `${String(parts.hours).padStart(2, '0')}:${String(parts.minutes).padStart(2, '0')}`
}

const appointmentReferralFormSchema = z.object({
  required: z.boolean(),
  referralNumber: z.string().trim(),
  validFrom: z.date().nullable(),
  validTo: z.date().nullable(),
})

const appointmentEstimateFormSchema = z.object({
  estimatedPatientResponsibility: z.number().nullable(),
  depositAmount: z.number().nullable(),
  depositCollected: z.boolean(),
})

export const appointmentFormSchema = z.object({
  _id: z.string().optional(),
  patientId: z.string().trim().min(1, 'Patient is required.'),
  providerId: z.string().trim().min(1, 'Provider is required.'),
  facilityId: z.string().trim().min(1, 'Facility is required.'),
  appointmentDate: z.date().nullable(),
  appointmentTime: z
    .string()
    .trim()
    .min(1, 'Appointment time is required.')
    .refine((value) => canonicalAppointmentTimePattern.test(value), 'Appointment time must use HH:mm.'),
  appointmentType: z.string().trim().min(1, 'Appointment type is required.'),
  visitType: z.string().trim().min(1, 'Visit type is required.'),
  reason: z.string().trim().min(1, 'Reason is required.'),
  appointmentStatus: z.string().trim().min(1, 'Appointment status is required.'),
  checkInStatus: z.string().trim().min(1, 'Check-in status is required.'),
  checkInTime: z.date().nullable(),
  checkOutTime: z.date().nullable(),
  noShowFlag: z.boolean(),
  cancellationReason: z.string().trim(),
  notes: z.string().trim(),
  referral: appointmentReferralFormSchema,
  estimate: appointmentEstimateFormSchema,
  active: z.boolean(),
}).superRefine((values, ctx) => {
  if (!values.appointmentDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentDate'],
      message: 'Appointment date is required.',
    })
  }

  if (values.appointmentStatus === 'Cancelled' && !values.cancellationReason.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cancellationReason'],
      message: 'Cancellation reason is required when the appointment is cancelled.',
    })
  }

  if (values.appointmentStatus === 'No Show' && !values.noShowFlag) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['noShowFlag'],
      message: 'No-show flag must be enabled when the appointment status is No Show.',
    })
  }

  if (values.noShowFlag && values.appointmentStatus !== 'No Show') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['appointmentStatus'],
      message: 'Appointment status must be No Show when the no-show flag is enabled.',
    })
  }

  if (['Checked In', 'In Progress', 'Checked Out'].includes(values.checkInStatus) && !values.checkInTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkInTime'],
      message: 'Check-in time is required once the patient has been checked in.',
    })
  }

  if (values.checkOutTime && !values.checkInTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkInTime'],
      message: 'Check-in time must be recorded before check-out time.',
    })
  }

  if (['Checked Out'].includes(values.checkInStatus) && !values.checkOutTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkOutTime'],
      message: 'Check-out time is required when the patient has been checked out.',
    })
  }

  if (values.appointmentStatus === 'Completed' && !values.checkOutTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkOutTime'],
      message: 'Completed appointments must include a check-out time.',
    })
  }

  if (values.referral.validFrom && values.referral.validTo && values.referral.validTo < values.referral.validFrom) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['referral', 'validTo'],
      message: 'Referral valid-to date cannot be earlier than the valid-from date.',
    })
  }

  if (values.appointmentStatus === 'Completed' && values.checkInStatus !== 'Checked Out') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkInStatus'],
      message: 'Completed appointments must be checked out.',
    })
  }

  if (values.estimate.estimatedPatientResponsibility !== null && values.estimate.estimatedPatientResponsibility < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimate', 'estimatedPatientResponsibility'],
      message: 'Estimated patient responsibility cannot be negative.',
    })
  }

  if (values.estimate.depositAmount !== null && values.estimate.depositAmount < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimate', 'depositAmount'],
      message: 'Deposit amount cannot be negative.',
    })
  }

  if (values.estimate.depositCollected && !values.estimate.depositAmount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimate', 'depositAmount'],
      message: 'Deposit amount is required when a deposit has been collected.',
    })
  }

  if (
    values.estimate.depositAmount !== null &&
    values.estimate.estimatedPatientResponsibility !== null &&
    values.estimate.depositAmount > values.estimate.estimatedPatientResponsibility
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['estimate', 'depositAmount'],
      message: 'Deposit amount should not exceed the estimated patient responsibility.',
    })
  }
}) as z.ZodType<AppointmentFormValues>

export const appointmentDefaultValues: AppointmentFormValues = {
  _id: '',
  patientId: '',
  providerId: '',
  facilityId: '',
  appointmentDate: null,
  appointmentTime: '',
  appointmentType: 'New Patient',
  visitType: 'Office Visit',
  reason: '',
  appointmentStatus: 'Scheduled',
  checkInStatus: 'Pending',
  checkInTime: null,
  checkOutTime: null,
  noShowFlag: false,
  cancellationReason: '',
  notes: '',
  referral: {
    required: false,
    referralNumber: '',
    validFrom: null,
    validTo: null,
  },
  estimate: {
    estimatedPatientResponsibility: null,
    depositAmount: null,
    depositCollected: false,
  },
  active: true,
}

export function createAppointmentFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<AppointmentFormValues> {
  void referenceOptions
  return {
    schema: appointmentFormSchema,
    defaultValues: appointmentDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'Suggested Data',
        type: 'info',
        fullWidth: true,
        hideOnEditForm: true,
        info: {
          description: 'Use the values below to quickly fill this form. Click the copy icon next to each item and paste into the corresponding field.',
          columns: 2,
          scenarios: [
            {
              label: '👤 Patient',
              text: 'JANE DOE (MRN2026123469)',
            },
            {
              label: '🩺 Provider',
              text: 'MEDICAL PROVIDER MD, FACP',
            },
            {
              label: '🏥 Facility',
              text: 'RCM Demo Dental Clinic',
            },
            {
              label: 'Appointment type',
              text: 'New Patient',
            },
            {
              label: 'Visit type',
              text: 'Office Visit',
            },
          ],
        },
      },
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'patientId',
        label: 'Patient',
        section: 'Scheduling',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'providerId',
        label: 'Provider',
        section: 'Scheduling',
        type: 'autocomplete',
        placeholder: 'Select provider',
        options: referenceOptions.providers ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'facilityId',
        label: 'Facility',
        section: 'Scheduling',
        type: 'autocomplete',
        placeholder: 'Select facility',
        options: referenceOptions.facilities ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'appointmentDate',
        label: 'Appointment date',
        section: 'Scheduling',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'appointmentTime',
        label: 'Appointment time',
        section: 'Scheduling',
        type: 'time',
        placeholder: 'Choose appointment time',
        time: {
          readOnlyInput: true,
          showButtonBar: true,
          showIcon: true,
          stepMinute: 15,
        },
      },
      {
        name: 'appointmentType',
        label: 'Appointment type',
        section: 'Scheduling',
        type: 'select',
        placeholder: 'Choose appointment type',
        options: appointmentTypeOptions,
      },
      {
        name: 'visitType',
        label: 'Visit type',
        section: 'Scheduling',
        type: 'select',
        placeholder: 'Choose visit type',
        options: visitTypeOptions,
      },
      {
        name: 'reason',
        label: 'Reason for visit',
        section: 'Scheduling',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Describe why the patient is being seen and any scheduling notes that affect front-desk or clinical prep.',
      },
      {
        name: 'appointmentStatus',
        label: 'Appointment status',
        section: 'Workflow',
        type: 'select',
        placeholder: 'Choose appointment status',
        options: appointmentStatusOptions,
        hideOnAddForm: true,
      },
      {
        name: 'checkInStatus',
        label: 'Check-in status',
        section: 'Workflow',
        type: 'select',
        placeholder: 'Choose check-in status',
        options: checkInStatusOptions,
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'checkInTime',
        label: 'Check-in time',
        section: 'Workflow',
        type: 'date',
        hideOnAddForm: true,
        hideOnEditForm: true,
        date: {
          showButtonBar: true,
          showTime: true,
        },
      },
      {
        name: 'checkOutTime',
        label: 'Check-out time',
        section: 'Workflow',
        type: 'date',
        hideOnAddForm: true,
        hideOnEditForm: true,
        date: {
          showButtonBar: true,
          showTime: true,
        },
      },
      {
        name: 'noShowFlag',
        label: 'Mark as no-show',
        section: 'Workflow',
        type: 'switch',
        hideOnAddForm: true,
        visibleIf: (values) => values.appointmentStatus === 'No Show',
      },
      {
        name: 'cancellationReason',
        label: 'Cancellation reason',
        section: 'Workflow',
        type: 'select',
        placeholder: 'Choose cancellation reason',
        options: cancellationReasonOptions,
        hideOnAddForm: true,
        visibleIf: (values) => values.appointmentStatus === 'Cancelled',
      },
      {
        name: 'notes',
        label: 'Scheduling notes',
        section: 'Workflow',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
      },
      {
        name: 'referral.required',
        label: 'Referral required',
        section: 'Referral',
        type: 'switch',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'referral.referralNumber',
        label: 'Referral number',
        section: 'Referral',
        type: 'text',
        placeholder: 'Referral number',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'referral.validFrom',
        label: 'Referral valid from',
        section: 'Referral',
        type: 'date',
        hideOnAddForm: true,
        hideOnEditForm: true,
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'referral.validTo',
        label: 'Referral valid to',
        section: 'Referral',
        type: 'date',
        hideOnAddForm: true,
        hideOnEditForm: true,
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'estimate.estimatedPatientResponsibility',
        label: 'Estimated patient responsibility',
        section: 'Patient Estimate',
        type: 'number',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'estimate.depositAmount',
        label: 'Deposit amount',
        section: 'Patient Estimate',
        type: 'number',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'estimate.depositCollected',
        label: 'Deposit collected',
        section: 'Patient Estimate',
        type: 'switch',
        hideOnAddForm: true,
        hideOnEditForm: true,
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

export function formatDateTime(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value))
}

export function formatAppointmentTime(value?: string | null) {
  const parts = parseAppointmentTimeParts(value)

  if (!parts) {
    return value?.trim() || '-'
  }

  const formattedDate = new Date()
  formattedDate.setHours(parts.hours, parts.minutes, 0, 0)

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(formattedDate)
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

function compactAppointmentReferral(value: AppointmentReferralFormValues): AppointmentReferral | undefined {
  const nextValue = {
    required: value.required,
    referralNumber: optionalText(value.referralNumber),
    validFrom: optionalDate(value.validFrom),
    validTo: optionalDate(value.validTo),
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

function compactAppointmentEstimate(value: AppointmentEstimateFormValues): AppointmentEstimate | undefined {
  const nextValue = {
    estimatedPatientResponsibility: optionalNumber(value.estimatedPatientResponsibility),
    depositAmount: optionalNumber(value.depositAmount),
    depositCollected: value.depositCollected,
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

export function mapAppointmentToFormValues(item: Appointment): AppointmentFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    providerId: item.providerId ?? '',
    facilityId: item.facilityId ?? '',
    appointmentDate: toFormDate(item.appointmentDate),
    appointmentTime: normalizeAppointmentTimeValue(item.appointmentTime),
    appointmentType: item.appointmentType ?? '',
    visitType: item.visitType ?? '',
    reason: item.reason ?? '',
    appointmentStatus: item.appointmentStatus ?? 'Scheduled',
    checkInStatus: item.checkInStatus ?? 'Pending',
    checkInTime: toFormDate(item.checkInTime),
    checkOutTime: toFormDate(item.checkOutTime),
    noShowFlag: item.noShowFlag,
    cancellationReason: item.cancellationReason ?? '',
    notes: item.notes ?? '',
    referral: {
      required: item.referral.required,
      referralNumber: item.referral.referralNumber ?? '',
      validFrom: toFormDate(item.referral.validFrom),
      validTo: toFormDate(item.referral.validTo),
    },
    estimate: {
      estimatedPatientResponsibility: item.estimate.estimatedPatientResponsibility ?? null,
      depositAmount: item.estimate.depositAmount ?? null,
      depositCollected: item.estimate.depositCollected,
    },
    active: item.active,
  }
}

export function mapAppointmentFormToPayload(values: AppointmentFormValues): AppointmentCreatePayload {
  return {
    patientId: optionalText(values.patientId),
    providerId: optionalText(values.providerId),
    facilityId: optionalText(values.facilityId),
    appointmentDate: optionalDate(values.appointmentDate),
    appointmentTime: optionalText(normalizeAppointmentTimeValue(values.appointmentTime)),
    appointmentType: optionalText(values.appointmentType),
    visitType: optionalText(values.visitType),
    reason: optionalText(values.reason),
    appointmentStatus: optionalText(values.appointmentStatus),
    checkInStatus: optionalText(values.checkInStatus),
    checkInTime: optionalDate(values.checkInTime),
    checkOutTime: optionalDate(values.checkOutTime),
    noShowFlag: values.noShowFlag,
    cancellationReason: optionalText(values.cancellationReason),
    notes: optionalText(values.notes),
    referral: compactAppointmentReferral(values.referral),
    estimate: compactAppointmentEstimate(values.estimate),
    active: values.active,
  }
}

function getAppointmentLabel(item: Appointment, referenceOptions: RcmReferenceOptions = {}) {
  return [
    formatReferenceLabel(referenceOptions.patients, item.patientId),
    formatDate(item.appointmentDate),
    formatAppointmentTime(item.appointmentTime),
  ]
    .filter((value) => value && value !== '-')
    .join(' / ') || item._id
}

export function getAppointmentRowLabel(item: Appointment, referenceOptions: RcmReferenceOptions = {}) {
  return getAppointmentLabel(item, referenceOptions)
}

export function createAppointmentTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Appointment>> {
  return [
    {
      key: 'appointmentStart',
      header: 'Scheduled',
      sortField: 'appointmentStart',
      exportValue: (item) => [formatDate(item.appointmentDate), formatAppointmentTime(item.appointmentTime)].join(' '),
      render: (item) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{formatAppointmentTime(item.appointmentTime)}</p>
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{formatDate(item.appointmentDate)}</p>
        </div>
      ),
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
      key: 'providerId',
      header: 'Provider',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.providers, item.providerId),
      render: (item) => formatReferenceLabel(referenceOptions.providers, item.providerId),
    },
    {
      key: 'visitType',
      header: 'Visit Type',
      filterable: true,
      field: 'visitType',
      sortField: 'visitType',
      exportValue: (item) => item.visitType ?? '-',
      render: (item) => item.visitType ?? '-',
    },
    {
      key: 'appointmentStatus',
      header: 'Status',
      filterable: true,
      field: 'appointmentStatus',
      sortField: 'appointmentStatus',
      exportValue: (item) => item.appointmentStatus ?? '-',
      render: (item) => item.appointmentStatus ?? '-',
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

export function renderAppointmentDetails(item: Appointment, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Appointment</h3>
        {renderSection([
          ['appointment ID', item.appointmentId],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['provider ID', formatReferenceLabel(referenceOptions.providers, item.providerId)],
          ['facility ID', formatReferenceLabel(referenceOptions.facilities, item.facilityId)],
          ['appointment Date', formatDate(item.appointmentDate)],
          ['appointment Time', formatAppointmentTime(item.appointmentTime)],
          ['appointment Type', item.appointmentType ?? '-'],
          ['visit Type', item.visitType ?? '-'],
          ['reason', item.reason ?? '-'],
          ['appointment Status', item.appointmentStatus ?? '-'],
          ['check In Status', item.checkInStatus ?? '-'],
          ['check In Time', formatDateTime(item.checkInTime)],
          ['check Out Time', formatDateTime(item.checkOutTime)],
          ['no Show Flag', formatBoolean(item.noShowFlag)],
          ['cancellation Reason', item.cancellationReason ?? '-'],
          ['notes', item.notes ?? '-'],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">referral</h3>
        {renderSection([
          ['required', formatBoolean(item.referral.required)],
          ['referral Number', item.referral.referralNumber ?? '-'],
          ['valid From', formatDate(item.referral.validFrom)],
          ['valid To', formatDate(item.referral.validTo)],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">estimate</h3>
        {renderSection([
          ['estimated Patient Responsibility', formatNumber(item.estimate.estimatedPatientResponsibility)],
          ['deposit Amount', formatNumber(item.estimate.depositAmount)],
          ['deposit Collected', formatBoolean(item.estimate.depositCollected)],
        ])}
      </section>
    </div>
  )
}

export function renderAppointmentGridItem(item: Appointment, referenceOptions: RcmReferenceOptions = {}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</p>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          {formatDate(item.appointmentDate)} at {formatAppointmentTime(item.appointmentTime)}
        </p>
      </div>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">provider</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.providers, item.providerId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">visit type</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.visitType ?? '-'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.appointmentStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
