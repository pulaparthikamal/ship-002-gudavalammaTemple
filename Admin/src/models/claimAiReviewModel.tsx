import { z } from 'zod'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ClaimAiReview, ClaimAiReviewCreatePayload, ClaimAiReviewFormValues, ClaimAiReviewDenialPrediction, ClaimAiReviewDenialPredictionFormValues } from '@/types/claimAiReview'

export const claimAiReviewApiDetails = {
  endpoint: '/rcm/claim-ai-reviews',
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

const reviewStatusOptions = createSelectOptions([
  'Generated',
  'Needs Review',
  'Passed',
  'Human Approved',
  'Override Approved',
])
const riskLevelOptions = createSelectOptions(['Low', 'Medium', 'High', 'Critical'])

const claimAiReviewDenialPredictionFormSchema = z.object({
  riskScore: z.number().nullable(),
  riskLevel: z.string().trim(),
  predictedReasons: z.string().trim(),
  recommendedFixes: z.string().trim(),
  modelVersion: z.string().trim(),
  predictedAt: z.date().nullable(),
  confidenceScore: z.number().nullable(),
  reviewRequired: z.boolean(),
})

export const claimAiReviewFormSchema = z.object({
  _id: z.string().optional(),
  claimId: z.string().trim(),
  reviewStatus: z.string().trim(),
  blockingReasons: z.string().trim(),
  overrideReason: z.string().trim(),
  denialPrediction: claimAiReviewDenialPredictionFormSchema,
  active: z.boolean(),
}) as z.ZodType<ClaimAiReviewFormValues>

export const claimAiReviewDefaultValues: ClaimAiReviewFormValues = {
  _id: '',
  claimId: '',
  reviewStatus: 'Generated',
  blockingReasons: '',
  overrideReason: '',
  denialPrediction: {
    riskScore: null,
    riskLevel: '',
    predictedReasons: '',
    recommendedFixes: '',
    modelVersion: '',
    predictedAt: null,
    confidenceScore: null,
    reviewRequired: false,
  },
  active: true,
}

export function createClaimAiReviewFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ClaimAiReviewFormValues> {
  void referenceOptions
  return {
    schema: claimAiReviewFormSchema,
    defaultValues: claimAiReviewDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'claimId',
      label: 'Claim',
      type: 'autocomplete',
      placeholder: 'Select claim',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'reviewStatus',
      label: 'Review Status',
      type: 'select',
      placeholder: 'Select review status',
      options: reviewStatusOptions,
    },
    {
      name: 'blockingReasons',
      label: 'Blocking Reasons',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one reason per line or separate values with commas.',
    },
    {
      name: 'overrideReason',
      label: 'Override Reason',
      type: 'textarea',
      rows: 2,
      fullWidth: true,
    },
    {
      name: 'denialPrediction.riskScore',
      label: 'Risk Score',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      name: 'denialPrediction.riskLevel',
      label: 'Risk Level',
      type: 'select',
      placeholder: 'Select risk level',
      options: riskLevelOptions,
    },
    {
      name: 'denialPrediction.predictedReasons',
      label: 'Predicted Reasons',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'denialPrediction.recommendedFixes',
      label: 'Recommended Fixes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'denialPrediction.modelVersion',
      label: 'Model Version',
      type: 'text',
      placeholder: 'Model version',
    },
    {
      name: 'denialPrediction.predictedAt',
      label: 'Predicted At',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'denialPrediction.confidenceScore',
      label: 'Confidence Score',
      type: 'number',
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      name: 'denialPrediction.reviewRequired',
      label: 'Review Required',
      type: 'switch',
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

function compactClaimAiReviewDenialPrediction(value: ClaimAiReviewDenialPredictionFormValues): ClaimAiReviewDenialPrediction | undefined {
  const nextValue = {
    riskScore: optionalNumber(value.riskScore),
    riskLevel: optionalText(value.riskLevel),
    predictedReasons: parseStringList(value.predictedReasons),
    recommendedFixes: parseStringList(value.recommendedFixes),
    modelVersion: optionalText(value.modelVersion),
    predictedAt: optionalDate(value.predictedAt),
    confidenceScore: optionalNumber(value.confidenceScore),
    reviewRequired: value.reviewRequired,
  }

  const hasPredictionValue =
    typeof nextValue.riskScore === 'number' ||
    Boolean(nextValue.riskLevel) ||
    Boolean(nextValue.predictedReasons?.length) ||
    Boolean(nextValue.recommendedFixes?.length) ||
    Boolean(nextValue.modelVersion) ||
    Boolean(nextValue.predictedAt) ||
    typeof nextValue.confidenceScore === 'number' ||
    nextValue.reviewRequired

  return hasPredictionValue ? nextValue : undefined
}

export function mapClaimAiReviewToFormValues(item: ClaimAiReview): ClaimAiReviewFormValues {
  return {
    _id: item._id,
    claimId: item.claimId ?? '',
    reviewStatus: item.reviewStatus ?? 'Generated',
    blockingReasons: formatStringList(item.blockingReasons),
    overrideReason: item.overrideReason ?? '',
    denialPrediction: {
      riskScore: item.denialPrediction.riskScore ?? null,
      riskLevel: item.denialPrediction.riskLevel ?? '',
      predictedReasons: formatStringList(item.denialPrediction.predictedReasons),
      recommendedFixes: formatStringList(item.denialPrediction.recommendedFixes),
      modelVersion: item.denialPrediction.modelVersion ?? '',
      predictedAt: toFormDate(item.denialPrediction.predictedAt),
      confidenceScore: item.denialPrediction.confidenceScore ?? null,
      reviewRequired: item.denialPrediction.reviewRequired,
    },
    active: item.active,
  }
}

export function mapClaimAiReviewFormToPayload(values: ClaimAiReviewFormValues): ClaimAiReviewCreatePayload {
  return {
    claimId: optionalText(values.claimId),
    reviewStatus: optionalText(values.reviewStatus),
    blockingReasons: parseStringList(values.blockingReasons),
    overrideReason: optionalText(values.overrideReason),
    denialPrediction: compactClaimAiReviewDenialPrediction(values.denialPrediction),
    active: values.active,
  }
}

function getClaimAiReviewLabel(item: ClaimAiReview, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [
    item.reviewStatus,
    item.denialPrediction.riskLevel,
    formatNumber(item.denialPrediction.riskScore),
  ].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createClaimAiReviewTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<ClaimAiReview>> {
  return [
    {
      key: 'record',
      header: 'Claim AI Review',
      exportValue: (item) => getClaimAiReviewLabel(item, referenceOptions),
      render: (item) => getClaimAiReviewLabel(item, referenceOptions),
    },
    {
      key: 'claimId',
      header: 'Claim',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.claims, item.claimId),
      render: (item) => formatReferenceLabel(referenceOptions.claims, item.claimId),
    },
    {
      key: 'reviewStatus',
      header: 'Review Status',
      filterable: true,
      field: 'reviewStatus',
      sortField: 'reviewStatus',
      exportValue: (item) => item.reviewStatus ?? '-',
      render: (item) => item.reviewStatus ?? '-',
    },
    {
      key: 'denialPredictionriskLevel',
      header: 'Risk Level',
      exportValue: (item) => item.denialPrediction.riskLevel ?? '-',
      render: (item) => item.denialPrediction.riskLevel ?? '-',
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

export function renderClaimAiReviewDetails(item: ClaimAiReview, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Claim AI Review</h3>
        {renderSection([
          ['claim AI Review ID', item.claimAiReviewId],
          ['claim', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['review Status', item.reviewStatus ?? '-'],
          ['blocking Reasons', (item.blockingReasons ?? []).join(', ') || '-'],
          ['override Reason', item.overrideReason ?? '-'],
          ['overridden By', item.overriddenBy ?? '-'],
          ['overridden At', formatDate(item.overriddenAt)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">denial Prediction</h3>
        {renderSection([
          ['risk Score', formatNumber(item.denialPrediction.riskScore)],
          ['risk Level', item.denialPrediction.riskLevel ?? '-'],
          ['predicted Reasons', (item.denialPrediction.predictedReasons ?? []).join(', ') || '-'],
          ['recommended Fixes', (item.denialPrediction.recommendedFixes ?? []).join(', ') || '-'],
          ['model Version', item.denialPrediction.modelVersion ?? '-'],
          ['predicted At', formatDate(item.denialPrediction.predictedAt)],
          ['confidence Score', formatNumber(item.denialPrediction.confidenceScore)],
          ['review Required', formatBoolean(item.denialPrediction.reviewRequired)],
        ])}
      </section>
    </div>
  )
}

export function renderClaimAiReviewGridItem(item: ClaimAiReview, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getClaimAiReviewLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">claim</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{formatReferenceLabel(referenceOptions.claims, item.claimId)}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">review status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.reviewStatus ?? '-'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">risk level</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.denialPrediction.riskLevel ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
