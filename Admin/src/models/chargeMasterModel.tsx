import { z } from 'zod'
import {
  cptCodePattern,
  icd10CodePattern,
  isNonNegativeNumber,
  isPositiveNumber,
  placeOfServicePattern,
  splitMultiValueText,
} from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ChargeMaster, ChargeMasterCreatePayload, ChargeMasterFormValues } from '@/types/chargeMaster'

export const chargeMasterApiDetails = {
  endpoint: '/rcm/charge-masters',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const revenueCodePattern = /^\d{4}$/
const modifierPattern = /^[A-Z0-9]{2}$/i

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

const placeOfServiceOptions = createSelectOptions([
  { label: '11 - Office', value: '11' },
  { label: '19 - Off Campus Outpatient Hospital', value: '19' },
  { label: '22 - On Campus Outpatient Hospital', value: '22' },
  { label: '24 - Ambulatory Surgical Center', value: '24' },
  { label: '10 - Telehealth in Patient Home', value: '10' },
  { label: '02 - Telehealth Other than Home', value: '02' },
  { label: '49 - Independent Clinic', value: '49' },
])

export const chargeMasterFormSchema: z.ZodType<ChargeMasterFormValues> = z.object({
  _id: z.string().optional(),
  cptCode: z.string().trim().min(1, 'CPT/HCPCS code is required'),
  description: z.string().trim().min(1, 'Description is required'),
  revenueCode: z.string().trim(),
  defaultChargeAmount: z.number().nullable(),
  defaultAllowedAmount: z.number().nullable(),
  placeOfService: z.string().trim().min(1, 'Place of service is required'),
  modifiersAllowed: z.string().trim(),
  diagnosisRestrictions: z.string().trim(),
  effectiveDate: z.date().nullable(),
  terminationDate: z.date().nullable(),
}).superRefine((value, context) => {
  if (!cptCodePattern.test(value.cptCode.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'CPT/HCPCS code must be a valid 5-character code.',
      path: ['cptCode'],
    })
  }

  if (value.revenueCode.trim() && !revenueCodePattern.test(value.revenueCode.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Revenue code must be a valid 4-digit code.',
      path: ['revenueCode'],
    })
  }

  if (!placeOfServicePattern.test(value.placeOfService.trim())) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Place of service must be a valid 2-digit code.',
      path: ['placeOfService'],
    })
  }

  if (!value.effectiveDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Effective date is required.',
      path: ['effectiveDate'],
    })
  }

  if (!isPositiveNumber(value.defaultChargeAmount)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Default charge amount must be greater than 0.',
      path: ['defaultChargeAmount'],
    })
  }

  if (value.defaultAllowedAmount !== null && !isNonNegativeNumber(value.defaultAllowedAmount)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Default allowed amount must be 0 or greater.',
      path: ['defaultAllowedAmount'],
    })
  }

  if (
    isPositiveNumber(value.defaultChargeAmount)
    && isNonNegativeNumber(value.defaultAllowedAmount)
    && value.defaultAllowedAmount > value.defaultChargeAmount
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Default allowed amount should not exceed the default charge amount.',
      path: ['defaultAllowedAmount'],
    })
  }

  if (
    value.effectiveDate
    && value.terminationDate
    && value.terminationDate.getTime() < value.effectiveDate.getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Termination date must be on or after the effective date.',
      path: ['terminationDate'],
    })
  }

  const modifiers = splitMultiValueText(value.modifiersAllowed)
  const invalidModifiers = modifiers.filter((modifier) => !modifierPattern.test(modifier))

  if (invalidModifiers.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Modifier(s) must be 2-character alphanumeric values: ${invalidModifiers.join(', ')}`,
      path: ['modifiersAllowed'],
    })
  }

  const diagnosisRestrictions = splitMultiValueText(value.diagnosisRestrictions)
  const invalidDiagnosisRestrictions = diagnosisRestrictions.filter((code) => !icd10CodePattern.test(code))

  if (invalidDiagnosisRestrictions.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Diagnosis restriction(s) must be valid ICD-10 codes: ${invalidDiagnosisRestrictions.join(', ')}`,
      path: ['diagnosisRestrictions'],
    })
  }
})

