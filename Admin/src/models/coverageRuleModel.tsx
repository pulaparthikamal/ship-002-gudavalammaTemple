import { Badge } from '@/components/ui/badge'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { CoverageRule, CoverageRuleCreatePayload, CoverageRuleFormValues } from '@/types/coverageRule'
import { formatDate } from '@/utils/date'
import { z } from 'zod'

const coverageRuleTypeOptions = [
  'AUTH_REQUIRED',
  'REFERRAL_REQUIRED',
  'NOT_COVERED',
  'COVERED',
  'MEDICAL_NECESSITY_REQUIRED',
  'AGE_LIMIT',
  'GENDER_LIMIT',
  'FREQUENCY_LIMIT',
  'DIAGNOSIS_REQUIRED',
  'MODIFIER_REQUIRED',
  'POS_RESTRICTED',
  'NETWORK_RESTRICTED',
].map((value) => ({ label: value.replace(/_/g, ' '), value }))

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

const severityOptions = [
  { label: 'Warning', value: 'WARNING' },
  { label: 'Blocking', value: 'BLOCKING' },
]

export const coverageRuleFormSchema = z.object({
  payerId: z.string().trim(),
  planName: z.string().trim(),
  groupNumber: z.string().trim(),
  state: z.string().trim().transform((value) => value.toUpperCase()),
  facilityId: z.string().trim(),
  providerId: z.string().trim(),
  cptCode: z.string().trim().transform((value) => value.toUpperCase()),
  diagnosisCodes: z.preprocess(
    (value) => Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? value.split(',').map((item) => item.trim()).filter(Boolean)
        : [],
    z.array(z.string().trim().transform((value) => value.toUpperCase())),
  ),
  placeOfServiceCode: z.string().trim(),
  network: z.string().trim(),
  coverageType: z.string().trim(),
  ruleType: z.string().trim().min(1, 'Rule type is required.'),
  severity: z.string().trim().default('WARNING'),
  ruleValue: z.string().trim(),
  effectiveDate: optionalDateFormValue,
  expiryDate: optionalDateFormValue,
  priority: z.coerce.number().min(0, 'Priority must be zero or greater.'),
  activeFlag: z.boolean(),
  active: z.boolean(),
}).superRefine((value, context) => {
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
}) as z.ZodType<CoverageRuleFormValues>

export const coverageRuleDefaultValues: CoverageRuleFormValues = {
  payerId: '',
  planName: '',
  groupNumber: '',
  state: '',
  facilityId: '',
  providerId: '',
  cptCode: '',
  diagnosisCodes: [],
  placeOfServiceCode: '',
  network: '',
  coverageType: '',
  ruleType: 'COVERED',
  severity: 'WARNING',
  ruleValue: '',
  effectiveDate: '',
  expiryDate: '',
  priority: 0,
  activeFlag: true,
  active: true,
}

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

function formatRuleValue(value: CoverageRule['ruleValue']) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  if (typeof value === 'object') {
    return JSON.stringify(value)
  }

  return String(value)
}

