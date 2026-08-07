import { z } from 'zod'
import { cptCodePattern, icd10CodePattern, isPositiveNumber, splitMultiValueText } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Charge, ChargeCreatePayload, ChargeFormValues, ChargeChargeLine, ChargeChargeLineFormValues } from '@/types/charge'

export const chargeApiDetails = {
  endpoint: '/rcm/charges',
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

const chargeStatusOptions = createSelectOptions(['Draft', 'Submitted', 'Approved'])

const codingReviewStatusOptions = createSelectOptions([
  'Not Started',
  'Pending',
  'Failed',
  'Passed',
  'Approved for Claim',
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

const chargeChargeLineFormSchema = z.object({
  lineNumber: z.number().nullable(),
  cptCode: z.string().trim(),
  icdCodes: z.string().trim(),
  icdPointers: z.string().trim(),
  modifiers: z.string().trim(),
  units: z.number().nullable(),
  chargeAmount: z.number().nullable(),
  diagnosisLinking: z.string().trim(),
  renderingProviderId: z.string().trim(),
})

export const chargeFormSchema = z.object({
  _id: z.string().optional(),
  encounterId: z.string().trim().min(1, 'Encounter is required'),
  patientId: z.string().trim().min(1, 'Patient is required'),
  providerId: z.string().trim().min(1, 'Provider is required'),
  facilityId: z.string().trim().min(1, 'Facility is required'),
  serviceDate: z.date().nullable(),
  placeOfService: z.string().trim().min(1, 'Place of service is required'),
  totalChargeAmount: z.number().nullable(),
  chargeStatus: z.string().trim().min(1, 'Charge status is required'),
  codingReviewStatus: z.string().trim().min(1, 'Coding review status is required'),
  documentationComplete: z.boolean(),
  validationErrors: z.string().trim(),
  createdBy: z.string().trim(),
  reviewedBy: z.string().trim(),
  chargeLines: z.array(chargeChargeLineFormSchema).min(1),
  active: z.boolean(),
}).superRefine((value, context) => {
  if (!value.serviceDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Service date is required.',
      path: ['serviceDate'],
    })
  }

  if (!isPositiveNumber(value.totalChargeAmount)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total charge amount must be greater than 0.',
      path: ['totalChargeAmount'],
    })
  }

  const nonEmptyLines = value.chargeLines
    .map((line, index) => ({ line, index }))
    .filter(({ line }) =>
      [
        line.lineNumber !== null,
        line.cptCode.trim(),
        line.icdCodes.trim(),
        line.icdPointers.trim(),
        line.modifiers.trim(),
        line.units !== null,
        line.chargeAmount !== null,
        line.diagnosisLinking.trim(),
        line.renderingProviderId.trim(),
      ].some(Boolean),
    )

  if (!nonEmptyLines.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'At least one charge line is required.',
      path: ['chargeLines'],
    })
  }

  nonEmptyLines.forEach(({ line, index }) => {
    const invalidDiagnosisCodes = splitMultiValueText(line.icdCodes).filter((code) => !icd10CodePattern.test(code))

    if (!line.cptCode.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPT/HCPCS code is required.',
        path: ['chargeLines', index, 'cptCode'],
      })
    } else if (!cptCodePattern.test(line.cptCode.trim())) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'CPT/HCPCS code must be a valid 5-character code.',
        path: ['chargeLines', index, 'cptCode'],
      })
    }

    if (!line.icdCodes.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'At least one diagnosis code is required.',
        path: ['chargeLines', index, 'icdCodes'],
      })
    } else if (invalidDiagnosisCodes.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Invalid diagnosis code(s): ${invalidDiagnosisCodes.join(', ')}`,
        path: ['chargeLines', index, 'icdCodes'],
      })
    }

    if (!line.icdPointers.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Diagnosis pointers are required.',
        path: ['chargeLines', index, 'icdPointers'],
      })
    }

    if (!isPositiveNumber(line.units)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Units must be greater than 0.',
        path: ['chargeLines', index, 'units'],
      })
    }

    if (!isPositiveNumber(line.chargeAmount)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Charge amount must be greater than 0.',
        path: ['chargeLines', index, 'chargeAmount'],
      })
    }

    if (!line.renderingProviderId.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Rendering provider is required for each charge line.',
        path: ['chargeLines', index, 'renderingProviderId'],
      })
    }
  })

  const summedChargeAmount = nonEmptyLines.reduce((total, { line }) => total + (line.chargeAmount ?? 0), 0)

  if (isPositiveNumber(value.totalChargeAmount) && nonEmptyLines.length && Math.abs(summedChargeAmount - value.totalChargeAmount) > 0.01) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Total charge amount must match the sum of the charge lines.',
      path: ['totalChargeAmount'],
    })
  }
}) as z.ZodType<ChargeFormValues>

function createEmptyChargeChargeLine(): ChargeChargeLineFormValues {
  return {
    lineNumber: null,
    cptCode: '',
    icdCodes: '',
    icdPointers: '',
    modifiers: '',
    units: null,
    chargeAmount: null,
    diagnosisLinking: '',
    renderingProviderId: '',
  }
}

export const chargeDefaultValues: ChargeFormValues = {
  _id: '',
  encounterId: '',
  patientId: '',
  providerId: '',
  facilityId: '',
  serviceDate: null,
  placeOfService: '',
  totalChargeAmount: null,
  chargeStatus: 'Draft',
  codingReviewStatus: 'Not Started',
  documentationComplete: false,
  validationErrors: '',
  createdBy: '',
  reviewedBy: '',
  chargeLines: [createEmptyChargeChargeLine(), createEmptyChargeChargeLine()],
  active: true,
}

export function createChargeFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ChargeFormValues> {
  return {
    schema: chargeFormSchema,
    defaultValues: chargeDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'encounterId',
        label: 'Encounter',
        section: 'Charge Header',
        type: 'autocomplete',
        placeholder: 'Select encounter',
        options: referenceOptions.encounters ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'patientId',
        label: 'Patient',
        section: 'Charge Header',
        type: 'autocomplete',
        placeholder: 'Select patient',
        options: referenceOptions.patients ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'providerId',
        label: 'Billing provider',
        section: 'Charge Header',
        type: 'autocomplete',
        placeholder: 'Select provider',
        options: referenceOptions.providers ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'facilityId',
        label: 'Facility',
        section: 'Charge Header',
        type: 'autocomplete',
        placeholder: 'Select facility',
        options: referenceOptions.facilities ?? [],
        disableOnEditForm: true,
      },
      {
        name: 'serviceDate',
        label: 'Service date',
        section: 'Charge Header',
        type: 'date',
        disableOnEditForm: true,
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'placeOfService',
        label: 'Place of service',
        section: 'Charge Header',
        type: 'select',
        placeholder: 'Select POS',
        options: placeOfServiceOptions,
        disableOnEditForm: true,
      },
      {
        name: 'totalChargeAmount',
        label: 'Total charge amount',
        section: 'Charge Header',
        type: 'number',
        disableOnEditForm: true,
      },
      {
        name: 'chargeStatus',
        label: 'Charge status',
        section: 'Review Status',
        type: 'select',
        placeholder: 'Select charge status',
        options: chargeStatusOptions,
        disableOnEditForm: true,
      },
      {
        name: 'codingReviewStatus',
        label: 'Coding review status',
        section: 'Review Status',
        type: 'select',
        placeholder: 'Select coding review status',
        options: codingReviewStatusOptions,
        disableOnEditForm: true,
      },
      {
        name: 'documentationComplete',
        label: 'Documentation complete',
        section: 'Review Status',
        type: 'switch',
      },
      {
        name: 'validationErrors',
        label: 'Validation notes',
        section: 'Review Status',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'System-generated scrub feedback appears here.',
        disableOnEditForm: true,
      },
      {
        name: 'createdBy',
        label: 'Created by',
        section: 'Review Status',
        type: 'text',
        placeholder: 'Created by',
        hideOnAddForm: true,
        disableOnEditForm: true,
      },
      {
        name: 'reviewedBy',
        label: 'Reviewed by',
        section: 'Review Status',
        type: 'text',
        placeholder: 'Reviewed by',
        hideOnAddForm: true,
        disableOnEditForm: true,
      },
      {
        name: 'chargeLines',
        label: 'Charge lines',
        section: 'Charge Lines',
        type: 'chargeLines',
        fullWidth: true,
        chargeLines: {
          providerOptions: referenceOptions.providers ?? [],
          codeOptions: referenceOptions.chargeMasterCodes ?? [],
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

export function formatCurrency(value?: number | null) {
  return typeof value === 'number' ? `$${value.toFixed(2)}` : '-'
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

function buildChargeChargeLines(chargeLines: ChargeChargeLine[] = []): ChargeChargeLineFormValues[] {
  return Array.from({ length: Math.max(2, chargeLines.length) }, (_, index) => {
    const item = chargeLines[index]

    return {
      lineNumber: item?.lineNumber ?? null,
      cptCode: item?.cptCode ?? '',
      icdCodes: formatStringList(item?.icdCodes),
      icdPointers: formatNumberList(item?.icdPointers),
      modifiers: formatStringList(item?.modifiers),
      units: item?.units ?? null,
      chargeAmount: item?.chargeAmount ?? null,
      diagnosisLinking: item?.diagnosisLinking ?? '',
      renderingProviderId: item?.renderingProviderId ?? '',
    }
  })
}

function isChargeChargeLineEmpty(item: ChargeChargeLineFormValues) {
  return item.lineNumber === null && !item.cptCode.trim() && !item.icdCodes.trim() && !item.icdPointers.trim() && !item.modifiers.trim() && item.units === null && item.chargeAmount === null && !item.diagnosisLinking.trim() && !item.renderingProviderId.trim()
}

function compactChargeChargeLines(chargeLines: ChargeChargeLineFormValues[]): ChargeChargeLine[] | undefined {
  const nextItems = chargeLines
    .filter((item) => !isChargeChargeLineEmpty(item))
    .map((item, index) => ({
      lineNumber: index + 1,
      cptCode: optionalText(item.cptCode),
      icdCodes: parseStringList(item.icdCodes),
      icdPointers: parseNumberList(item.icdPointers),
      modifiers: parseStringList(item.modifiers),
      units: optionalNumber(item.units),
      chargeAmount: optionalNumber(item.chargeAmount),
      diagnosisLinking: optionalText(item.diagnosisLinking),
      renderingProviderId: optionalText(item.renderingProviderId),
    }))

  return nextItems.length ? nextItems : undefined
}

function sumChargeLineAmounts(chargeLines: ChargeChargeLine[] | undefined) {
  return chargeLines?.reduce((total, line) => total + (line.chargeAmount ?? 0), 0) ?? 0
}

export function mapChargeToFormValues(item: Charge): ChargeFormValues {
  return {
    _id: item._id,
    encounterId: item.encounterId ?? '',
    patientId: item.patientId ?? '',
    providerId: item.providerId ?? '',
    facilityId: item.facilityId ?? '',
    serviceDate: toFormDate(item.serviceDate),
    placeOfService: item.placeOfService ?? '',
    totalChargeAmount: item.totalChargeAmount ?? null,
    chargeStatus: item.chargeStatus ?? '',
    codingReviewStatus: item.codingReviewStatus ?? '',
    documentationComplete: item.documentationComplete,
    validationErrors: formatStringList(item.validationErrors),
    createdBy: item.createdBy ?? '',
    reviewedBy: item.reviewedBy ?? '',
    chargeLines: buildChargeChargeLines(item.chargeLines),
    active: item.active,
  }
}

export function mapChargeFormToPayload(values: ChargeFormValues): ChargeCreatePayload {
  const chargeLines = compactChargeChargeLines(values.chargeLines)

  return {
    encounterId: optionalText(values.encounterId),
    patientId: optionalText(values.patientId),
    providerId: optionalText(values.providerId),
    facilityId: optionalText(values.facilityId),
    serviceDate: optionalDate(values.serviceDate),
    placeOfService: optionalText(values.placeOfService),
    totalChargeAmount: chargeLines?.length ? sumChargeLineAmounts(chargeLines) : optionalNumber(values.totalChargeAmount),
    chargeStatus: optionalText(values.chargeStatus),
    codingReviewStatus: optionalText(values.codingReviewStatus),
    documentationComplete: values.documentationComplete,
    validationErrors: parseStringList(values.validationErrors),
    createdBy: optionalText(values.createdBy),
    reviewedBy: optionalText(values.reviewedBy),
    chargeLines,
    active: values.active,
  }
}

export function getChargeRowLabel(item: Charge, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [formatDate(item.serviceDate), item.chargeStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createChargeTableColumns(
  referenceOptions: RcmReferenceOptions = {},
  onAiAnalysis?: (item: Charge) => void,
): Array<CrudTableColumn<Charge>> {
  return [
    {
      key: 'serviceDate',
      header: 'Service Date',
      filterable: true,
      sortField: 'serviceDate',
      exportValue: (item) => formatDate(item.serviceDate),
      render: (item) => (
        <span className="font-bold text-[var(--color-text-strong)]">
          {formatDate(item.serviceDate)}
        </span>
      ),
    },
    {
      key: 'patientId',
      header: 'Patient',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.patients, item.patientId),
      render: (item) => (
        <span className="font-semibold text-[var(--color-text-strong)]">
          {formatReferenceLabel(referenceOptions.patients, item.patientId)}
        </span>
      ),
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
      key: 'facilityId',
      header: 'Facility',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.facilities, item.facilityId),
      render: (item) => formatReferenceLabel(referenceOptions.facilities, item.facilityId),
    },
    {
      key: 'totalChargeAmount',
      header: 'Amount',
      filterable: true,
      sortField: 'totalChargeAmount',
      exportValue: (item) => `$${(item.totalChargeAmount ?? 0).toFixed(2)}`,
      render: (item) => (
        <span className="font-bold text-[var(--color-success-text)]">
          ${(item.totalChargeAmount ?? 0).toFixed(2)}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Created',
      sortField: 'created',
      field: 'createdAt',
      exportValue: (item) => formatDate(item.createdAt),
      render: (item) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatDate(item.createdAt)}
        </span>
      ),
    },
    {
      key: 'aiVerification',
      header: 'AI Check',
      sortable: false,
      render: (item) => (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-primary-soft)]/20 px-2.5 py-1 text-[10px] font-bold uppercase text-[var(--color-primary)] transition-all hover:bg-[var(--color-primary-soft)]/30 active:scale-95"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            onAiAnalysis?.(item)
          }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--color-primary)] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--color-primary)]" />
          </span>
          Verify
        </button>
      ),
    },
    {
      key: 'chargeStatus',
      header: 'Status',
      filterable: true,
      field: 'chargeStatus',
      sortField: 'chargeStatus',
      render: (item) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] font-bold text-[var(--color-text-strong)]">{item.chargeStatus ?? 'Draft'}</span>
          <span className="text-[9px] font-semibold uppercase tracking-tight text-[var(--color-text-muted)]">
            Review: {item.codingReviewStatus ?? 'None'}
          </span>
        </div>
      ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      filterable: true,
      sortField: 'updated',
      field: 'updatedAt',
      exportValue: (item) => formatDate(item.updatedAt),
      render: (item) => (
        <span className="text-xs text-[var(--color-text-muted)]">
          {formatDate(item.updatedAt)}
        </span>
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

export function renderChargeDetails(item: Charge, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Charge</h3>
        {renderSection([
          ['charge ID', item.chargeId],
          ['encounter ID', formatReferenceLabel(referenceOptions.encounters, item.encounterId)],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['provider ID', formatReferenceLabel(referenceOptions.providers, item.providerId)],
          ['facility ID', formatReferenceLabel(referenceOptions.facilities, item.facilityId)],
          ['service Date', formatDate(item.serviceDate)],
          ['place Of Service', item.placeOfService ?? '-'],
          ['total Charge Amount', formatCurrency(item.totalChargeAmount)],
          ['charge Status', item.chargeStatus ?? '-'],
          ['coding Review Status', item.codingReviewStatus ?? '-'],
          ['documentation Complete', formatBoolean(item.documentationComplete)],
          ['validation Errors', (item.validationErrors ?? []).join(', ') || '-'],
          ['created By', item.createdBy ?? '-'],
          ['reviewed By', item.reviewedBy ?? '-'],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">charge Lines</h3>
        {renderSection([
          ['Items', item.chargeLines.length ? item.chargeLines.map((line, index) => [
            `Line ${line.lineNumber ?? index + 1}`,
            `CPT/CDT ${line.cptCode ?? '-'}`,
            `Units ${formatNumber(line.units)}`,
            `Billed ${formatCurrency(line.chargeAmount)}`,
            `Expected allowed ${formatCurrency(line.expectedAllowedAmount)}`,
            `Fee schedule ${line.feeScheduleId ?? '-'}`,
            `Pricing ${line.pricingStatus ?? line.pricingMatchedBy ?? '-'}`,
            line.pricingMessage ? `Pricing note ${line.pricingMessage}` : undefined,
            `Dx ${(line.icdCodes ?? []).join(', ') || '-'}`,
            `Pointers ${(line.icdPointers ?? []).map(String).join(', ') || '-'}`,
            `Modifiers ${(line.modifiers ?? []).join(', ') || '-'}`,
            `Rendering provider ${formatReferenceLabel(referenceOptions.providers, line.renderingProviderId)}`,
          ].filter(Boolean).join(' | ')).join('\n') : '-'],
        ])}
      </section>
    </div>
  )
}

export function renderChargeGridItem(item: Charge, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getChargeRowLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">patient ID</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">charge Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.chargeStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
