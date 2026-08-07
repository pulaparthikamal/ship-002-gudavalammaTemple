import type { FeeSchedule, FeeScheduleFormValues, FeeScheduleCreatePayload } from '@/types/feeSchedule'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from './rcmReferenceOptions'
import { Badge } from '@/components/ui/badge'
import { formatCurrency } from '@/utils/format'
import { formatDate } from '@/utils/date'
import { z } from 'zod'

export const feeScheduleApiDetails = {
  endpoint: 'rcm/fee-schedules',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
  filterQueryParam: 'filter',
}

const optionalDateFormValue = z.preprocess((value) => {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    return trimmedValue || undefined
  }

  return value == null ? undefined : value
}, z.string().optional())

const procedureCodePattern = /^[A-Z0-9]{5}$/i
const modifierPattern = /^[A-Z0-9]{2}$/i

export const feeScheduleFormSchema = z.object({
  payerId: z.string().trim().min(1, 'Payer ID is required.'),
  cptCode: z.string().trim().min(1, 'CPT/HCPCS code is required.').transform((value) => value.toUpperCase()),
  modifiers: z.preprocess(
    (value) => Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
    z.array(z.string().trim().transform((value) => value.toUpperCase())).optional(),
  ),
  providerId: z.string().optional(),
  facilityId: z.string().optional(),
  state: z.string().trim().optional().transform((value) => value?.toUpperCase()),
  placeOfServiceCode: z.string().trim().optional(),
  planName: z.string().trim().optional(),
  groupNumber: z.string().trim().optional(),
  network: z.string().trim().optional(),
  coverageType: z.string().trim().optional(),
  allowedAmount: z.coerce.number().min(0, 'Allowed amount must be zero or greater.'),
  effectiveDate: optionalDateFormValue,
  expiryDate: optionalDateFormValue,
  active: z.boolean(),
}).superRefine((value, context) => {
  if (!procedureCodePattern.test(value.cptCode)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Procedure code must be a single 5-character CPT, HCPCS, or CDT code.',
      path: ['cptCode'],
    })
  }

  const invalidModifier = (value.modifiers ?? []).find((modifier) => !modifierPattern.test(modifier))
  if (invalidModifier) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Modifier ${invalidModifier} must be a 2-character alphanumeric value.`,
      path: ['modifiers'],
    })
  }

  const effectiveDate = value.effectiveDate ? new Date(value.effectiveDate) : null
  const expiryDate = value.expiryDate ? new Date(value.expiryDate) : null
  if (
    effectiveDate &&
    expiryDate &&
    !Number.isNaN(effectiveDate.getTime()) &&
    !Number.isNaN(expiryDate.getTime()) &&
    expiryDate.getTime() < effectiveDate.getTime()
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Expiry date must be on or after the effective date.',
      path: ['expiryDate'],
    })
  }
}) as z.ZodType<FeeScheduleFormValues>

export const feeScheduleDefaultValues: FeeScheduleFormValues = {
  payerId: '',
  cptCode: '',
  modifiers: [],
  providerId: '',
  facilityId: '',
  state: '',
  placeOfServiceCode: '',
  planName: '',
  groupNumber: '',
  network: '',
  coverageType: '',
  allowedAmount: 0,
  effectiveDate: '',
  expiryDate: '',
  active: true,
}

const stateOptions = [
  { label: 'Any state', value: '' },
  ...[
    'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
    'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
    'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
    'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
    'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
    'DC',
  ].map((state) => ({ label: state, value: state })),
]

const placeOfServiceOptions = [
  { label: 'Any POS', value: '' },
  { label: '02 - Telehealth other than home', value: '02' },
  { label: '10 - Telehealth in patient home', value: '10' },
  { label: '11 - Office', value: '11' },
  { label: '12 - Home', value: '12' },
  { label: '19 - Off-campus outpatient hospital', value: '19' },
  { label: '21 - Inpatient hospital', value: '21' },
  { label: '22 - Outpatient hospital', value: '22' },
  { label: '23 - Emergency room', value: '23' },
  { label: '24 - Ambulatory surgical center', value: '24' },
  { label: '31 - Skilled nursing facility', value: '31' },
  { label: '32 - Nursing facility', value: '32' },
]

const networkOptions = [
  { label: 'Any network', value: '' },
  { label: 'In network', value: 'IN_NETWORK' },
  { label: 'Out of network', value: 'OUT_OF_NETWORK' },
  { label: 'Tier 1', value: 'TIER_1' },
  { label: 'Tier 2', value: 'TIER_2' },
]

const coverageTypeOptions = [
  { label: 'Any coverage type', value: '' },
  { label: 'Primary', value: 'PRIMARY' },
  { label: 'Secondary', value: 'SECONDARY' },
  { label: 'Tertiary', value: 'TERTIARY' },
  { label: 'Commercial', value: 'COMMERCIAL' },
  { label: 'Dental', value: 'DENTAL' },
  { label: 'Medicare', value: 'MEDICARE' },
  { label: 'Medicaid', value: 'MEDICAID' },
]

function formatAny(value: string | undefined, fallback: string) {
  return value?.trim() ? value : fallback
}

function formatOptionalReference(
  options: RcmReferenceOptions[keyof RcmReferenceOptions],
  value: string | undefined,
  fallback: string,
) {
  return value?.trim() ? formatReferenceLabel(options, value) : fallback
}

function formatDatePayload(value: FeeScheduleFormValues['effectiveDate']) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }

  if (typeof value === 'string') {
    return value.trim() || undefined
  }

  return undefined
}

export function createFeeScheduleTableColumns(
  options: RcmReferenceOptions,
): CrudTableColumn<FeeSchedule>[] {
  return [
    {
      header: 'Payer',
      accessorKey: 'payerId',
      sortable: true,
      filterable: true,
      cell: (_value, item) => formatReferenceLabel(options.payers, item.payerId),
    },
    {
      header: 'Procedure',
      accessorKey: 'cptCode',
      sortable: true,
      filterable: true,
      cell: (_value, item) => formatReferenceLabel(options.chargeMasterCodes, item.cptCode),
    },
    {
      header: 'Modifiers',
      accessorKey: 'modifiers',
      cell: (_value, item) => item.modifiers?.length ? item.modifiers.join(', ') : 'Any',
    },
    {
      header: 'Provider / Facility',
      accessorKey: 'providerId',
      cell: (_value, item) =>
        [
          formatOptionalReference(options.providers, item.providerId, 'Any provider'),
          formatOptionalReference(options.facilities, item.facilityId, 'Any facility'),
        ].join(' / '),
    },
    {
      header: 'State / POS',
      accessorKey: 'state',
      sortable: true,
      filterable: true,
      cell: (_value, item) => `${formatAny(item.state, 'Any state')} / ${formatAny(item.placeOfServiceCode, 'Any POS')}`,
    },
    {
      header: 'Plan / Group / Network',
      accessorKey: 'planName',
      sortable: true,
      filterable: true,
      cell: (_value, item) => [item.planName, item.groupNumber, item.network].filter(Boolean).join(' / ') || 'Any',
    },
    {
      header: 'Allowed Amount',
      accessorKey: 'allowedAmount',
      sortable: true,
      cell: (value) => formatCurrency(Number(value)),
    },
    {
      header: 'Effective',
      accessorKey: 'effectiveDate',
      sortable: true,
      cell: (_value, item) =>
        `${item.effectiveDate ? formatDate(String(item.effectiveDate)) : 'No start'} - ${
          item.expiryDate ? formatDate(String(item.expiryDate)) : 'No end'
        }`,
    },
    {
      header: 'Status',
      accessorKey: 'active',
      cell: (value) => (
        <Badge variant={value ? 'success' : 'secondary'}>
          {value ? 'Active' : 'Inactive'}
        </Badge>
      ),
    },
  ]
}

export function createFeeScheduleFormConfig(
  options: RcmReferenceOptions,
): CrudFormConfig<FeeScheduleFormValues> {
  return {
    schema: feeScheduleFormSchema,
    defaultValues: feeScheduleDefaultValues,
    columns: 2,
    fields: [
      {
        name: 'payerId',
        label: 'Payer',
        type: 'autocomplete',
        section: 'Contract Match',
        placeholder: 'Select payer or enter payer business ID',
        helperText: 'Stored as payer business key, for example AETNA, BCBS, PAY-002.',
        options: options.payers ?? [],
        autocomplete: {
          dropdown: true,
          forceSelection: false,
          emptyMessage: 'No payers found',
          minLength: 0,
        },
        required: true,
      },
      {
        name: 'cptCode',
        label: 'Procedure / CPT / HCPCS Code',
        type: 'autocomplete',
        section: 'Contract Match',
        placeholder: '99213, D1110, D0120',
        helperText: 'This code is matched against claim lines during pricing.',
        options: options.chargeMasterCodes ?? [],
        autocomplete: {
          dropdown: true,
          forceSelection: false,
          emptyMessage: 'No procedure codes found',
          minLength: 0,
        },
        required: true,
      },
      {
        name: 'modifiers',
        label: 'Modifiers',
        type: 'tags',
        section: 'Contract Match',
        placeholder: '25, 59',
        helperText: 'Leave blank when the rate applies to any modifier set.',
      },
      {
        name: 'providerId',
        label: 'Rendering Provider',
        type: 'autocomplete',
        section: 'Contract Match',
        placeholder: 'Any provider',
        helperText: 'Leave blank when the rate applies to all providers.',
        options: [{ label: 'Any provider', value: '' }, ...(options.providers ?? [])],
        autocomplete: {
          dropdown: true,
          forceSelection: true,
          emptyMessage: 'No providers found',
          minLength: 0,
        },
      },
      {
        name: 'facilityId',
        label: 'Facility / Location',
        type: 'autocomplete',
        section: 'Contract Match',
        placeholder: 'Any facility',
        helperText: 'Leave blank when the rate applies to all facilities.',
        options: [{ label: 'Any facility', value: '' }, ...(options.facilities ?? [])],
        autocomplete: {
          dropdown: true,
          forceSelection: true,
          emptyMessage: 'No facilities found',
          minLength: 0,
        },
      },
      {
        name: 'state',
        label: 'Service State',
        type: 'select',
        section: 'Location / Plan Specificity',
        placeholder: 'Any state',
        options: stateOptions,
        helperText: 'State-specific rates should use the service facility state.',
      },
      {
        name: 'placeOfServiceCode',
        label: 'Place of Service',
        type: 'select',
        section: 'Location / Plan Specificity',
        placeholder: 'Any POS',
        options: placeOfServiceOptions,
        helperText: 'POS 11 is Office.',
      },
      {
        name: 'planName',
        label: 'Plan Name',
        type: 'text',
        section: 'Location / Plan Specificity',
        placeholder: 'Optional plan/product name',
        helperText: 'Leave blank when rate applies to all plans.',
      },
      {
        name: 'groupNumber',
        label: 'Group Number',
        type: 'text',
        section: 'Location / Plan Specificity',
        placeholder: 'Optional employer/group number',
        helperText: 'Use only when rates vary by group.',
      },
      {
        name: 'network',
        label: 'Network',
        type: 'select',
        section: 'Location / Plan Specificity',
        placeholder: 'Any network',
        options: networkOptions,
      },
      {
        name: 'coverageType',
        label: 'Coverage Type / Priority',
        type: 'select',
        section: 'Location / Plan Specificity',
        placeholder: 'Any coverage type',
        options: coverageTypeOptions,
      },
      {
        name: 'allowedAmount',
        label: 'Contract Allowed Amount',
        type: 'number',
        section: 'Pricing',
        placeholder: '0.00',
        helperText: 'Allowed amount is the expected payer contract rate, not the chargemaster billed amount.',
        min: 0,
        step: 0.01,
        required: true,
      },
      {
        name: 'effectiveDate',
        label: 'Effective Date',
        type: 'date',
        section: 'Pricing',
      },
      {
        name: 'expiryDate',
        label: 'Expiry Date',
        type: 'date',
        section: 'Pricing',
      },
      {
        name: 'active',
        label: 'Active Contract Rate',
        type: 'switch',
        section: 'Pricing',
      },
    ],
  }
}

export function mapFeeScheduleToFormValues(item: FeeSchedule): FeeScheduleFormValues {
  return {
    payerId: item.payerId ?? '',
    cptCode: item.cptCode ?? '',
    modifiers: item.modifiers ?? [],
    providerId: item.providerId ?? '',
    facilityId: item.facilityId ?? '',
    state: item.state ?? '',
    placeOfServiceCode: item.placeOfServiceCode ?? '',
    planName: item.planName ?? '',
    groupNumber: item.groupNumber ?? '',
    network: item.network ?? '',
    coverageType: item.coverageType ?? '',
    allowedAmount: item.allowedAmount,
    effectiveDate: item.effectiveDate ?? '',
    expiryDate: item.expiryDate ?? '',
    active: item.active,
  }
}

export function mapFeeScheduleFormToPayload(values: FeeScheduleFormValues): FeeScheduleCreatePayload {
  return {
    ...values,
    cptCode: values.cptCode.trim().toUpperCase(),
    modifiers: values.modifiers?.map((modifier) => modifier.trim().toUpperCase()).filter(Boolean) ?? [],
    providerId: values.providerId?.trim() || undefined,
    facilityId: values.facilityId?.trim() || undefined,
    state: values.state?.trim().toUpperCase() || undefined,
    placeOfServiceCode: values.placeOfServiceCode?.trim() || undefined,
    planName: values.planName?.trim() || undefined,
    groupNumber: values.groupNumber?.trim() || undefined,
    network: values.network?.trim() || undefined,
    coverageType: values.coverageType?.trim() || undefined,
    effectiveDate: formatDatePayload(values.effectiveDate),
    expiryDate: formatDatePayload(values.expiryDate),
  }
}

export function getFeeScheduleRowLabel(item: FeeSchedule, options: RcmReferenceOptions = {}) {
  return [
    formatReferenceLabel(options.payers, item.payerId),
    formatReferenceLabel(options.chargeMasterCodes, item.cptCode),
    item.state,
    item.placeOfServiceCode ? `POS ${item.placeOfServiceCode}` : undefined,
  ].filter(Boolean).join(' - ')
}

export function renderFeeScheduleDetails(item: FeeSchedule, options: RcmReferenceOptions) {
  const details = [
    ['Payer', formatReferenceLabel(options.payers, item.payerId)],
    ['Procedure / CPT / HCPCS', formatReferenceLabel(options.chargeMasterCodes, item.cptCode)],
    ['Modifiers', item.modifiers?.length ? item.modifiers.join(', ') : 'Any modifiers'],
    ['Contract allowed amount', formatCurrency(item.allowedAmount)],
    ['Rendering provider', formatOptionalReference(options.providers, item.providerId, 'Any provider')],
    ['Facility / location', formatOptionalReference(options.facilities, item.facilityId, 'Any facility')],
    ['Service state', item.state || 'Any state'],
    ['Place of service', item.placeOfServiceCode || 'Any POS'],
    ['Plan name', item.planName || 'Any plan'],
    ['Group number', item.groupNumber || 'Any group'],
    ['Network', item.network || 'Any network'],
    ['Coverage type / priority', item.coverageType || 'Any coverage type'],
    ['Effective date', item.effectiveDate ? formatDate(String(item.effectiveDate)) : 'No start date'],
    ['Expiry date', item.expiryDate ? formatDate(String(item.expiryDate)) : 'No end date'],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
            <dd className="mt-2 text-sm font-medium text-[var(--color-text-strong)]">{value}</dd>
          </div>
        ))}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Status</dt>
          <dd className="mt-2">
            <Badge variant={item.active ? 'success' : 'secondary'}>{item.active ? 'Active' : 'Inactive'}</Badge>
          </dd>
        </div>
      </div>
    </div>
  )
}