export function createCoverageRuleTableColumns(options: RcmReferenceOptions = {}): CrudTableColumn<CoverageRule>[] {
  return [
    {
      header: 'Payer',
      accessorKey: 'payerId',
      sortable: true,
      filterable: true,
      cell: (_value, item) => formatOptionalReference(options.payers, item.payerId, 'Any payer'),
    },
    {
      header: 'Procedure',
      accessorKey: 'cptCode',
      sortable: true,
      filterable: true,
      cell: (_value, item) => formatOptionalReference(options.chargeMasterCodes, item.cptCode, 'Any procedure'),
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
    { header: 'State / POS', accessorKey: 'state', cell: (_value, item) => `${formatAny(item.state, 'Any state')} / ${formatAny(item.placeOfServiceCode, 'Any POS')}` },
    { header: 'Plan / Group / Network', accessorKey: 'planName', cell: (_value, item) => [item.planName, item.groupNumber, item.network].filter(Boolean).join(' / ') || 'Any' },
    { header: 'Rule Type', accessorKey: 'ruleType', sortable: true, filterable: true },
    {
      header: 'Severity',
      accessorKey: 'severity',
      sortable: true,
      cell: (_value, item) => {
        const severity = item.severity || 'WARNING'
        return <Badge variant={severity === 'BLOCKING' ? 'destructive' : 'secondary'}>{severity}</Badge>
      },
    },
    { header: 'Priority', accessorKey: 'priority', sortable: true },
    {
      header: 'Effective',
      accessorKey: 'effectiveDate',
      cell: (_value, item) =>
        `${item.effectiveDate ? formatDate(String(item.effectiveDate)) : 'No start'} - ${
          item.expiryDate ? formatDate(String(item.expiryDate)) : 'No end'
        }`,
    },
    {
      header: 'Status',
      accessorKey: 'activeFlag',
      cell: (value) => <Badge variant={value ? 'success' : 'secondary'}>{value ? 'Enabled' : 'Disabled'}</Badge>,
    },
  ]
}

export function createCoverageRuleFormConfig(options: RcmReferenceOptions = {}): CrudFormConfig<CoverageRuleFormValues> {
  return {
    schema: coverageRuleFormSchema,
    defaultValues: coverageRuleDefaultValues,
    columns: 2,
    fields: [
      {
        name: 'payerId',
        label: 'Payer',
        type: 'autocomplete',
        section: 'Rule Scope',
        placeholder: 'Any payer',
        helperText: 'Leave blank only when the rule is intentionally payer-neutral.',
        options: [{ label: 'Any payer', value: '' }, ...(options.payers ?? [])],
        autocomplete: { dropdown: true, forceSelection: false, emptyMessage: 'No payers found', minLength: 0 },
      },
      {
        name: 'cptCode',
        label: 'Procedure / CPT / HCPCS Code',
        type: 'autocomplete',
        section: 'Rule Scope',
        placeholder: 'Any procedure',
        helperText: 'Uses billable ChargeMaster codes because rules are enforced against charge and claim lines.',
        options: [{ label: 'Any procedure', value: '' }, ...(options.chargeMasterCodes ?? [])],
        autocomplete: { dropdown: true, forceSelection: false, emptyMessage: 'No charge master codes found', minLength: 0 },
      },
      {
        name: 'providerId',
        label: 'Rendering Provider',
        type: 'autocomplete',
        section: 'Rule Scope',
        placeholder: 'Any provider',
        options: [{ label: 'Any provider', value: '' }, ...(options.providers ?? [])],
        autocomplete: { dropdown: true, forceSelection: true, emptyMessage: 'No providers found', minLength: 0 },
      },
      {
        name: 'facilityId',
        label: 'Facility / Location',
        type: 'autocomplete',
        section: 'Rule Scope',
        placeholder: 'Any facility',
        options: [{ label: 'Any facility', value: '' }, ...(options.facilities ?? [])],
        autocomplete: { dropdown: true, forceSelection: true, emptyMessage: 'No facilities found', minLength: 0 },
      },
      { name: 'state', label: 'Service State', type: 'select', section: 'Rule Scope', placeholder: 'Any state', options: stateOptions },
      { name: 'placeOfServiceCode', label: 'Place of Service', type: 'select', section: 'Rule Scope', placeholder: 'Any POS', options: placeOfServiceOptions },
      { name: 'planName', label: 'Plan Name', type: 'text', section: 'Plan / Network', placeholder: 'Optional plan/product name' },
      { name: 'groupNumber', label: 'Group Number', type: 'text', section: 'Plan / Network', placeholder: 'Optional employer/group number' },
      { name: 'network', label: 'Network', type: 'select', section: 'Plan / Network', placeholder: 'Any network', options: networkOptions },
      { name: 'coverageType', label: 'Coverage Type / Priority', type: 'select', section: 'Plan / Network', placeholder: 'Any coverage type', options: coverageTypeOptions },
      { name: 'diagnosisCodes', label: 'Diagnosis Codes', type: 'tags', section: 'Clinical Conditions', placeholder: 'E11.9, I10' },
      { name: 'ruleType', label: 'Rule Type', type: 'select', section: 'Rule Action', options: coverageRuleTypeOptions, required: true },
      {
        name: 'severity',
        label: 'Severity',
        type: 'select',
        section: 'Rule Action',
        options: severityOptions,
        helperText: 'Blocking severity makes advisory rules such as age, gender, and frequency stop claim submission.',
      },
      {
        name: 'ruleValue',
        label: 'Rule Value',
        type: 'textarea',
        section: 'Rule Action',
        rows: 4,
        placeholder: '{"allowedPosCodes":["11"],"message":"Office visits only"}',
        helperText: 'Optional JSON or text value used by specific rule types.',
        fullWidth: true,
      },
      { name: 'priority', label: 'Priority', type: 'number', section: 'Rule Action', min: 0, step: 1, helperText: 'Higher priority rules are evaluated first.' },
      { name: 'effectiveDate', label: 'Effective Date', type: 'date', section: 'Rule Action' },
      { name: 'expiryDate', label: 'Expiry Date', type: 'date', section: 'Rule Action' },
      { name: 'activeFlag', label: 'Rule Enabled', type: 'checkbox', section: 'Rule Action' },
    ],
  }
}

export function mapCoverageRuleToFormValues(item: CoverageRule): CoverageRuleFormValues {
  return {
    payerId: item.payerId ?? '',
    planName: item.planName ?? '',
    groupNumber: item.groupNumber ?? '',
    state: item.state ?? '',
    facilityId: item.facilityId ?? '',
    providerId: item.providerId ?? '',
    cptCode: item.cptCode ?? '',
    diagnosisCodes: item.diagnosisCodes ?? [],
    placeOfServiceCode: item.placeOfServiceCode ?? '',
    network: item.network ?? '',
    coverageType: item.coverageType ?? '',
    ruleType: item.ruleType,
    severity: item.severity ?? 'WARNING',
    ruleValue: typeof item.ruleValue === 'object' ? JSON.stringify(item.ruleValue, null, 2) : item.ruleValue !== undefined ? String(item.ruleValue) : '',
    effectiveDate: item.effectiveDate ?? '',
    expiryDate: item.expiryDate ?? '',
    priority: item.priority ?? 0,
    activeFlag: item.activeFlag ?? true,
    active: item.active ?? true,
  }
}

function parseRuleValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return trimmed
  }
}

