import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { CodingReview, CodingReviewCreatePayload, CodingReviewFormValues } from '@/types/codingReview'

export const codingReviewApiDetails = {
  endpoint: '/rcm/coding-reviews',
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

const scrubStatusOptions = createSelectOptions(['Pending', 'Failed', 'Passed', 'Approved'])
const codingRiskLevelOptions = createSelectOptions(['Low', 'Medium', 'High'])

export const codingReviewFormSchema = z.object({
  _id: z.string().optional(),
  chargeId: z.string().trim(),
  encounterId: z.string().trim(),
  patientId: z.string().trim(),
  scrubStatus: z.string().trim(),
  codingRiskLevel: z.string().trim(),
  validationErrors: z.string().trim(),
  missingDocumentationFlag: z.boolean(),
  modifierIssues: z.string().trim(),
  icdCptMismatchFlag: z.boolean(),
  ncciEditFlag: z.boolean(),
  lcdNcdEditFlag: z.boolean(),
  payerSpecificRuleFailures: z.string().trim(),
  aiSuggestedCodes: z.string().trim(),
  aiSuggestedFixes: z.string().trim(),
  reviewedBy: z.string().trim(),
  reviewedAt: z.date().nullable(),
  active: z.boolean(),
}) as z.ZodType<CodingReviewFormValues>

export const codingReviewDefaultValues: CodingReviewFormValues = {
  _id: '',
  chargeId: '',
  encounterId: '',
  patientId: '',
  scrubStatus: 'Pending',
  codingRiskLevel: 'Low',
  validationErrors: '',
  missingDocumentationFlag: false,
  modifierIssues: '',
  icdCptMismatchFlag: false,
  ncciEditFlag: false,
  lcdNcdEditFlag: false,
  payerSpecificRuleFailures: '',
  aiSuggestedCodes: '',
  aiSuggestedFixes: '',
  reviewedBy: '',
  reviewedAt: null,
  active: true,
}

export function createCodingReviewFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<CodingReviewFormValues> {
  void referenceOptions
  return {
    schema: codingReviewFormSchema,
    defaultValues: codingReviewDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'chargeId',
      label: 'charge ID',
      type: 'autocomplete',
      placeholder: 'charge ID',
      options: referenceOptions.charges ?? [],
      disableOnEditForm: true,
    },
    {
      name: 'encounterId',
      label: 'encounter ID',
      type: 'autocomplete',
      placeholder: 'encounter ID',
      options: referenceOptions.encounters ?? [],
      disableOnEditForm: true,
    },
    {
      name: 'patientId',
      label: 'patient ID',
      type: 'autocomplete',
      placeholder: 'patient ID',
      options: referenceOptions.patients ?? [],
      disableOnEditForm: true,
    },
    {
      name: 'scrubStatus',
      label: 'scrub Status',
      type: 'select',
      placeholder: 'scrub Status',
      options: scrubStatusOptions,
    },
    {
      name: 'codingRiskLevel',
      label: 'coding Risk Level',
      type: 'select',
      placeholder: 'coding Risk Level',
      options: codingRiskLevelOptions,
    },
    {
      name: 'validationErrors',
      label: 'validation Errors',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'missingDocumentationFlag',
      label: 'missing Documentation Flag',
      type: 'switch',
    },
    {
      name: 'modifierIssues',
      label: 'modifier Issues',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'icdCptMismatchFlag',
      label: 'icd CPT Mismatch Flag',
      type: 'switch',
    },
    {
      name: 'ncciEditFlag',
      label: 'ncci Edit Flag',
      type: 'switch',
    },
    {
      name: 'lcdNcdEditFlag',
      label: 'lcd NCD Edit Flag',
      type: 'switch',
    },
    {
      name: 'payerSpecificRuleFailures',
      label: 'payer Specific Rule Failures',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'reviewedBy',
      label: 'reviewed By',
      type: 'text',
      placeholder: 'reviewed By',
    },
    {
      name: 'reviewedAt',
      label: 'reviewed At',
      type: 'date',
      date: {
        showButtonBar: true,
      },
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

export function mapCodingReviewToFormValues(item: CodingReview): CodingReviewFormValues {
  return {
    _id: item._id,
    chargeId: item.chargeId ?? '',
    encounterId: item.encounterId ?? '',
    patientId: item.patientId ?? '',
    scrubStatus: item.scrubStatus ?? '',
    codingRiskLevel: item.codingRiskLevel ?? '',
    validationErrors: formatStringList(item.validationErrors),
    missingDocumentationFlag: item.missingDocumentationFlag,
    modifierIssues: formatStringList(item.modifierIssues),
    icdCptMismatchFlag: item.icdCptMismatchFlag,
    ncciEditFlag: item.ncciEditFlag,
    lcdNcdEditFlag: item.lcdNcdEditFlag,
    payerSpecificRuleFailures: formatStringList(item.payerSpecificRuleFailures),
    aiSuggestedCodes: formatStringList(item.aiSuggestedCodes),
    aiSuggestedFixes: formatStringList(item.aiSuggestedFixes),
    reviewedBy: item.reviewedBy ?? '',
    reviewedAt: toFormDate(item.reviewedAt),
    active: item.active,
  }
}

export function mapCodingReviewFormToPayload(values: CodingReviewFormValues): CodingReviewCreatePayload {
  return {
    chargeId: optionalText(values.chargeId),
    encounterId: optionalText(values.encounterId),
    patientId: optionalText(values.patientId),
    scrubStatus: optionalText(values.scrubStatus),
    codingRiskLevel: optionalText(values.codingRiskLevel),
    validationErrors: parseStringList(values.validationErrors),
    missingDocumentationFlag: values.missingDocumentationFlag,
    modifierIssues: parseStringList(values.modifierIssues),
    icdCptMismatchFlag: values.icdCptMismatchFlag,
    ncciEditFlag: values.ncciEditFlag,
    lcdNcdEditFlag: values.lcdNcdEditFlag,
    payerSpecificRuleFailures: parseStringList(values.payerSpecificRuleFailures),
    aiSuggestedCodes: parseStringList(values.aiSuggestedCodes),
    aiSuggestedFixes: parseStringList(values.aiSuggestedFixes),
    reviewedBy: optionalText(values.reviewedBy),
    reviewedAt: optionalDate(values.reviewedAt),
    active: values.active,
  }
}

export function getCodingReviewRowLabel(item: CodingReview, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.scrubStatus, item.codingRiskLevel].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createCodingReviewTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<CodingReview>> {
  return [
    {
      key: 'record',
      header: 'Coding Review',
      sortField: 'scrubStatus',
      exportValue: (item) => getCodingReviewRowLabel(item, referenceOptions),
      render: (item) => getCodingReviewRowLabel(item, referenceOptions),
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
      key: 'scrubStatus',
      header: 'scrub Status',
      filterable: true,
      field: 'scrubStatus',
      sortField: 'scrubStatus',
      exportValue: (item) => item.scrubStatus ?? '-',
      render: (item) => item.scrubStatus ?? '-',
    },
    {
      key: 'validationErrors',
      header: 'Validation',
      sortable: false,
      exportValue: (item) => (item.validationErrors ?? []).join(', ') || 'No blocking issues',
      render: (item) => (item.validationErrors ?? []).join(', ') || 'No blocking issues',
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

export function renderCodingReviewDetails(item: CodingReview, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Coding Review</h3>
        {renderSection([
          ['scrub ID', item.scrubId],
          ['charge ID', formatReferenceLabel(referenceOptions.charges, item.chargeId)],
          ['encounter ID', formatReferenceLabel(referenceOptions.encounters, item.encounterId)],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['scrub Status', item.scrubStatus ?? '-'],
          ['coding Risk Level', item.codingRiskLevel ?? '-'],
          ['validation Errors', (item.validationErrors ?? []).join(', ') || '-'],
          ['missing Documentation Flag', formatBoolean(item.missingDocumentationFlag)],
          ['modifier Issues', (item.modifierIssues ?? []).join(', ') || '-'],
          ['icd CPT Mismatch Flag', formatBoolean(item.icdCptMismatchFlag)],
          ['ncci Edit Flag', formatBoolean(item.ncciEditFlag)],
          ['lcd NCD Edit Flag', formatBoolean(item.lcdNcdEditFlag)],
          ['payer Specific Rule Failures', (item.payerSpecificRuleFailures ?? []).join(', ') || '-'],
          ['reviewed By', item.reviewedBy ?? '-'],
          ['reviewed At', formatDate(item.reviewedAt)],
        ])}
      </section>
    </div>
  )
}

export function renderCodingReviewGridItem(item: CodingReview, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getCodingReviewRowLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">patient ID</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.patients, item.patientId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">scrub Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.scrubStatus ?? '-'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">validation</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{(item.validationErrors ?? []).join(', ') || 'No blocking issues'}</dd>
        </div>
      </dl>
    </div>
  )
}
