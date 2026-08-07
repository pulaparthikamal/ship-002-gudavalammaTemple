import { z } from 'zod'
import { npiPattern, phonePattern, placeOfServicePattern, stateCodePattern, taxIdPattern, zipCodePattern } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Facility, FacilityCreatePayload, FacilityFormValues } from '@/types/facility'

export const facilityApiDetails = {
  endpoint: '/rcm/facilities',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const placeOfServiceOptions: CrudSelectOption[] = [
  { label: '11 - Office', value: '11' },
  { label: '19 - Off Campus Outpatient Hospital', value: '19' },
  { label: '22 - On Campus Outpatient Hospital', value: '22' },
  { label: '24 - Ambulatory Surgical Center', value: '24' },
  { label: '49 - Independent Clinic', value: '49' },
  { label: '02 - Telehealth Other than Home', value: '02' },
  { label: '10 - Telehealth in Patient Home', value: '10' },
]

const stateOptions: CrudSelectOption[] = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
].map((state) => ({ label: state, value: state }))

const optionalPhoneField = z
  .string()
  .trim()
  .refine((value) => !value || phonePattern.test(value), 'Enter a valid phone number')

export const facilityFormSchema = z.object({
  _id: z.string().optional(),
  facilityName: z.string().trim().min(1, 'Facility name is required'),
  facilityCode: z.string().trim().min(1, 'Facility code is required'),
  npi: z.string().trim().regex(npiPattern, 'NPI must be 10 digits'),
  taxId: z.string().trim().regex(taxIdPattern, 'Tax ID must be 9 digits'),
  placeOfServiceCode: z.string().trim().regex(placeOfServicePattern, 'Place of service must be a 2-digit code'),
  addressLine1: z.string().trim().min(1, 'Address line 1 is required'),
  addressLine2: z.string().trim(),
  city: z.string().trim().min(1, 'City is required'),
  state: z.string().trim().regex(stateCodePattern, 'Use the 2-letter state code'),
  zipCode: z.string().trim().regex(zipCodePattern, 'Enter a valid ZIP code'),
  phone: optionalPhoneField.refine((value) => Boolean(value), 'Phone is required'),
  fax: optionalPhoneField,
  activeFlag: z.boolean(),
  active: z.boolean(),
}) as z.ZodType<FacilityFormValues>

export const facilityDefaultValues: FacilityFormValues = {
  _id: '',
  facilityName: '',
  facilityCode: '',
  npi: '',
  taxId: '',
  placeOfServiceCode: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  fax: '',
  activeFlag: false,
  active: true,
}

