import { z } from 'zod'
import { RcmAiInsightSection } from '@/components/rcm/RcmAiInsightSection'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Denial, DenialCreatePayload, DenialFormValues } from '@/types/denial'

export const denialApiDetails = {
  endpoint: '/rcm/denials',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

const denialStatusOptions = [
  'OPEN',
  'IN_REVIEW',
  'APPEAL_READY',
  'APPEALED',
  'AWAITING_PAYER_RESPONSE',
  'OVERTURNED',
  'UPHELD',
  'PARTIALLY_OVERTURNED',
  'NEEDS_CORRECTION',
  'CORRECTED_CLAIM_READY',
  'CORRECTED_CLAIM_SUBMITTED',
  'RESOLVED',
  'WRITTEN_OFF',
  'CLOSED',
].map((value) => ({ label: value.replaceAll('_', ' '), value }))

const denialCategoryOptions = [
  'ELIGIBILITY',
  'AUTHORIZATION',
  'REFERRAL',
  'CODING',
  'MEDICAL_NECESSITY',
  'TIMELY_FILING',
  'DUPLICATE',
  'COORDINATION_OF_BENEFITS',
  'INFORMATION_MISSING',
  'COVERAGE',
  'OTHER',
].map((value) => ({ label: value.replaceAll('_', ' '), value }))

const priorityOptions = ['high', 'medium', 'low'].map((value) => ({ label: value, value }))

export const denialFormSchema = z.object({
  _id: z.string().optional(),
  claimId: z.string().trim(),
  claimLineId: z.string().trim(),
  paymentPostingId: z.string().trim(),
  eraEobProcessingId: z.string().trim(),
  adjustmentId: z.string().trim(),
  correctedClaimId: z.string().trim(),
  arWorkItemId: z.string().trim(),
  patientId: z.string().trim(),
  payerId: z.string().trim(),
  cptCode: z.string().trim(),
  denialCode: z.string().trim(),
  carcCodes: z.string().trim(),
  rarcCodes: z.string().trim(),
  denialReason: z.string().trim(),
  denialCategory: z.string().trim(),
  classificationExplanation: z.string().trim(),
  denialSource: z.string().trim(),
  denialDate: z.date().nullable(),
  denialAmount: z.number().nullable(),
  preventableFlag: z.boolean(),
  rootCause: z.string().trim(),
  owner: z.string().trim(),
  priority: z.string().trim(),
  denialStatus: z.string().trim(),
  reworkType: z.string().trim(),
  recommendedAction: z.string().trim(),
  correctionEligible: z.boolean(),
  appealEligible: z.boolean(),
  recoveryRecommendation: z.string().trim(),
  recommendationReason: z.string().trim(),
  resolutionDate: z.date().nullable(),
  resolutionNotes: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<DenialFormValues>

export const denialDefaultValues: DenialFormValues = {
  _id: '',
  claimId: '',
  claimLineId: '',
  paymentPostingId: '',
  eraEobProcessingId: '',
  adjustmentId: '',
  correctedClaimId: '',
  arWorkItemId: '',
  patientId: '',
  payerId: '',
  cptCode: '',
  denialCode: '',
  carcCodes: '',
  rarcCodes: '',
  denialReason: '',
  denialCategory: '',
  classificationExplanation: '',
  denialSource: '',
  denialDate: null,
  denialAmount: null,
  preventableFlag: false,
  rootCause: '',
  owner: '',
  priority: 'medium',
  denialStatus: '',
  reworkType: '',
  recommendedAction: '',
  correctionEligible: false,
  appealEligible: false,
  recoveryRecommendation: '',
  recommendationReason: '',
  resolutionDate: null,
  resolutionNotes: '',
  active: true,
}

export function createDenialFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<DenialFormValues> {
  void referenceOptions
  return {
    schema: denialFormSchema,
    defaultValues: denialDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'claimId',
      label: 'claim ID',
      type: 'autocomplete',
      placeholder: 'claim ID',
      options: referenceOptions.claims ?? [],
    },
    {
      name: 'claimLineId',
      label: 'claim Line ID',
      type: 'text',
      placeholder: 'claim Line ID',
    },
    {
      name: 'paymentPostingId',
      label: 'payment Posting ID',
      type: 'text',
      placeholder: 'payment Posting ID',
    },
    {
      name: 'eraEobProcessingId',
      label: 'ERA processing ID',
      type: 'text',
      placeholder: 'ERA processing ID',
    },
    {
      name: 'adjustmentId',
      label: 'adjustment ID',
      type: 'text',
      placeholder: 'adjustment ID',
    },
    {
      name: 'patientId',
      label: 'patient ID',
      type: 'autocomplete',
      placeholder: 'patient ID',
      options: referenceOptions.patients ?? [],
    },
    {
      name: 'payerId',
      label: 'payer ID',
      type: 'autocomplete',
      placeholder: 'payer ID',
      options: referenceOptions.payers ?? [],
    },
    {
      name: 'cptCode',
      label: 'CPT/CDT',
      type: 'text',
      placeholder: 'CPT/CDT',
    },
    {
      name: 'denialCode',
      label: 'denial Code',
      type: 'text',
      placeholder: 'denial Code',
    },
    {
      name: 'carcCodes',
      label: 'CARC codes',
      type: 'textarea',
      rows: 2,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'rarcCodes',
      label: 'RARC codes',
      type: 'textarea',
      rows: 2,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'denialReason',
      label: 'denial Reason',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'denialCategory',
      label: 'denial Category',
      type: 'select',
      placeholder: 'denial Category',
      options: denialCategoryOptions,
    },
    {
      name: 'classificationExplanation',
      label: 'classification Explanation',
      type: 'textarea',
      rows: 2,
      fullWidth: true,
    },
    {
      name: 'denialSource',
      label: 'denial Source',
      type: 'text',
      placeholder: 'denial Source',
    },
    {
      name: 'denialDate',
      label: 'denial Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'denialAmount',
      label: 'denial Amount',
      type: 'number',
    },
    {
      name: 'preventableFlag',
      label: 'preventable Flag',
      type: 'switch',
    },
    {
      name: 'rootCause',
      label: 'root Cause',
      type: 'text',
      placeholder: 'root Cause',
    },
    {
      name: 'owner',
      label: 'owner',
      type: 'text',
      placeholder: 'owner',
    },
    {
      name: 'priority',
      label: 'priority',
      type: 'select',
      placeholder: 'priority',
      options: priorityOptions,
    },
    {
      name: 'denialStatus',
      label: 'denial Status',
      type: 'select',
      placeholder: 'denial Status',
      options: denialStatusOptions,
    },
    {
      name: 'reworkType',
      label: 'rework Type',
      type: 'text',
      placeholder: 'rework Type',
    },
    {
      name: 'recommendedAction',
      label: 'recommended Action',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'recoveryRecommendation',
      label: 'recovery Recommendation',
      type: 'select',
      placeholder: 'recovery Recommendation',
      options: [
        { label: 'Corrected claim', value: 'CORRECTED_CLAIM' },
        { label: 'Appeal', value: 'APPEAL' },
        { label: 'Write off', value: 'WRITE_OFF' },
      ],
    },
    {
      name: 'recommendationReason',
      label: 'recommendation Reason',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'correctionEligible',
      label: 'correction Eligible',
      type: 'switch',
    },
    {
      name: 'appealEligible',
      label: 'appeal Eligible',
      type: 'switch',
    },
    {
      name: 'correctedClaimId',
      label: 'corrected Claim ID',
      type: 'text',
      placeholder: 'corrected Claim ID',
    },
    {
      name: 'arWorkItemId',
      label: 'AR work item ID',
      type: 'text',
      placeholder: 'AR work item ID',
    },
    {
      name: 'resolutionDate',
      label: 'resolution Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'resolutionNotes',
      label: 'resolution Notes',
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

export function mapDenialToFormValues(item: Denial): DenialFormValues {
  return {
    _id: item._id,
    claimId: item.claimId ?? '',
    claimLineId: item.claimLineId ?? '',
    paymentPostingId: item.paymentPostingId ?? '',
    eraEobProcessingId: item.eraEobProcessingId ?? '',
    adjustmentId: item.adjustmentId ?? '',
    correctedClaimId: item.correctedClaimId ?? '',
    arWorkItemId: item.arWorkItemId ?? '',
    patientId: item.patientId ?? '',
    payerId: item.payerId ?? '',
    cptCode: item.cptCode ?? '',
    denialCode: item.denialCode ?? '',
    carcCodes: formatStringList(item.carcCodes),
    rarcCodes: formatStringList(item.rarcCodes),
    denialReason: item.denialReason ?? '',
    denialCategory: item.denialCategory ?? '',
    classificationExplanation: item.classificationExplanation ?? '',
    denialSource: item.denialSource ?? '',
    denialDate: toFormDate(item.denialDate),
    denialAmount: item.denialAmount ?? null,
    preventableFlag: item.preventableFlag,
    rootCause: item.rootCause ?? '',
    owner: item.owner ?? '',
    priority: item.priority ?? '',
    denialStatus: item.denialStatus ?? '',
    reworkType: item.reworkType ?? '',
    recommendedAction: item.recommendedAction ?? '',
    correctionEligible: item.correctionEligible ?? false,
    appealEligible: item.appealEligible ?? false,
    recoveryRecommendation: item.recoveryRecommendation ?? '',
    recommendationReason: item.recommendationReason ?? '',
    resolutionDate: toFormDate(item.resolutionDate),
    resolutionNotes: item.resolutionNotes ?? '',
    active: item.active,
  }
}

export function mapDenialFormToPayload(values: DenialFormValues): DenialCreatePayload {
  return {
    claimId: optionalText(values.claimId),
    claimLineId: optionalText(values.claimLineId),
    paymentPostingId: optionalText(values.paymentPostingId),
    eraEobProcessingId: optionalText(values.eraEobProcessingId),
    adjustmentId: optionalText(values.adjustmentId),
    correctedClaimId: optionalText(values.correctedClaimId),
    arWorkItemId: optionalText(values.arWorkItemId),
    patientId: optionalText(values.patientId),
    payerId: optionalText(values.payerId),
    cptCode: optionalText(values.cptCode),
    denialCode: optionalText(values.denialCode),
    carcCodes: parseStringList(values.carcCodes),
    rarcCodes: parseStringList(values.rarcCodes),
    denialReason: optionalText(values.denialReason),
    denialCategory: optionalText(values.denialCategory),
    classificationExplanation: optionalText(values.classificationExplanation),
    denialSource: optionalText(values.denialSource),
    denialDate: optionalDate(values.denialDate),
    denialAmount: optionalNumber(values.denialAmount),
    preventableFlag: values.preventableFlag,
    rootCause: optionalText(values.rootCause),
    owner: optionalText(values.owner),
    priority: optionalText(values.priority),
    denialStatus: optionalText(values.denialStatus),
    reworkType: optionalText(values.reworkType),
    recommendedAction: optionalText(values.recommendedAction),
    correctionEligible: values.correctionEligible,
    appealEligible: values.appealEligible,
    recoveryRecommendation: optionalText(values.recoveryRecommendation) as DenialCreatePayload['recoveryRecommendation'],
    recommendationReason: optionalText(values.recommendationReason),
    resolutionDate: optionalDate(values.resolutionDate),
    resolutionNotes: optionalText(values.resolutionNotes),
    active: values.active,
  }
}

function getDenialLabel(item: Denial, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.denialCode, item.denialStatus, formatDate(item.denialDate)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createDenialTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Denial>> {
  return [
    {
      key: 'record',
      header: 'Denial',
      sortField: 'denialCode',
      exportValue: (item) => getDenialLabel(item, referenceOptions),
      render: (item) => getDenialLabel(item, referenceOptions),
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
      key: 'claimId',
      header: 'Claim',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.claims, item.claimId),
      render: (item) => formatReferenceLabel(referenceOptions.claims, item.claimId),
    },
    {
      key: 'payerId',
      header: 'Payer',
      filterable: true,
      sortable: false,
      exportValue: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
      render: (item) => formatReferenceLabel(referenceOptions.payers, item.payerId),
    },
    {
      key: 'denialCategory',
      header: 'Category',
      filterable: true,
      field: 'denialCategory',
      sortField: 'denialCategory',
      exportValue: (item) => item.denialCategory ?? '-',
      render: (item) => item.denialCategory ?? '-',
    },
    {
      key: 'cptCode',
      header: 'CPT/CDT',
      filterable: true,
      field: 'cptCode',
      sortField: 'cptCode',
      exportValue: (item) => item.cptCode ?? '-',
      render: (item) => item.cptCode ?? '-',
    },
    {
      key: 'denialAmount',
      header: 'Denied',
      filterable: true,
      field: 'denialAmount',
      sortField: 'denialAmount',
      exportValue: (item) => item.denialAmount ?? '-',
      render: (item) => formatNumber(item.denialAmount),
    },
    {
      key: 'priority',
      header: 'Priority',
      filterable: true,
      field: 'priority',
      sortField: 'priority',
      exportValue: (item) => item.priority ?? '-',
      render: (item) => item.priority ?? '-',
    },
    {
      key: 'denialStatus',
      header: 'Denial Status',
      filterable: true,
      field: 'denialStatus',
      sortField: 'denialStatus',
      exportValue: (item) => item.denialStatus ?? '-',
      render: (item) => item.denialStatus ?? '-',
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

export function renderDenialDetails(item: Denial, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Denial</h3>
        {renderSection([
          ['denial ID', item.denialId],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['claim Line ID', item.claimLineId ?? '-'],
          ['payment Posting ID', item.paymentPostingId ?? '-'],
          ['ERA processing ID', item.eraEobProcessingId ?? '-'],
          ['adjustment ID', item.adjustmentId ?? '-'],
          ['appeal ID', item.appealId ?? '-'],
          ['corrected Claim ID', item.correctedClaimId ?? '-'],
          ['AR work item ID', item.arWorkItemId ?? '-'],
          ['patient ID', formatReferenceLabel(referenceOptions.patients, item.patientId)],
          ['payer ID', formatReferenceLabel(referenceOptions.payers, item.payerId)],
          ['CPT/CDT', item.cptCode ?? '-'],
          ['denial Code', item.denialCode ?? '-'],
          ['CARC', (item.carcCodes ?? []).join(', ') || '-'],
          ['RARC', (item.rarcCodes ?? []).join(', ') || '-'],
          ['denial Reason', item.denialReason ?? '-'],
          ['payer Denial Reason', item.payerDenialReason ?? '-'],
          ['denial Category', item.denialCategory ?? '-'],
          ['classification Explanation', item.classificationExplanation ?? '-'],
          ['denial Source', item.denialSource ?? '-'],
          ['denial Date', formatDate(item.denialDate)],
          ['denial Amount', formatNumber(item.denialAmount)],
          ['adjustment Amount', formatNumber(item.adjustmentAmount)],
          ['denial Balance', formatNumber(item.denialBalance)],
          ['line Billed Amount', formatNumber(item.lineBilledAmount)],
          ['line Paid Amount', formatNumber(item.linePaidAmount)],
          ['line Allowed Amount', formatNumber(item.lineAllowedAmount)],
          ['resolved Amount', formatNumber(item.resolvedAmount)],
          ['remaining Balance', formatNumber(item.remainingDeniedBalance)],
          ['match Confidence', formatNumber(item.matchConfidence)],
          ['matched By', (item.matchedBy ?? []).join(', ') || '-'],
          ['allocation Amount', formatNumber(item.allocationAmount)],
          ['manual Review Required', item.manualReviewRequired === undefined ? '-' : formatBoolean(item.manualReviewRequired)],
          ['payment Allocations', item.paymentAllocations?.length ? JSON.stringify(item.paymentAllocations, null, 2) : '-'],
          ['appeal Deadline', formatDate(item.appealDeadline)],
          ['preventable Flag', formatBoolean(item.preventableFlag)],
          ['root Cause', item.rootCause ?? '-'],
          ['owner', item.owner ?? '-'],
          ['priority', item.priority ?? '-'],
          ['denial Status', item.denialStatus ?? '-'],
          ['rework Type', item.reworkType ?? '-'],
          ['recommended Action', item.recommendedAction ?? '-'],
          ['recovery Recommendation', item.recoveryRecommendation ?? '-'],
          ['recommendation Reason', item.recommendationReason ?? '-'],
          ['correction Eligible', formatBoolean(item.correctionEligible)],
          ['appeal Eligible', formatBoolean(item.appealEligible)],
          ['resolution Date', formatDate(item.resolutionDate)],
          ['resolution Notes', item.resolutionNotes ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      <RcmAiInsightSection
        title="AI Root Cause Analysis"
        variant="denial"
        insight={item.aiAnalysis}
        confidence={item.aiConfidenceScore}
        source={item.aiRecommendationSource}
        history={item.aiRecommendationHistory}
      />
    </div>
  )
}

export function renderDenialGridItem(item: Denial, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getDenialLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">denial Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.denialStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
