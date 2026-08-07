import { z } from 'zod'
import { cptCodePattern, icd10CodePattern, splitMultiValueText } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Encounter, EncounterCreatePayload, EncounterFormValues, EncounterVital, EncounterCheckout, EncounterCheckoutFormValues, EncounterVitalFormValues } from '@/types/encounter'

export const encounterApiDetails = {
  endpoint: '/rcm/encounters',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const DEFAULT_EDIT_CLINICAL_NOTES = 'Patient is edentulous in the maxillary arch and presents for complete maxillary denture fabrication. Impressions completed and treatment plan reviewed.'

function createSelectOptions(values: string[]): CrudSelectOption[] {
  return values.map((value) => ({
    label: value,
    value,
  }))
}

const encounterVisitStatusOptions = createSelectOptions([
  'Created',
  'Patient Arrived',
  'In Progress',
])

const encounterVitalFormSchema = z.object({
  temperature: z.number().nullable(),
  bloodPressure: z.string().trim(),
  pulse: z.number().nullable(),
  height: z.number().nullable(),
  weight: z.number().nullable(),
  bmi: z.number().nullable(),
})

const encounterCheckoutFormSchema = z.object({
  checkOutTime: z.date().nullable(),
  followUpRequired: z.boolean(),
  balanceDue: z.number().nullable(),
  followUpInstructions: z.string().trim(),
})

export const encounterFormSchema = z.object({
  _id: z.string().optional(),
  appointmentId: z.string().trim().min(1, 'Appointment is required.'),
  patientId: z.string().trim().min(1, 'Patient is required.'),
  providerId: z.string().trim().min(1, 'Provider is required.'),
  renderingProviderId: z.string().trim(),
  supervisingProviderId: z.string().trim(),
  facilityId: z.string().trim().min(1, 'Facility is required.'),
  encounterDate: z.date().nullable(),
  startTime: z.date().nullable(),
  endTime: z.date().nullable(),
  visitStatus: z.string().trim().min(1, 'Visit status is required.'),
  chiefComplaint: z.string().trim().min(1, 'Chief complaint is required.'),
  historyOfPresentIllness: z.string().trim(),
  clinicalNotes: z.string().trim(),
  diagnosisCodes: z.string().trim(),
  procedureCodes: z.string().trim(),
  procedureCodeUnits: z.record(z.string(), z.number()),
  vitals: encounterVitalFormSchema,
  checkout: encounterCheckoutFormSchema,
  active: z.boolean(),
}).superRefine((values, ctx) => {
  if (!values.encounterDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['encounterDate'],
      message: 'Encounter date is required.',
    })
  }

  if (!values.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startTime'],
      message: 'Encounter start time is required.',
    })
  }

  // End time is always required in edit mode
  if (values._id?.trim() && !values.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'End time is required.',
    })
  }

  if (values.startTime && values.endTime && values.endTime < values.startTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'End time cannot be earlier than the start time.',
    })
  }

  if (values.checkout.checkOutTime && !values.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endTime'],
      message: 'End time should be recorded before checkout.',
    })
  }

  if (values.checkout.checkOutTime && values.endTime && values.checkout.checkOutTime < values.endTime) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkout', 'checkOutTime'],
      message: 'Check-out time cannot be earlier than encounter end time.',
    })
  }

  if (values.checkout.followUpRequired && !values.checkout.followUpInstructions.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkout', 'followUpInstructions'],
      message: 'Follow-up instructions are required when follow-up is needed.',
    })
  }

  if (values.checkout.balanceDue !== null && values.checkout.balanceDue < 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['checkout', 'balanceDue'],
      message: 'Balance due cannot be negative.',
    })
  }

  const completionStatuses = ['Provider Completed', 'Completed', 'Checked Out', 'Ready for Charge Capture']

  // Clinical notes are always required in edit mode
  if (values._id?.trim() && !values.clinicalNotes.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['clinicalNotes'],
      message: 'Clinical notes are required.',
    })
  }

  if (completionStatuses.includes(values.visitStatus) && !values.diagnosisCodes.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['diagnosisCodes'],
      message: 'At least one diagnosis code is required before the encounter can move to charge capture.',
    })
  }

  if (completionStatuses.includes(values.visitStatus) && !values.procedureCodes.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['procedureCodes'],
      message: 'At least one procedure code is required before the encounter can move to charge capture.',
    })
  }

  const invalidDiagnosisCodes = splitMultiValueText(values.diagnosisCodes).filter((code) => !icd10CodePattern.test(code))

  if (invalidDiagnosisCodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['diagnosisCodes'],
      message: `Invalid diagnosis code(s): ${invalidDiagnosisCodes.join(', ')}`,
    })
  }

  const invalidProcedureCodes = splitMultiValueText(values.procedureCodes).filter((code) => !cptCodePattern.test(code))

  if (invalidProcedureCodes.length) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['procedureCodes'],
      message: `Invalid procedure code(s): ${invalidProcedureCodes.join(', ')}`,
    })
  }
}) as z.ZodType<EncounterFormValues>

