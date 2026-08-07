import { z } from 'zod'
import { npiPattern, phonePattern, taxIdPattern, taxonomyCodePattern } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Provider, ProviderCreatePayload, ProviderFormValues } from '@/types/provider'

export const providerApiDetails = {
  endpoint: '/rcm/providers',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const providerTypeOptions = [
  'Physician',
  'Nurse Practitioner',
  'Physician Assistant',
  'Therapist',
  'Behavioral Health',
  'Ancillary',
  'Other',
]

const optionalPhoneField = z
  .string()
  .trim()
  .refine((value) => !value || phonePattern.test(value), 'Enter a valid phone number')

export const providerFormSchema = z
  .object({
    _id: z.string().optional(),
    firstName: z.string().trim().min(1, 'First name is required'),
    lastName: z.string().trim().min(1, 'Last name is required'),
    credentials: z.string().trim(),
    specialty: z.string().trim(),
    npi: z.string().trim().regex(npiPattern, 'NPI must be 10 digits'),
    taxId: z
      .string()
      .trim()
      .refine((value) => !value || taxIdPattern.test(value), 'Tax ID must be 9 digits'),
    taxonomyCode: z
      .string()
      .trim()
      .refine((value) => !value || taxonomyCodePattern.test(value), 'Taxonomy code must be 10 digits followed by 1 letter'),
    licenseNumber: z.string().trim(),
    deaNumber: z.string().trim(),
    providerType: z.string().trim().min(1, 'Provider type is required'),
    phone: optionalPhoneField,
    fax: optionalPhoneField,
    email: z.string().trim().email('Enter a valid email address').or(z.literal('')),
    activeFlag: z.boolean(),
    billingProviderFlag: z.boolean(),
    renderingProviderFlag: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if ((value.billingProviderFlag || value.renderingProviderFlag) && !value.activeFlag) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Billing or rendering providers must be marked active.',
        path: ['activeFlag'],
      })
    }

    if ((value.billingProviderFlag || value.renderingProviderFlag) && !value.taxonomyCode.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Taxonomy code is required when a provider can bill or render claim services.',
        path: ['taxonomyCode'],
      })
    }
  }) as z.ZodType<ProviderFormValues>

export const providerDefaultValues: ProviderFormValues = {
  _id: '',
  firstName: '',
  lastName: '',
  credentials: '',
  specialty: '',
  npi: '',
  taxId: '',
  taxonomyCode: '',
  licenseNumber: '',
  deaNumber: '',
  providerType: '',
  phone: '',
  fax: '',
  email: '',
  activeFlag: false,
  billingProviderFlag: false,
  renderingProviderFlag: false,
  active: true,
}

