import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { CorrectedClaim, CorrectedClaimCreatePayload, CorrectedClaimFormValues } from '@/types/correctedClaim'

export const correctedClaimApiDetails = {
  endpoint: '/rcm/corrected-claims',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const correctedClaimFormSchema = z.object({
  _id: z.string().optional(),
  originalClaimId: z.string().trim(),
  denialId: z.string().trim(),
  sourceDenialId: z.string().trim(),
  correctedFromClaimId: z.string().trim(),
  clonedClaimId: z.string().trim(),
  correctionReason: z.string().trim(),
  correctionType: z.string().trim(),
  frequencyCode: z.string().trim(),
  resubmissionReason: z.string().trim(),
  correctedFrequencyCode: z.string().trim(),
  correctedClaimStatus: z.string().trim(),
  correctedFieldsChanged: z.string().trim(),
  submittedDate: z.date().nullable(),
  notes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<CorrectedClaimFormValues>

export const correctedClaimDefaultValues: CorrectedClaimFormValues = {
  _id: '',
  originalClaimId: '',
  denialId: '',
  sourceDenialId: '',
  correctedFromClaimId: '',
  clonedClaimId: '',
  correctionReason: '',
  correctionType: '',
  frequencyCode: '',
  resubmissionReason: '',
  correctedFrequencyCode: '',
  correctedClaimStatus: '',
  correctedFieldsChanged: '',
  submittedDate: null,
  notes: '',
  active: true,
}

export function createCorrectedClaimFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<CorrectedClaimFormValues> {
  void referenceOptions
  return {
    schema: correctedClaimFormSchema,
    defaultValues: correctedClaimDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'originalClaimId',
      label: 'original Claim ID',
      type: 'autocomplete',
      placeholder: 'original Claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'denialId',
      label: 'denial ID',
      type: 'text',
      placeholder: 'denial ID',
    },
    {
      name: 'clonedClaimId',
      label: 'cloned Claim ID',
      type: 'autocomplete',
      placeholder: 'cloned Claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'correctionReason',
      label: 'correction Reason',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'correctionType',
      label: 'correction Type',
      type: 'select',
      placeholder: 'correction Type',
      options: [
        { label: 'Replacement / corrected', value: 'REPLACEMENT' },
        { label: 'Void / cancel', value: 'VOID' },
      ],
    },
    {
      name: 'frequencyCode',
      label: 'frequency Code',
      type: 'select',
      placeholder: 'frequency Code',
      options: [
        { label: '7 - Replacement', value: '7' },
        { label: '8 - Void', value: '8' },
      ],
    },
    {
      name: 'resubmissionReason',
      label: 'resubmission Reason',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'correctedFrequencyCode',
      label: 'corrected Frequency Code',
      type: 'text',
      placeholder: 'corrected Frequency Code',
    },
    {
      name: 'correctedClaimStatus',
      label: 'corrected Claim Status',
      type: 'text',
      placeholder: 'corrected Claim Status',
    },
    {
      name: 'correctedFieldsChanged',
      label: 'corrected Fields Changed',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'submittedDate',
      label: 'submitted Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'notes',
      label: 'notes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'active',
      label: 'active',
      type: 'switch',
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

export function formatStringList(value: string[] = []) {
  return value.join('\n')
}

export function formatMixed(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return '-'
  }

  if (typeof value === 'string') {
    return value
  }

  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function mapCorrectedClaimToFormValues(item: CorrectedClaim): CorrectedClaimFormValues {
  return {
    _id: item._id,
    originalClaimId: item.originalClaimId ?? '',
    denialId: item.denialId ?? '',
    sourceDenialId: item.sourceDenialId ?? '',
    correctedFromClaimId: item.correctedFromClaimId ?? '',
    clonedClaimId: item.clonedClaimId ?? '',
    correctionReason: item.correctionReason ?? '',
    correctionType: item.correctionType ?? '',
    frequencyCode: item.frequencyCode ?? '',
    resubmissionReason: item.resubmissionReason ?? '',
    correctedFrequencyCode: item.correctedFrequencyCode ?? '',
    correctedClaimStatus: item.correctedClaimStatus ?? '',
    correctedFieldsChanged: formatStringList(item.correctedFieldsChanged),
    submittedDate: toFormDate(item.submittedDate),
    notes: item.notes ?? '',
    active: item.active,
  }
}

export function mapCorrectedClaimFormToPayload(values: CorrectedClaimFormValues): CorrectedClaimCreatePayload {
  return {
    originalClaimId: optionalText(values.originalClaimId),
    denialId: optionalText(values.denialId),
    sourceDenialId: optionalText(values.sourceDenialId),
    correctedFromClaimId: optionalText(values.correctedFromClaimId),
    clonedClaimId: optionalText(values.clonedClaimId),
    correctionReason: optionalText(values.correctionReason),
    correctionType: optionalText(values.correctionType),
    frequencyCode: optionalText(values.frequencyCode),
    resubmissionReason: optionalText(values.resubmissionReason),
    correctedFrequencyCode: optionalText(values.correctedFrequencyCode),
    correctedClaimStatus: optionalText(values.correctedClaimStatus),
    correctedFieldsChanged: parseStringList(values.correctedFieldsChanged),
    submittedDate: optionalDate(values.submittedDate),
    notes: optionalText(values.notes),
    active: values.active,
  }
}

function getCorrectedClaimLabel(item: CorrectedClaim, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [formatDate(item.submittedDate), item.correctedClaimStatus, item.correctedFrequencyCode].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createCorrectedClaimTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<CorrectedClaim>> {
  return [
    {
      key: 'record',
      header: 'Corrected Claim',
      sortField: 'submittedDate',
      exportValue: (item) => getCorrectedClaimLabel(item, referenceOptions),
      render: (item) => getCorrectedClaimLabel(item, referenceOptions),
    },
    {
      key: 'clonedClaimId',
      header: 'Corrected Claim',
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.claims, item.clonedClaimId),
      render: (item) => formatReferenceLabel(referenceOptions.claims, item.clonedClaimId),
    },
    {
      key: 'correctedClaimStatus',
      header: 'Corrected Claim Status',
      filterable: true,
      field: 'correctedClaimStatus',
      sortField: 'correctedClaimStatus',
      exportValue: (item) => item.correctedClaimStatus ?? '-',
      render: (item) => item.correctedClaimStatus ?? '-',
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

export function renderCorrectedClaimDetails(item: CorrectedClaim, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Corrected Claim</h3>
        {renderSection([
          ['corrected Claim ID', item.correctedClaimId],
          ['original Claim ID', formatReferenceLabel(referenceOptions.claims, item.originalClaimId)],
          ['source Denial ID', item.sourceDenialId ?? item.denialId ?? '-'],
          ['corrected From Claim ID', formatReferenceLabel(referenceOptions.claims, item.correctedFromClaimId)],
          ['cloned Claim ID', formatReferenceLabel(referenceOptions.claims, item.clonedClaimId)],
          ['correction Reason', item.correctionReason ?? '-'],
          ['correction Type', item.correctionType ?? '-'],
          ['frequency Code', item.frequencyCode ?? '-'],
          ['resubmission Reason', item.resubmissionReason ?? '-'],
          ['corrected Frequency Code', item.correctedFrequencyCode ?? '-'],
          ['corrected Claim Status', item.correctedClaimStatus ?? '-'],
          ['corrected Fields Changed', (item.correctedFieldsChanged ?? []).join(', ') || '-'],
          ['submitted Date', formatDate(item.submittedDate)],
          ['notes', item.notes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderCorrectedClaimGridItem(item: CorrectedClaim, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getCorrectedClaimLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">corrected Claim Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.correctedClaimStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