function formatDatePayload(value: CoverageRuleFormValues['effectiveDate']) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }

  if (typeof value === 'string') {
    return value.trim() || undefined
  }

  return undefined
}

export function mapCoverageRuleFormToPayload(values: CoverageRuleFormValues): CoverageRuleCreatePayload {
  return {
    payerId: values.payerId.trim() || undefined,
    planName: values.planName.trim() || undefined,
    groupNumber: values.groupNumber.trim() || undefined,
    state: values.state.trim().toUpperCase() || undefined,
    facilityId: values.facilityId.trim() || undefined,
    providerId: values.providerId.trim() || undefined,
    cptCode: values.cptCode.trim().toUpperCase() || undefined,
    diagnosisCodes: values.diagnosisCodes.map((code) => code.trim().toUpperCase()).filter(Boolean),
    placeOfServiceCode: values.placeOfServiceCode.trim() || undefined,
    network: values.network.trim() || undefined,
    coverageType: values.coverageType.trim() || undefined,
    ruleType: values.ruleType,
    severity: values.severity || 'WARNING',
    ruleValue: parseRuleValue(values.ruleValue),
    effectiveDate: formatDatePayload(values.effectiveDate),
    expiryDate: formatDatePayload(values.expiryDate),
    priority: values.priority,
    activeFlag: values.activeFlag,
    active: values.active,
  }
}

export function getCoverageRuleRowLabel(item: CoverageRule, options: RcmReferenceOptions = {}) {
  return [
    formatOptionalReference(options.payers, item.payerId, 'Any payer'),
    formatOptionalReference(options.chargeMasterCodes, item.cptCode, 'Any procedure'),
    item.ruleType,
  ].filter(Boolean).join(' - ')
}

export function renderCoverageRuleDetails(item: CoverageRule, options: RcmReferenceOptions = {}) {
  const details = [
    ['Payer', formatOptionalReference(options.payers, item.payerId, 'Any payer')],
    ['Procedure / CPT / HCPCS', formatOptionalReference(options.chargeMasterCodes, item.cptCode, 'Any procedure')],
    ['Rendering provider', formatOptionalReference(options.providers, item.providerId, 'Any provider')],
    ['Facility / location', formatOptionalReference(options.facilities, item.facilityId, 'Any facility')],
    ['Service state', item.state || 'Any state'],
    ['Place of service', item.placeOfServiceCode || 'Any POS'],
    ['Plan name', item.planName || 'Any plan'],
    ['Group number', item.groupNumber || 'Any group'],
    ['Network', item.network || 'Any network'],
    ['Coverage type / priority', item.coverageType || 'Any coverage type'],
    ['Diagnosis codes', item.diagnosisCodes?.length ? item.diagnosisCodes.join(', ') : 'Any diagnosis'],
    ['Rule type', item.ruleType],
    ['Severity', item.severity || 'WARNING'],
    ['Rule value', formatRuleValue(item.ruleValue)],
    ['Priority', String(item.priority ?? 0)],
    ['Effective date', item.effectiveDate ? formatDate(String(item.effectiveDate)) : 'No start date'],
    ['Expiry date', item.expiryDate ? formatDate(String(item.expiryDate)) : 'No end date'],
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        {details.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</dt>
            <dd className="mt-2 whitespace-pre-wrap break-words text-sm font-medium text-[var(--color-text-strong)]">{value}</dd>
          </div>
        ))}
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <dt className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Status</dt>
          <dd className="mt-2">
            <Badge variant={item.activeFlag !== false && item.active !== false ? 'success' : 'secondary'}>
              {item.activeFlag !== false && item.active !== false ? 'Enabled' : 'Disabled'}
            </Badge>
          </dd>
        </div>
      </div>
    </div>
  )
}