export const chargeMasterDefaultValues: ChargeMasterFormValues = {
  _id: '',
  cptCode: '',
  description: '',
  revenueCode: '',
  defaultChargeAmount: null,
  defaultAllowedAmount: null,
  placeOfService: '',
  modifiersAllowed: '',
  diagnosisRestrictions: '',
  effectiveDate: null,
  terminationDate: null,
}

export function createChargeMasterFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ChargeMasterFormValues> {
  void referenceOptions

  return {
    schema: chargeMasterFormSchema,
    defaultValues: chargeMasterDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'cptCode',
        label: 'CPT/HCPCS Code',
        type: 'text',
        placeholder: '99213',
        helperText: 'Required. Use the 5-character CPT or HCPCS code that should default into charge entry.',
      },
      {
        name: 'placeOfService',
        label: 'Place of Service',
        type: 'select',
        placeholder: 'Select POS',
        options: placeOfServiceOptions,
        helperText: 'Required. POS drives payer edits and claim defaults.',
      },
      {
        name: 'description',
        label: 'Description',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        placeholder: 'Established patient office visit, level 3',
      },
      {
        name: 'defaultChargeAmount',
        label: 'Default Charge Amount',
        type: 'number',
        min: 0,
        step: 0.01,
        helperText: 'Required. This is the standard billed amount that should default when the code is selected.',
      },
      {
        name: 'defaultAllowedAmount',
        label: 'Default Allowed Amount',
        type: 'number',
        min: 0,
        step: 0.01,
        helperText: 'Optional. Use this for expected reimbursement modeling or payer variance review.',
      },
      {
        name: 'revenueCode',
        label: 'Revenue Code',
        type: 'text',
        placeholder: '0450',
        helperText: 'Optional. Stored for reference and downstream reporting; institutional claim construction is not derived from this field in the current workflow.',
      },
      {
        name: 'effectiveDate',
        label: 'Effective Date',
        type: 'date',
        date: {
          showButtonBar: true,
        },
      },
      {
        name: 'terminationDate',
        label: 'Termination Date',
        type: 'date',
        date: {
          showButtonBar: true,
        },
        helperText: 'Optional. Set when a code or rate should stop defaulting after a specific date.',
      },
      {
        name: 'modifiersAllowed',
        label: 'Allowed Modifiers',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Optional. Enter one 2-character modifier per line or separate them with commas.',
        placeholder: '25\n59',
      },
      {
        name: 'diagnosisRestrictions',
        label: 'Diagnosis Restrictions',
        type: 'textarea',
        rows: 3,
        fullWidth: true,
        helperText: 'Optional. Use ICD-10 codes when this charge should only default for covered diagnoses or LCD/NCD edits.',
        placeholder: 'M54.50\nR10.9',
      },
    ],
  }
}

export function optionalText(value: string) {
  const trimmedValue = value.trim()
  return trimmedValue ? trimmedValue : undefined
}