export function createProviderFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ProviderFormValues> {
  void referenceOptions
  return {
    schema: providerFormSchema,
    defaultValues: providerDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'firstName',
        label: 'First name',
        section: 'Provider',
        type: 'text',
        placeholder: 'First name',
      },
      {
        name: 'lastName',
        label: 'Last name',
        section: 'Provider',
        type: 'text',
        placeholder: 'Last name',
      },
      {
        name: 'credentials',
        label: 'Credentials',
        section: 'Provider',
        type: 'text',
        placeholder: 'MD, DO, NP, PA-C',
      },
      {
        name: 'specialty',
        label: 'Specialty',
        section: 'Provider',
        type: 'text',
        placeholder: 'Cardiology, Internal Medicine, etc.',
      },
      {
        name: 'providerType',
        label: 'Provider type',
        section: 'Provider',
        type: 'select',
        placeholder: 'Select provider type',
        options: providerTypeOptions.map((value) => ({ label: value, value })),
      },
      {
        name: 'npi',
        label: 'NPI',
        section: 'Identifiers',
        type: 'text',
        placeholder: '10-digit NPI',
      },
      {
        name: 'taxId',
        label: 'Tax ID',
        section: 'Identifiers',
        type: 'text',
        placeholder: 'Optional billing tax ID',
      },
      {
        name: 'taxonomyCode',
        label: 'Taxonomy code',
        section: 'Identifiers',
        type: 'text',
        placeholder: 'Optional taxonomy code',
      },
      {
        name: 'licenseNumber',
        label: 'License number',
        section: 'Identifiers',
        type: 'text',
        placeholder: 'State license number',
      },
      {
        name: 'deaNumber',
        label: 'DEA number',
        section: 'Identifiers',
        type: 'text',
        placeholder: 'Optional DEA number',
      },
      {
        name: 'phone',
        label: 'Phone',
        section: 'Contact',
        type: 'text',
        placeholder: 'Primary phone',
      },
      {
        name: 'fax',
        label: 'Fax',
        section: 'Contact',
        type: 'text',
        placeholder: 'Fax number',
      },
      {
        name: 'email',
        label: 'Email',
        section: 'Contact',
        type: 'email',
        placeholder: 'provider@example.com',
      },
      {
        name: 'activeFlag',
        label: 'Scheduling active',
        section: 'Roles',
        type: 'switch',
      },
      {
        name: 'billingProviderFlag',
        label: 'Can bill claims',
        section: 'Roles',
        type: 'switch',
      },
      {
        name: 'renderingProviderFlag',
        label: 'Can render services',
        section: 'Roles',
        type: 'switch',
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

export function mapProviderToFormValues(item: Provider): ProviderFormValues {
  return {
    _id: item._id,
    firstName: item.firstName ?? '',
    lastName: item.lastName ?? '',
    credentials: item.credentials ?? '',
    specialty: item.specialty ?? '',
    npi: item.npi ?? '',
    taxId: item.taxId ?? '',
    taxonomyCode: item.taxonomyCode ?? '',
    licenseNumber: item.licenseNumber ?? '',
    deaNumber: item.deaNumber ?? '',
    providerType: item.providerType ?? '',
    phone: item.phone ?? '',
    fax: item.fax ?? '',
    email: item.email ?? '',
    activeFlag: item.activeFlag,
    billingProviderFlag: item.billingProviderFlag,
    renderingProviderFlag: item.renderingProviderFlag,
    active: item.active,
  }
}

export function mapProviderFormToPayload(values: ProviderFormValues): ProviderCreatePayload {
  return {
    firstName: optionalText(values.firstName),
    lastName: optionalText(values.lastName),
    credentials: optionalText(values.credentials),
    specialty: optionalText(values.specialty),
    npi: optionalText(values.npi),
    taxId: optionalText(values.taxId),
    taxonomyCode: optionalText(values.taxonomyCode),
    licenseNumber: optionalText(values.licenseNumber),
    deaNumber: optionalText(values.deaNumber),
    providerType: optionalText(values.providerType),
    phone: optionalText(values.phone),
    fax: optionalText(values.fax),
    email: optionalText(values.email),
    activeFlag: values.activeFlag,
    billingProviderFlag: values.billingProviderFlag,
    renderingProviderFlag: values.renderingProviderFlag,
    active: values.active,
  }
}

function getProviderLabel(item: Provider, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.firstName, item.lastName].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createProviderTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Provider>> {
  return [
    {
      key: 'record',
      header: 'Provider',
      sortField: 'firstName',
      exportValue: (item) => getProviderLabel(item, referenceOptions),
      render: (item) => getProviderLabel(item, referenceOptions),
    },
    {
      key: 'npi',
      header: 'NPI',
      sortField: 'npi',
      field: 'npi',
      exportValue: (item) => item.npi ?? '',
      render: (item) => item.npi ?? '-',
    },
    {
      key: 'providerType',
      header: 'Type',
      filterable: true,
      sortField: 'providerType',
      field: 'providerType',
      exportValue: (item) => item.providerType ?? '',
      render: (item) => item.providerType ?? '-',
    },
    {
      key: 'roles',
      header: 'Roles',
      exportValue: (item) => [
        item.billingProviderFlag ? 'Billing' : undefined,
        item.renderingProviderFlag ? 'Rendering' : undefined,
      ].filter(Boolean).join(', '),
      render: (item) => [
        item.billingProviderFlag ? 'Billing' : undefined,
        item.renderingProviderFlag ? 'Rendering' : undefined,
      ].filter(Boolean).join(', ') || '-',
    },
    {
      key: 'activeFlag',
      header: 'Status',
      sortField: 'activeFlag',
      exportValue: (item) => item.activeFlag ? 'Active' : 'Inactive',
      render: (item) => item.activeFlag ? 'Active' : 'Inactive',
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

export function renderProviderDetails(item: Provider, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Provider</h3>
        {renderSection([
          ['provider ID', item.providerId],
          ['first Name', item.firstName ?? '-'],
          ['last Name', item.lastName ?? '-'],
          ['credentials', item.credentials ?? '-'],
          ['specialty', item.specialty ?? '-'],
          ['npi', item.npi ?? '-'],
          ['tax ID', item.taxId ?? '-'],
          ['taxonomy Code', item.taxonomyCode ?? '-'],
          ['license Number', item.licenseNumber ?? '-'],
          ['dea Number', item.deaNumber ?? '-'],
          ['provider Type', item.providerType ?? '-'],
          ['phone', item.phone ?? '-'],
          ['fax', item.fax ?? '-'],
          ['email', item.email ?? '-'],
          ['active Flag', formatBoolean(item.activeFlag)],
          ['billing Provider Flag', formatBoolean(item.billingProviderFlag)],
          ['rendering Provider Flag', formatBoolean(item.renderingProviderFlag)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderProviderGridItem(item: Provider, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getProviderLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
      </dl>
    </div>
  )
}