export const encounterDefaultValues: EncounterFormValues = {
  _id: '',
  appointmentId: '',
  patientId: '',
  providerId: '',
  renderingProviderId: '',
  supervisingProviderId: '',
  facilityId: '',
  encounterDate: null,
  startTime: null,
  endTime: null,
  visitStatus: 'In Progress',
  chiefComplaint: '',
  historyOfPresentIllness: '',
  clinicalNotes: '',
  diagnosisCodes: '',
  procedureCodes: '',
  procedureCodeUnits: {},
  vitals: {
    temperature: null,
    bloodPressure: '',
    pulse: null,
    height: null,
    weight: null,
    bmi: null,
  },
  checkout: {
    checkOutTime: null,
    followUpRequired: false,
    balanceDue: null,
    followUpInstructions: '',
  },
  active: true,
}

export function createEncounterFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<EncounterFormValues> {
  void referenceOptions
  return {
    schema: encounterFormSchema,
    defaultValues: encounterDefaultValues,
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
        type: 'autocomplete',
        placeholder: 'Select appointment',
        options: referenceOptions.appointments ?? [],
        disableOnEditForm: true,
        autocomplete: {
          dropdown: true,
          forceSelection: true,
        },
      },
      {
        name: 'patientId',
        label: 'Patient',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
        disableOnEditForm: true,
        autocomplete: {
          dropdown: true,
          forceSelection: true,
        },
      },
      {
        name: 'providerId',
        label: 'Scheduled Provider',
        type: 'autocomplete',
        placeholder: 'Select provider',
        options: referenceOptions.providers ?? [],
        disableOnEditForm: true,
        autocomplete: {
          dropdown: true,
          forceSelection: true,
        },
      },
      {
        name: 'facilityId',
        label: 'Facility',
        type: 'autocomplete',
        placeholder: 'Select facility',
        options: referenceOptions.facilities ?? [],
        disableOnEditForm: true,
        autocomplete: {
          dropdown: true,
          forceSelection: true,
        },
      },
      {
        name: 'encounterDate',
        label: 'Encounter Date',
        type: 'date',
        disableOnEditForm: true,
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'startTime',
        label: 'Start Time',
        type: 'date',
        disableOnEditForm: true,
        date: {
          showButtonBar: true,
          showTime: true,
        },
      },
      {
        name: 'visitStatus',
        label: 'Visit Status',
        type: 'select',
        placeholder: 'Select visit status',
        options: encounterVisitStatusOptions,
        disableOnEditForm: true,
        helperText: 'Encounter completion is handled by the Complete Encounter action after documentation is saved.',
      },
      {
        name: 'chiefComplaint',
        label: 'Chief Complaint',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
      },
      {
        name: 'renderingProviderId',
        label: 'Rendering Provider',
        type: 'autocomplete',
        placeholder: 'Select rendering provider',
        options: referenceOptions.providers ?? [],
        hideOnAddForm: true,
        autocomplete: {
          dropdown: true,
          forceSelection: true,
        },
      },
      {
        name: 'supervisingProviderId',
        label: 'Supervising Provider',
        type: 'autocomplete',
        placeholder: 'Select supervising provider',
        options: referenceOptions.providers ?? [],
        hideOnAddForm: true,
        autocomplete: {
          dropdown: true,
          forceSelection: true,
        },
      },
      {
        name: 'endTime',
        label: 'End Time',
        type: 'date',
        hideOnAddForm: true,
        required: true,
        date: {
          showButtonBar: true,
          showTime: true,
          minDateFn: (values) => {
            if (!(values.startTime instanceof Date)) return undefined
            const d = new Date(values.startTime)
            d.setHours(0, 0, 0, 0)
            return d
          },
        },
      },
      {
        name: 'historyOfPresentIllness',
        label: 'History of Present Illness',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        hideOnAddForm: true,
      },
      {
        name: 'clinicalNotes',
        label: 'Clinical Notes Info',
        type: 'info',
        fullWidth: true,
        hideOnAddForm: true,
        info: {
          description: 'Sample clinical notes — copy a scenario and paste into Clinical Notes below to test AI coding suggestions.',
          scenarios: [
            {
              label: 'Single Line Payment',
              text: 'New adult patient presents for comprehensive dental evaluation. Medical and dental history reviewed. Full oral examination completed. No acute dental pain. No clinical caries or periodontal disease noted.',
            },
            {
              label: 'Multi Lines Payment/ Denial Payment',
              text: 'Patient presents with localized dental pain on lower right molar. Limited problem-focused oral evaluation completed. Periapical radiograph taken of tooth #30. No definitive procedure completed today. Palliative treatment performed for pain relief.',
            },
          ],
        },
      },
      {
        name: 'clinicalNotes',
        label: 'Clinical Notes',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        hideOnAddForm: true,
        required: true,
      },
      {
        name: 'diagnosisCodes',
        label: 'Diagnosis Codes',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
        hideOnAddForm: true,
      },
      {
        name: 'procedureCodes',
        label: 'Procedure Codes',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Enter one value per line or separate values with commas.',
        hideOnAddForm: true,
      },
      {
        name: 'vitals.temperature',
        label: 'Temperature',
        type: 'number',
        hideOnAddForm: true,
      },
      {
        name: 'vitals.bloodPressure',
        label: 'Blood Pressure',
        type: 'text',
        placeholder: 'e.g. 120/80',
        hideOnAddForm: true,
      },
      {
        name: 'vitals.pulse',
        label: 'Pulse',
        type: 'number',
        hideOnAddForm: true,
      },
      {
        name: 'vitals.height',
        label: 'Height',
        type: 'number',
        hideOnAddForm: true,
      },
      {
        name: 'vitals.weight',
        label: 'Weight',
        type: 'number',
        hideOnAddForm: true,
      },
      {
        name: 'vitals.bmi',
        label: 'BMI',
        type: 'number',
        hideOnAddForm: true,
      },
      {
        name: 'checkout.checkOutTime',
        label: 'Checkout Time',
        type: 'date',
        hideOnAddForm: true,
        hideOnEditForm: true,
        date: {
          showButtonBar: true,
          showTime: true,
        },
      },
      {
        name: 'checkout.followUpRequired',
        label: 'Follow-Up Required',
        type: 'switch',
        hideOnAddForm: true,
      },
      {
        name: 'checkout.balanceDue',
        label: 'Balance Due',
        type: 'number',
        hideOnAddForm: true,
        hideOnEditForm: true,
      },
      {
        name: 'checkout.followUpInstructions',
        label: 'Follow-Up Instructions',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        hideOnAddForm: true,
      },
      {
        name: 'active',
        label: 'active',
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

export function formatTime(value?: string | Date | null) {
  if (!value) {
    return '-'
  }

  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
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

function compactEncounterVital(value: EncounterVitalFormValues): EncounterVital | undefined {
  const nextValue = {
    temperature: optionalNumber(value.temperature),
    bloodPressure: optionalText(value.bloodPressure),
    pulse: optionalNumber(value.pulse),
    height: optionalNumber(value.height),
    weight: optionalNumber(value.weight),
    bmi: optionalNumber(value.bmi),
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

function compactEncounterCheckout(value: EncounterCheckoutFormValues): EncounterCheckout | undefined {
  const nextValue = {
    checkOutTime: optionalDate(value.checkOutTime),
    followUpRequired: value.followUpRequired,
    balanceDue: optionalNumber(value.balanceDue),
    followUpInstructions: optionalText(value.followUpInstructions),
  }

  return Object.values(nextValue).some(Boolean) ? nextValue : undefined
}

export function mapEncounterToFormValues(item: Encounter): EncounterFormValues {
  const clinicalNotes = item.clinicalNotes?.trim() || DEFAULT_EDIT_CLINICAL_NOTES
  const isDefaultNotes = clinicalNotes === DEFAULT_EDIT_CLINICAL_NOTES

  return {
    _id: item._id,
    appointmentId: item.appointmentId ?? '',
    patientId: item.patientId ?? '',
    providerId: item.providerId ?? '',
    renderingProviderId: item.renderingProviderId ?? '',
    supervisingProviderId: item.supervisingProviderId ?? '',
    facilityId: item.facilityId ?? '',
    encounterDate: toFormDate(item.encounterDate),
    startTime: toFormDate(item.startTime),
    endTime: toFormDate(item.endTime),
    visitStatus: item.visitStatus ?? '',
    chiefComplaint: item.chiefComplaint ?? '',
    historyOfPresentIllness: item.historyOfPresentIllness ?? '',
    clinicalNotes,
    diagnosisCodes: formatStringList(item.diagnosisCodes) || (isDefaultNotes ? 'K08.109' : ''),
    procedureCodes: formatStringList(item.procedureCodes) || (isDefaultNotes ? 'D5110' : ''),
    procedureCodeUnits: item.procedureCodeUnits ?? {},
    vitals: {
      temperature: item.vitals.temperature ?? null,
      bloodPressure: item.vitals.bloodPressure ?? '',
      pulse: item.vitals.pulse ?? null,
      height: item.vitals.height ?? null,
      weight: item.vitals.weight ?? null,
      bmi: item.vitals.bmi ?? null,
    },
    checkout: {
      checkOutTime: toFormDate(item.checkout.checkOutTime),
      followUpRequired: item.checkout.followUpRequired,
      balanceDue: item.checkout.balanceDue ?? null,
      followUpInstructions: item.checkout.followUpInstructions ?? '',
    },
    active: item.active,
  }
}

export function mapEncounterFormToPayload(values: EncounterFormValues): EncounterCreatePayload {
  return {
    appointmentId: optionalText(values.appointmentId),
    patientId: optionalText(values.patientId),
    providerId: optionalText(values.providerId),
    renderingProviderId: optionalText(values.renderingProviderId),
    supervisingProviderId: optionalText(values.supervisingProviderId),
    facilityId: optionalText(values.facilityId),
    encounterDate: optionalDate(values.encounterDate),
    startTime: optionalDate(values.startTime),
    endTime: optionalDate(values.endTime),
    visitStatus: optionalText(values.visitStatus),
    chiefComplaint: optionalText(values.chiefComplaint),
    historyOfPresentIllness: optionalText(values.historyOfPresentIllness),
    clinicalNotes: optionalText(values.clinicalNotes),
    diagnosisCodes: parseStringList(values.diagnosisCodes),
    procedureCodes: parseStringList(values.procedureCodes),
    procedureCodeUnits: Object.keys(values.procedureCodeUnits).length ? values.procedureCodeUnits : undefined,
    vitals: compactEncounterVital(values.vitals),
    checkout: compactEncounterCheckout(values.checkout),
    active: values.active,
  }
}

function getEncounterLabel(item: Encounter, referenceOptions: RcmReferenceOptions = {}) {
  return [
    formatReferenceLabel(referenceOptions.patients, item.patientId),
    formatDate(item.encounterDate),
    item.visitStatus,
  ].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function getEncounterRowLabel(item: Encounter, referenceOptions: RcmReferenceOptions = {}) {
  return getEncounterLabel(item, referenceOptions)
}

export function createEncounterTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Encounter>> {
  return [
    {
      key: 'encounterDate',
      header: 'Encounter',
      filterable: true,
      sortField: 'encounterDate',
      exportValue: (item) => [formatDate(item.encounterDate), formatTime(item.startTime)].join(' '),
      render: (item) => (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">{formatDate(item.encounterDate)}</p>
          <p className="text-xs font-medium text-[var(--color-text-muted)]">{formatTime(item.startTime)}</p>
        </div>
      ),
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
      key: 'visitStatus',
      header: 'Visit Status',
      filterable: true,
      field: 'visitStatus',
      sortField: 'visitStatus',
      exportValue: (item) => item.visitStatus ?? '-',
      render: (item) => item.visitStatus ?? '-',
    },
    {
      key: 'chiefComplaint',
      header: 'Chief Complaint',
      field: 'chiefComplaint',
      sortable: false,
      exportValue: (item) => item.chiefComplaint ?? '-',
      render: (item) => item.chiefComplaint ?? '-',
    },
    {
      key: 'estimate',
      header: 'Patient Resp.',
      sortable: false,
      exportValue: (item) => (item.estimate?.estimatedPatientResponsibility !== undefined ? `$${item.estimate.estimatedPatientResponsibility.toFixed(2)}` : '-'),
      render: (item) => (
        item.estimate?.estimatedPatientResponsibility !== undefined ? (
          <div className="flex flex-col">
            <span className="font-bold text-indigo-600">${item.estimate.estimatedPatientResponsibility.toFixed(2)}</span>
            <span className="text-[10px] text-neutral-400 uppercase">Estimated</span>
          </div>
        ) : '-'
      ),
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

export function renderEncounterDetails(item: Encounter, referenceOptions: RcmReferenceOptions = {}) {
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Encounter</h3>
        {renderSection([
          ['Encounter ID', item.encounterId],
          ['Appointment', formatReferenceLabel(referenceOptions.appointments, item.appointmentId)],
          ['Patient', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['Scheduled Provider', formatReferenceLabel(referenceOptions.providers, item.providerId)],
          ['Rendering Provider', formatReferenceLabel(referenceOptions.providers, item.renderingProviderId)],
          ['Supervising Provider', formatReferenceLabel(referenceOptions.providers, item.supervisingProviderId)],
          ['Facility', formatReferenceLabel(referenceOptions.facilities, item.facilityId)],
          ['Encounter Date', formatDate(item.encounterDate)],
          ['Start Time', formatDateTime(item.startTime)],
          ['End Time', formatDateTime(item.endTime)],
          ['Visit Status', item.visitStatus ?? '-'],
          ['Chief Complaint', item.chiefComplaint ?? '-'],
          ['History of Present Illness', item.historyOfPresentIllness ?? '-'],
          ['Clinical Notes', item.clinicalNotes ?? '-'],
          ['Diagnosis Codes', (item.diagnosisCodes ?? []).join(', ') || '-'],
          ['Procedure Codes', (item.procedureCodes ?? []).join(', ') || '-'],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Vitals</h3>
        {renderSection([
          ['Temperature', formatNumber(item.vitals.temperature)],
          ['Blood Pressure', item.vitals.bloodPressure ?? '-'],
          ['Pulse', formatNumber(item.vitals.pulse)],
          ['Height', formatNumber(item.vitals.height)],
          ['Weight', formatNumber(item.vitals.weight)],
          ['BMI', formatNumber(item.vitals.bmi)],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Checkout</h3>
        {renderSection([
          ['Checkout Time', formatDateTime(item.checkout.checkOutTime)],
          ['Follow-Up Required', formatBoolean(item.checkout.followUpRequired)],
          ['Balance Due', formatNumber(item.checkout.balanceDue)],
          ['Follow-Up Instructions', item.checkout.followUpInstructions ?? '-'],
        ])}
      </section>
      {item.estimate && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Financial Estimation</h3>
          {renderSection([
            ['Estimated Allowed', item.estimate.estimatedAllowedAmount !== undefined ? `$${item.estimate.estimatedAllowedAmount.toFixed(2)}` : '-'],
            ['Estimated Insurance Paid', item.estimate.estimatedInsurancePayment !== undefined ? `$${item.estimate.estimatedInsurancePayment.toFixed(2)}` : '-'],
            ['Estimated Patient Resp.', item.estimate.estimatedPatientResponsibility !== undefined ? `$${item.estimate.estimatedPatientResponsibility.toFixed(2)}` : '-'],
            ['Last Estimated At', formatDateTime(item.estimate.lastEstimatedAt)],
          ])}
        </section>
      )}
    </div>
  )
}

export function renderEncounterGridItem(item: Encounter, referenceOptions: RcmReferenceOptions = {}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</p>
        <p className="text-xs font-medium text-[var(--color-text-muted)]">
          {formatDate(item.encounterDate)} at {formatTime(item.startTime)}
        </p>
      </div>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">appointment</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.appointments, item.appointmentId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">provider</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.providers, item.providerId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">visit status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.visitStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
