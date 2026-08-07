import { z } from 'zod'
import { phonePattern, stateCodePattern, zipCodePattern } from '@/models/rcmValidation'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Payer, PayerCreatePayload, PayerFormValues } from '@/types/payer'

export const payerApiDetails = {
  endpoint: '/rcm/payers',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const payerTypeOptions = [
  'Commercial',
  'Medicare',
  'Medicaid',
  'Managed Medicaid',
  'Workers Compensation',
  'Auto',
  'Other',
]

const claimsSubmissionMethodOptions = ['Electronic', 'Paper', 'Portal']

const optionalPhoneField = z
  .string()
  .trim()
  .refine((value) => !value || phonePattern.test(value), 'Enter a valid phone number')

export const payerFormSchema = z
  .object({
    _id: z.string().optional(),
    payerId: z.string().trim().min(1, 'Payer ID is required'),
    payerName: z.string().trim().min(1, 'Payer name is required'),
    ediPayerId: z.string().trim(),
    payerType: z.string().trim().min(1, 'Payer type is required'),
    claimsSubmissionMethod: z.string().trim().min(1, 'Claims submission method is required'),
    eligibilityApiSupported: z.boolean(),
    authPortalUrl: z.string().trim().url('Enter a valid URL').or(z.literal('')),
    payerAddressLine1: z.string().trim(),
    payerAddressLine2: z.string().trim(),
    city: z.string().trim(),
    state: z.string().trim().refine((value) => !value || stateCodePattern.test(value), 'Use the 2-letter state code'),
    zipCode: z.string().trim().refine((value) => !value || zipCodePattern.test(value), 'Enter a valid ZIP code'),
    phone: optionalPhoneField,
    timelyFilingDays: z.number().nullable(),
    appealTimelyFilingDays: z.number().nullable(),
    activeFlag: z.boolean(),
    active: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.claimsSubmissionMethod === 'Electronic' && !value.ediPayerId.trim()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'EDI payer ID is required for electronic claim submission.',
        path: ['ediPayerId'],
      })
    }

    if (value.claimsSubmissionMethod === 'Paper') {
      if (!value.payerAddressLine1.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payer address line 1 is required for paper submission.',
          path: ['payerAddressLine1'],
        })
      }

      if (!value.city.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payer city is required for paper submission.',
          path: ['city'],
        })
      }

      if (!value.state.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payer state is required for paper submission.',
          path: ['state'],
        })
      }

      if (!value.zipCode.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Payer ZIP code is required for paper submission.',
          path: ['zipCode'],
        })
      }
    }

    if (value.timelyFilingDays !== null && value.timelyFilingDays <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Timely filing days must be greater than 0.',
        path: ['timelyFilingDays'],
      })
    }

    if (value.appealTimelyFilingDays !== null && value.appealTimelyFilingDays <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Appeal timely filing days must be greater than 0.',
        path: ['appealTimelyFilingDays'],
      })
    }
  }) as z.ZodType<PayerFormValues>

export const payerDefaultValues: PayerFormValues = {
  _id: '',
  payerId: '',
  payerName: '',
  ediPayerId: '',
  payerType: '',
  claimsSubmissionMethod: '',
  eligibilityApiSupported: false,
  authPortalUrl: '',
  payerAddressLine1: '',
  payerAddressLine2: '',
  city: '',
  state: '',
  zipCode: '',
  phone: '',
  timelyFilingDays: null,
  appealTimelyFilingDays: null,
  activeFlag: false,
  active: true,
}