export function optionalUppercaseText(value: string) {
  const trimmedValue = value.trim().toUpperCase()
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

export function formatCurrency(value?: number | null) {
  if (typeof value !== 'number') {
    return '-'
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function parseUppercaseStringList(value: string) {
  const values = splitMultiValueText(value).map((item) => item.toUpperCase())
  return values.length ? values : undefined
}

export function formatStringList(value: string[] = []) {
  return value.join('\n')
}

export function getChargeMasterStatus(item: Pick<ChargeMaster, 'effectiveDate' | 'terminationDate'>) {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const effectiveDate = toFormDate(item.effectiveDate)
  const terminationDate = toFormDate(item.terminationDate)

  if (effectiveDate && effectiveDate.getTime() > todayStart.getTime()) {
    return 'Future'
  }

  if (terminationDate && terminationDate.getTime() < todayStart.getTime()) {
    return 'Expired'
  }

  return 'Active'
}

export function mapChargeMasterToFormValues(item: ChargeMaster): ChargeMasterFormValues {
  return {
    _id: item._id,
    cptCode: item.cptCode ?? '',
    description: item.description ?? '',
    revenueCode: item.revenueCode ?? '',
    defaultChargeAmount: item.defaultChargeAmount ?? null,
    defaultAllowedAmount: item.defaultAllowedAmount ?? null,
    placeOfService: item.placeOfService ?? '',
    modifiersAllowed: formatStringList(item.modifiersAllowed),
    diagnosisRestrictions: formatStringList(item.diagnosisRestrictions),
    effectiveDate: toFormDate(item.effectiveDate),
    terminationDate: toFormDate(item.terminationDate),
  }
}

export function mapChargeMasterFormToPayload(values: ChargeMasterFormValues): ChargeMasterCreatePayload {
  return {
    cptCode: optionalUppercaseText(values.cptCode),
    description: optionalText(values.description),
    revenueCode: optionalText(values.revenueCode),
    defaultChargeAmount: optionalNumber(values.defaultChargeAmount),
    defaultAllowedAmount: optionalNumber(values.defaultAllowedAmount),
    placeOfService: optionalText(values.placeOfService),
    modifiersAllowed: parseUppercaseStringList(values.modifiersAllowed),
    diagnosisRestrictions: parseUppercaseStringList(values.diagnosisRestrictions),
    effectiveDate: optionalDate(values.effectiveDate),
    terminationDate: optionalDate(values.terminationDate),
  }
}

export function getChargeMasterLabel(item: ChargeMaster, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.cptCode, item.description].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createChargeMasterTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<ChargeMaster>> {
  void referenceOptions

  return [
    {
      key: 'cptCode',
      header: 'CPT/HCPCS',
      filterable: true,
      sortField: 'cptCode',
      exportValue: (item) => item.cptCode ?? '',
      render: (item) => item.cptCode ?? '-',
    },
    {
      key: 'description',
      header: 'Description',
      sortField: 'description',
      exportValue: (item) => item.description ?? '',
      render: (item) => item.description ?? '-',
    },
    {
      key: 'placeOfService',
      header: 'POS',
      sortField: 'placeOfService',
      exportValue: (item) => item.placeOfService ?? '',
      render: (item) => item.placeOfService ?? '-',
    },
    {
      key: 'defaultChargeAmount',
      header: 'Default Charge',
      filterable: true,
      sortField: 'defaultChargeAmount',
      exportValue: (item) => formatCurrency(item.defaultChargeAmount),
      render: (item) => formatCurrency(item.defaultChargeAmount),
    },
    {
      key: 'effectiveDate',
      header: 'Effective',
      filterable: true,
      sortField: 'effectiveDate',
      exportValue: (item) => formatDate(item.effectiveDate),
      render: (item) => formatDate(item.effectiveDate),
    },
    {
      key: 'status',
      header: 'Status',
      filterable: true,
      sortField: 'terminationDate',
      exportValue: (item) => getChargeMasterStatus(item),
      render: (item) => getChargeMasterStatus(item),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      sortField: 'updated',
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

export function renderChargeMasterDetails(item: ChargeMaster, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Charge Master</h3>
        {renderSection([
          ['Charge Master ID', item.chargeMasterId],
          ['CPT/HCPCS Code', item.cptCode ?? '-'],
          ['Description', item.description ?? '-'],
          ['Revenue Code', item.revenueCode ?? '-'],
          ['Place of Service', item.placeOfService ?? '-'],
          ['Default Charge Amount', formatCurrency(item.defaultChargeAmount)],
          ['Default Allowed Amount', formatCurrency(item.defaultAllowedAmount)],
          ['Allowed Modifiers', (item.modifiersAllowed ?? []).join(', ') || '-'],
          ['Diagnosis Restrictions', (item.diagnosisRestrictions ?? []).join(', ') || '-'],
          ['Effective Date', formatDate(item.effectiveDate)],
          ['Termination Date', formatDate(item.terminationDate)],
          ['Status', getChargeMasterStatus(item)],
        ])}
      </section>
    </div>
  )
}

export function renderChargeMasterGridItem(item: ChargeMaster, referenceOptions: RcmReferenceOptions = {}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getChargeMasterLabel(item, referenceOptions)}</p>
      <dl className="space-y-2 text-sm text-[var(--color-text-muted)]">
        <div className="flex items-center justify-between gap-3">
          <dt>POS</dt>
          <dd className="font-semibold text-[var(--color-text-strong)]">{item.placeOfService ?? '-'}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Charge</dt>
          <dd className="font-semibold text-[var(--color-text-strong)]">{formatCurrency(item.defaultChargeAmount)}</dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt>Status</dt>
          <dd className="font-semibold text-[var(--color-text-strong)]">{getChargeMasterStatus(item)}</dd>
        </div>
      </dl>
    </div>
  )
}