export function createFacilityFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<FacilityFormValues> {
  void referenceOptions
  return {
    schema: facilityFormSchema,
    defaultValues: facilityDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'facilityName',
        label: 'Facility name',
        section: 'Facility',
        type: 'text',
        placeholder: 'Facility name',
      },
      {
        name: 'facilityCode',
        label: 'Facility code',
        section: 'Facility',
        type: 'text',
        placeholder: 'Short internal facility code',
      },
      {
        name: 'npi',
        label: 'NPI',
        section: 'Facility',
        type: 'text',
        placeholder: '10-digit NPI',
      },
      {
        name: 'taxId',
        label: 'Tax ID',
        section: 'Facility',
        type: 'text',
        placeholder: 'XX-XXXXXXX',
      },
      {
        name: 'placeOfServiceCode',
        label: 'Place of service',
        section: 'Facility',
        type: 'select',
        placeholder: 'Select POS',
        options: placeOfServiceOptions,
      },
      {
        name: 'addressLine1',
        label: 'Address line 1',
        section: 'Address',
        type: 'text',
        placeholder: 'Street address',
      },
      {
        name: 'addressLine2',
        label: 'Address line 2',
        section: 'Address',
        type: 'text',
        placeholder: 'Suite, floor, building',
      },
      {
        name: 'city',
        label: 'City',
        section: 'Address',
        type: 'text',
        placeholder: 'City',
      },
      {
        name: 'state',
        label: 'State',
        section: 'Address',
        type: 'select',
        placeholder: 'Choose state',
        options: stateOptions,
      },
      {
        name: 'zipCode',
        label: 'ZIP code',
        section: 'Address',
        type: 'text',
        placeholder: 'ZIP code',
      },
      {
        name: 'phone',
        label: 'Phone',
        section: 'Contact',
        type: 'text',
        placeholder: 'Main phone',
      },
      {
        name: 'fax',
        label: 'Fax',
        section: 'Contact',
        type: 'text',
        placeholder: 'Fax number',
      },
      {
        name: 'activeFlag',
        label: 'Open for scheduling and billing',
        section: 'Status',
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

export function mapFacilityToFormValues(item: Facility): FacilityFormValues {
  return {
    _id: item._id,
    facilityName: item.facilityName ?? '',
    facilityCode: item.facilityCode ?? '',
    npi: item.npi ?? '',
    taxId: item.taxId ?? '',
    placeOfServiceCode: item.placeOfServiceCode ?? '',
    addressLine1: item.addressLine1 ?? '',
    addressLine2: item.addressLine2 ?? '',
    city: item.city ?? '',
    state: item.state ?? '',
    zipCode: item.zipCode ?? '',
    phone: item.phone ?? '',
    fax: item.fax ?? '',
    activeFlag: item.activeFlag,
    active: item.active,
  }
}

export function mapFacilityFormToPayload(values: FacilityFormValues): FacilityCreatePayload {
  return {
    facilityName: optionalText(values.facilityName),
    facilityCode: optionalText(values.facilityCode),
    npi: optionalText(values.npi),
    taxId: optionalText(values.taxId),
    placeOfServiceCode: optionalText(values.placeOfServiceCode),
    addressLine1: optionalText(values.addressLine1),
    addressLine2: optionalText(values.addressLine2),
    city: optionalText(values.city),
    state: optionalText(values.state),
    zipCode: optionalText(values.zipCode),
    phone: optionalText(values.phone),
    fax: optionalText(values.fax),
    activeFlag: values.activeFlag,
    active: values.active,
  }
}

function getFacilityLabel(item: Facility, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.facilityName, item.facilityCode].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createFacilityTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Facility>> {
  return [
    {
      key: 'record',
      header: 'Facility',
      sortField: 'facilityName',
      exportValue: (item) => getFacilityLabel(item, referenceOptions),
      render: (item) => getFacilityLabel(item, referenceOptions),
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
      key: 'placeOfServiceCode',
      header: 'POS',
      sortField: 'placeOfServiceCode',
      field: 'placeOfServiceCode',
      exportValue: (item) => item.placeOfServiceCode ?? '',
      render: (item) => item.placeOfServiceCode ?? '-',
    },
    {
      key: 'location',
      header: 'Location',
      exportValue: (item) => [item.city, item.state].filter(Boolean).join(', '),
      render: (item) => [item.city, item.state].filter(Boolean).join(', ') || '-',
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

export function renderFacilityDetails(item: Facility, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Facility</h3>
        {renderSection([
          ['facility ID', item.facilityId],
          ['facility Name', item.facilityName ?? '-'],
          ['facility Code', item.facilityCode ?? '-'],
          ['npi', item.npi ?? '-'],
          ['tax ID', item.taxId ?? '-'],
          ['place Of Service Code', item.placeOfServiceCode ?? '-'],
          ['address Line1', item.addressLine1 ?? '-'],
          ['address Line2', item.addressLine2 ?? '-'],
          ['city', item.city ?? '-'],
          ['state', item.state ?? '-'],
          ['zip Code', item.zipCode ?? '-'],
          ['phone', item.phone ?? '-'],
          ['fax', item.fax ?? '-'],
          ['active Flag', formatBoolean(item.activeFlag)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderFacilityGridItem(item: Facility, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getFacilityLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
      </dl>
    </div>
  )
}