export function createPayerFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<PayerFormValues> {
  void referenceOptions
  return {
    schema: payerFormSchema,
    defaultValues: payerDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
      {
        name: 'payerId',
        label: 'Payer ID',
        section: 'Payer',
        type: 'text',
        placeholder: 'Internal or trading-partner payer ID',
      },
      {
        name: 'payerName',
        label: 'Payer name',
        section: 'Payer',
        type: 'text',
        placeholder: 'Payer name',
      },
      {
        name: 'payerType',
        label: 'Payer type',
        section: 'Payer',
        type: 'select',
        placeholder: 'Select payer type',
        options: payerTypeOptions.map((value) => ({ label: value, value })),
      },
      {
        name: 'claimsSubmissionMethod',
        label: 'Claim submission method',
        section: 'Submission',
        type: 'select',
        placeholder: 'Select submission method',
        options: claimsSubmissionMethodOptions.map((value) => ({ label: value, value })),
      },
      {
        name: 'ediPayerId',
        label: 'EDI payer ID',
        section: 'Submission',
        type: 'text',
        placeholder: 'Required for electronic claims',
      },
      {
        name: 'eligibilityApiSupported',
        label: 'Eligibility API available',
        section: 'Submission',
        type: 'switch',
      },
      {
        name: 'authPortalUrl',
        label: 'Authorization portal URL',
        section: 'Submission',
        type: 'text',
        placeholder: 'https://...',
      },
      {
        name: 'payerAddressLine1',
        label: 'Address line 1',
        section: 'Mailing Address',
        type: 'text',
        placeholder: 'Paper claims mailing address',
      },
      {
        name: 'payerAddressLine2',
        label: 'Address line 2',
        section: 'Mailing Address',
        type: 'text',
        placeholder: 'Suite, floor, building',
      },
      {
        name: 'city',
        label: 'City',
        section: 'Mailing Address',
        type: 'text',
        placeholder: 'City',
      },
      {
        name: 'state',
        label: 'State',
        section: 'Mailing Address',
        type: 'text',
        placeholder: '2-letter state code',
      },
      {
        name: 'zipCode',
        label: 'ZIP code',
        section: 'Mailing Address',
        type: 'text',
        placeholder: 'ZIP code',
      },
      {
        name: 'phone',
        label: 'Phone',
        section: 'Mailing Address',
        type: 'text',
        placeholder: 'Main payer phone',
      },
      {
        name: 'timelyFilingDays',
        label: 'Claim timely filing days',
        section: 'Deadlines',
        type: 'number',
      },
      {
        name: 'appealTimelyFilingDays',
        label: 'Appeal timely filing days',
        section: 'Deadlines',
        type: 'number',
      },
      {
        name: 'activeFlag',
        label: 'Active for billing',
        section: 'Deadlines',
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

export function mapPayerToFormValues(item: Payer): PayerFormValues {
  return {
    _id: item._id,
    payerId: item.payerId ?? '',
    payerName: item.payerName ?? '',
    ediPayerId: item.ediPayerId ?? '',
    payerType: item.payerType ?? '',
    claimsSubmissionMethod: item.claimsSubmissionMethod ?? '',
    eligibilityApiSupported: item.eligibilityApiSupported,
    authPortalUrl: item.authPortalUrl ?? '',
    payerAddressLine1: item.payerAddressLine1 ?? '',
    payerAddressLine2: item.payerAddressLine2 ?? '',
    city: item.city ?? '',
    state: item.state ?? '',
    zipCode: item.zipCode ?? '',
    phone: item.phone ?? '',
    timelyFilingDays: item.timelyFilingDays ?? null,
    appealTimelyFilingDays: item.appealTimelyFilingDays ?? null,
    activeFlag: item.activeFlag,
    active: item.active,
  }
}

export function mapPayerFormToPayload(values: PayerFormValues): PayerCreatePayload {
  return {
    payerId: optionalText(values.payerId),
    payerName: optionalText(values.payerName),
    ediPayerId: optionalText(values.ediPayerId),
    payerType: optionalText(values.payerType),
    claimsSubmissionMethod: optionalText(values.claimsSubmissionMethod),
    eligibilityApiSupported: values.eligibilityApiSupported,
    authPortalUrl: optionalText(values.authPortalUrl),
    payerAddressLine1: optionalText(values.payerAddressLine1),
    payerAddressLine2: optionalText(values.payerAddressLine2),
    city: optionalText(values.city),
    state: optionalText(values.state),
    zipCode: optionalText(values.zipCode),
    phone: optionalText(values.phone),
    timelyFilingDays: optionalNumber(values.timelyFilingDays),
    appealTimelyFilingDays: optionalNumber(values.appealTimelyFilingDays),
    activeFlag: values.activeFlag,
    active: values.active,
  }
}

function getPayerLabel(item: Payer, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.payerName, item.payerId].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createPayerTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Payer>> {
  return [
    {
      key: 'record',
      header: 'Payer',
      sortField: 'payerName',
      exportValue: (item) => getPayerLabel(item, referenceOptions),
      render: (item) => getPayerLabel(item, referenceOptions),
    },
    {
      key: 'payerType',
      header: 'Type',
      filterable: true,
      sortField: 'payerType',
      field: 'payerType',
      exportValue: (item) => item.payerType ?? '',
      render: (item) => item.payerType ?? '-',
    },
    {
      key: 'claimsSubmissionMethod',
      header: 'Submission',
      filterable: true,
      sortField: 'claimsSubmissionMethod',
      field: 'claimsSubmissionMethod',
      exportValue: (item) => item.claimsSubmissionMethod ?? '',
      render: (item) => item.claimsSubmissionMethod ?? '-',
    },
    {
      key: 'ediPayerId',
      header: 'EDI ID',
      filterable: true,
      sortField: 'ediPayerId',
      field: 'ediPayerId',
      exportValue: (item) => item.ediPayerId ?? '',
      render: (item) => item.ediPayerId ?? '-',
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

export function renderPayerDetails(item: Payer, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Payer</h3>
        {renderSection([
          ['payer ID', item.payerId ?? '-'],
          ['payer Name', item.payerName ?? '-'],
          ['edi Payer ID', item.ediPayerId ?? '-'],
          ['payer Type', item.payerType ?? '-'],
          ['claims Submission Method', item.claimsSubmissionMethod ?? '-'],
          ['eligibility API Supported', formatBoolean(item.eligibilityApiSupported)],
          ['auth Portal URL', item.authPortalUrl ?? '-'],
          ['payer Address Line1', item.payerAddressLine1 ?? '-'],
          ['payer Address Line2', item.payerAddressLine2 ?? '-'],
          ['city', item.city ?? '-'],
          ['state', item.state ?? '-'],
          ['zip Code', item.zipCode ?? '-'],
          ['phone', item.phone ?? '-'],
          ['timely Filing Days', formatNumber(item.timelyFilingDays)],
          ['appeal Timely Filing Days', formatNumber(item.appealTimelyFilingDays)],
          ['active Flag', formatBoolean(item.activeFlag)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderPayerGridItem(item: Payer, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getPayerLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
      </dl>
    </div>
  )
}
