import { z } from 'zod'
import { RcmAiInsightSection } from '@/components/rcm/RcmAiInsightSection'
import type { CrudFormConfig, CrudSelectOption, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ClaimTracking, ClaimTrackingCreatePayload, ClaimTrackingFormValues } from '@/types/claimTracking'

export const claimTrackingApiDetails = {
  endpoint: '/rcm/claim-trackings',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

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

const acknowledgementTypeOptions = createSelectOptions([
  { label: '999 - Accepted', value: '999 Accepted' },
  { label: '999 - Rejected', value: '999 Rejected' },
  { label: '277CA - Accepted', value: '277CA Accepted' },
  { label: '277CA - Rejected', value: '277CA Rejected' },
  { label: '835 - ERA Received', value: '835 ERA Received' },
  { label: 'Manual Payer Portal Update', value: 'Manual Payer Portal Update' },
  { label: 'Phone Follow-up', value: 'Phone Follow-up' },
])
const trackingSourceOptions = createSelectOptions(['REAL', 'SIMULATED'])
const responseTypeOptions = createSelectOptions(['SUBMISSION', 'ACK_999', 'ACK_277CA', 'STATUS_UPDATE'])
const eventTypeOptions = createSelectOptions([
  'SUBMISSION_CREATED',
  'SUBMISSION_SENT',
  'SUBMISSION_FAILED',
  'ACK_999_ACCEPTED',
  'ACK_999_REJECTED',
  'ACK_277CA_ACCEPTED',
  'ACK_277CA_REJECTED',
  'CLAIM_PENDING',
  'CLAIM_STATUS_UPDATED',
])
const normalizedStatusOptions = createSelectOptions(['DRAFT', 'READY', 'SUBMITTED', 'PENDING', 'ACCEPTED', 'REJECTED', 'FAILED'])
const remediationSeverityOptions = createSelectOptions(['BLOCKING', 'WARNING'])
const rejectionLevelOptions = createSelectOptions([
  'Claim',
  'Service Line',
  'Subscriber',
  'Provider',
  'Payer',
  'Clearinghouse',
])
const rejectionSourceOptions = createSelectOptions([
  'Clearinghouse',
  'Payer',
  'Payer Portal',
  'Manual Follow-up',
  'X12 999',
  'X12 277CA',
  'X12 835',
])

export const claimTrackingFormSchema = z.object({
  _id: z.string().optional(),
  claimId: z.string().trim().min(1, 'Claim is required.'),
  claimSubmissionId: z.string().trim(),
  timestamp: z.date().nullable(),
  source: z.string().trim(),
  trackingSource: z.enum(['REAL', 'SIMULATED']),
  responseType: z.enum(['SUBMISSION', 'ACK_999', 'ACK_277CA', 'STATUS_UPDATE']),
  eventType: z.string().trim(),
  normalizedStatus: z.string().trim(),
  rawStatusCode: z.string().trim(),
  summary: z.string().trim(),
  controlNumber: z.string().trim(),
  externalSubmissionId: z.string().trim(),
  claimControlNumber: z.string().trim(),
  clearinghouseTraceNumber: z.string().trim(),
  payerClaimNumber: z.string().trim(),
  acknowledgementType: z.string().trim(),
  statusCode: z.string().trim(),
  statusDescription: z.string().trim(),
  receivedDate: z.date().nullable(),
  rejectionLevel: z.string().trim(),
  rejectionSource: z.string().trim(),
  rejectionReasonCodes: z.string().trim(),
  stcCategoryCode: z.string().trim(),
  stcStatusCode: z.string().trim(),
  stcEntityCode: z.string().trim(),
  affectedServiceLine: z.string().trim(),
  remediationCode: z.string().trim(),
  remediationFieldPath: z.string().trim(),
  remediationSeverity: z.string().trim(),
  nextActionRequired: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<ClaimTrackingFormValues>

export const claimTrackingDefaultValues: ClaimTrackingFormValues = {
  _id: '',
  claimId: '',
  claimSubmissionId: '',
  timestamp: null,
  source: 'REAL_STEDI_RESPONSE',
  trackingSource: 'REAL',
  responseType: 'STATUS_UPDATE',
  eventType: 'CLAIM_STATUS_UPDATED',
  normalizedStatus: 'PENDING',
  rawStatusCode: '',
  summary: '',
  controlNumber: '',
  externalSubmissionId: '',
  claimControlNumber: '',
  clearinghouseTraceNumber: '',
  payerClaimNumber: '',
  acknowledgementType: '',
  statusCode: '',
  statusDescription: '',
  receivedDate: null,
  rejectionLevel: '',
  rejectionSource: '',
  rejectionReasonCodes: '',
  stcCategoryCode: '',
  stcStatusCode: '',
  stcEntityCode: '',
  affectedServiceLine: '',
  remediationCode: '',
  remediationFieldPath: '',
  remediationSeverity: '',
  nextActionRequired: '',
  active: true,
}

export function createClaimTrackingFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ClaimTrackingFormValues> {
  void referenceOptions
  return {
    schema: claimTrackingFormSchema,
    defaultValues: claimTrackingDefaultValues,
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
      required: true,
      helperText: 'Required. Manual tracking must be tied to the claim being followed up.',
    },
    {
      name: 'claimSubmissionId',
      label: 'Claim Submission ID',
      type: 'text',
      placeholder: 'Linked submission record ID',
    },
    {
      name: 'timestamp',
      label: 'Event Time',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'trackingSource',
      label: 'Source Type',
      type: 'select',
      options: trackingSourceOptions,
      helperText: 'REAL is a clearinghouse response; SIMULATED is deterministic test-mode lifecycle.',
    },
    {
      name: 'responseType',
      label: 'Response Type',
      type: 'select',
      options: responseTypeOptions,
    },
    {
      name: 'eventType',
      label: 'Event Type',
      type: 'select',
      options: eventTypeOptions,
    },
    {
      name: 'normalizedStatus',
      label: 'Normalized Status',
      type: 'select',
      options: normalizedStatusOptions,
    },
    {
      name: 'source',
      label: 'Source Label',
      type: 'text',
      placeholder: 'REAL_STEDI_RESPONSE or SIMULATED_TEST_RESPONSE',
    },
    {
      name: 'summary',
      label: 'Summary',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      placeholder: 'Timeline event summary',
    },
    {
      name: 'rawStatusCode',
      label: 'Raw Status Code',
      type: 'text',
      placeholder: 'A, R, A1:19, A3:21, PENDING',
    },
    {
      name: 'externalSubmissionId',
      label: 'External Submission ID',
      type: 'text',
      placeholder: 'Clearinghouse or simulated submission ID',
    },
    {
      name: 'controlNumber',
      label: 'Control Number',
      type: 'text',
      placeholder: '837/control number',
    },
    {
      name: 'claimControlNumber',
      label: 'Claim Control Number',
      type: 'text',
      placeholder: 'Clearinghouse claim control number',
    },
    {
      name: 'clearinghouseTraceNumber',
      label: 'Clearinghouse Trace Number',
      type: 'text',
      placeholder: 'Trace or batch reference',
    },
    {
      name: 'payerClaimNumber',
      label: 'Payer Claim Number',
      type: 'text',
      placeholder: 'Payer assigned claim number',
    },
    {
      name: 'acknowledgementType',
      label: 'Acknowledgement Type',
      type: 'select',
      placeholder: 'Select acknowledgement type',
      options: acknowledgementTypeOptions,
    },
    {
      name: 'statusCode',
      label: 'Status Code',
      type: 'text',
      placeholder: 'Example: A1, A3, R, 19, 20',
    },
    {
      name: 'statusDescription',
      label: 'Status Description',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      placeholder: 'Accepted, rejected, pending payer adjudication, paid, or manual follow-up note',
    },
    {
      name: 'receivedDate',
      label: 'Received Date',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'rejectionLevel',
      label: 'Rejection Level',
      type: 'select',
      placeholder: 'Select rejection level',
      options: rejectionLevelOptions,
    },
    {
      name: 'rejectionSource',
      label: 'Rejection Source',
      type: 'select',
      placeholder: 'Select rejection source',
      options: rejectionSourceOptions,
    },
    {
      name: 'rejectionReasonCodes',
      label: 'Rejection Reason Codes',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
      placeholder: 'Example: A7, 21, 109',
      helperText: 'Enter one code per line or separate values with commas.',
    },
    {
      name: 'nextActionRequired',
      label: 'Next Action Required',
      type: 'text',
      placeholder: 'Correct subscriber ID and resubmit, attach records, call payer, etc.',
    },
    {
      name: 'remediationCode',
      label: 'Remediation Code',
      type: 'text',
      placeholder: 'ACK277_SERVICE_LINE_REJECTED',
      disabled: true,
    },
    {
      name: 'remediationFieldPath',
      label: 'Remediation Field',
      type: 'text',
      placeholder: 'claim.claimLines',
      disabled: true,
    },
    {
      name: 'remediationSeverity',
      label: 'Remediation Severity',
      type: 'select',
      options: remediationSeverityOptions,
      disabled: true,
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

export function mapClaimTrackingToFormValues(item: ClaimTracking): ClaimTrackingFormValues {
  return {
    _id: item._id,
    claimId: item.claimId ?? '',
    claimSubmissionId: item.claimSubmissionId ?? '',
    timestamp: toFormDate(item.timestamp ?? item.receivedDate),
    source: item.source ?? (item.trackingSource === 'SIMULATED' ? 'SIMULATED_TEST_RESPONSE' : 'REAL_STEDI_RESPONSE'),
    trackingSource: item.trackingSource ?? 'REAL',
    responseType: item.responseType ?? 'STATUS_UPDATE',
    eventType: item.eventType ?? 'CLAIM_STATUS_UPDATED',
    normalizedStatus: item.normalizedStatus ?? 'PENDING',
    rawStatusCode: item.rawStatusCode ?? item.statusCode ?? '',
    summary: item.summary ?? item.statusDescription ?? '',
    controlNumber: item.controlNumber ?? item.claimControlNumber ?? '',
    externalSubmissionId: item.externalSubmissionId ?? '',
    claimControlNumber: item.claimControlNumber ?? '',
    clearinghouseTraceNumber: item.clearinghouseTraceNumber ?? '',
    payerClaimNumber: item.payerClaimNumber ?? '',
    acknowledgementType: item.acknowledgementType ?? '',
    statusCode: item.statusCode ?? '',
    statusDescription: item.statusDescription ?? '',
    receivedDate: toFormDate(item.receivedDate),
    rejectionLevel: item.rejectionLevel ?? '',
    rejectionSource: item.rejectionSource ?? '',
    rejectionReasonCodes: formatStringList(item.rejectionReasonCodes),
    stcCategoryCode: item.stcCategoryCode ?? '',
    stcStatusCode: item.stcStatusCode ?? '',
    stcEntityCode: item.stcEntityCode ?? '',
    affectedServiceLine: item.affectedServiceLine ?? '',
    remediationCode: item.remediationCode ?? '',
    remediationFieldPath: item.remediationFieldPath ?? '',
    remediationSeverity: item.remediationSeverity ?? '',
    nextActionRequired: item.nextActionRequired ?? '',
    active: item.active,
  }
}

export function mapClaimTrackingFormToPayload(values: ClaimTrackingFormValues): ClaimTrackingCreatePayload {
  return {
    claimId: optionalText(values.claimId),
    claimSubmissionId: optionalText(values.claimSubmissionId),
    timestamp: optionalDate(values.timestamp),
    source: optionalText(values.source),
    trackingSource: values.trackingSource,
    responseType: values.responseType,
    eventType: optionalText(values.eventType),
    normalizedStatus: optionalText(values.normalizedStatus),
    rawStatusCode: optionalText(values.rawStatusCode),
    summary: optionalText(values.summary),
    controlNumber: optionalText(values.controlNumber),
    externalSubmissionId: optionalText(values.externalSubmissionId),
    claimControlNumber: optionalText(values.claimControlNumber),
    clearinghouseTraceNumber: optionalText(values.clearinghouseTraceNumber),
    payerClaimNumber: optionalText(values.payerClaimNumber),
    acknowledgementType: optionalText(values.acknowledgementType),
    statusCode: optionalText(values.statusCode),
    statusDescription: optionalText(values.statusDescription),
    receivedDate: optionalDate(values.receivedDate),
    rejectionLevel: optionalText(values.rejectionLevel),
    rejectionSource: optionalText(values.rejectionSource),
    rejectionReasonCodes: parseStringList(values.rejectionReasonCodes),
    stcCategoryCode: optionalText(values.stcCategoryCode),
    stcStatusCode: optionalText(values.stcStatusCode),
    stcEntityCode: optionalText(values.stcEntityCode),
    affectedServiceLine: optionalText(values.affectedServiceLine),
    remediationCode: optionalText(values.remediationCode),
    remediationFieldPath: optionalText(values.remediationFieldPath),
    remediationSeverity: optionalText(values.remediationSeverity),
    nextActionRequired: optionalText(values.nextActionRequired),
    active: values.active,
  }
}

function getClaimTrackingLabel(item: ClaimTracking, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.eventType, item.normalizedStatus, item.claimControlNumber ?? item.controlNumber, formatDate(item.timestamp ?? item.receivedDate)].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createClaimTrackingTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<ClaimTracking>> {
  return [
    {
      key: 'record',
      header: 'Claim Tracking',
      sortField: 'timestamp',
      exportValue: (item) => getClaimTrackingLabel(item, referenceOptions),
      render: (item) => getClaimTrackingLabel(item, referenceOptions),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: false,
      exportValue: (item) => item.normalizedStatus ?? item.statusCode ?? '-',
      render: (item) => item.normalizedStatus ?? item.statusCode ?? '-',
      filter: {
        key: 'normalizedStatus',
        input: 'select',
        placeholder: 'Status',
        options: normalizedStatusOptions,
      },
    },
    {
      key: 'source',
      header: 'Source',
      sortable: false,
      exportValue: (item) => item.trackingSource ?? '-',
      render: (item) => item.trackingSource ?? '-',
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
      key: 'updatedAt',
      header: 'Updated',
      sortField: 'updated',
      field: 'updatedAt',
      exportValue: (item) => formatDate(item.timestamp ?? item.receivedDate ?? item.updatedAt),
      filter: {
        key: 'updatedAt',
        input: 'date',
        placeholder: 'Updated date',
      },
      render: (item) => formatDate(item.timestamp ?? item.receivedDate ?? item.updatedAt),
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

export function renderClaimTrackingDetails(item: ClaimTracking, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Claim Tracking</h3>
        {renderSection([
          ['tracking ID', item.trackingId],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['claim Submission ID', item.claimSubmissionId ?? '-'],
          ['event Time', formatDate(item.timestamp ?? item.receivedDate)],
          ['event Type', item.eventType ?? '-'],
          ['normalized Status', item.normalizedStatus ?? '-'],
          ['source', item.trackingSource ?? '-'],
          ['source Label', item.source ?? '-'],
          ['response Type', item.responseType ?? '-'],
          ['summary', item.summary ?? '-'],
          ['raw Status Code', item.rawStatusCode ?? item.statusCode ?? '-'],
          ['control Number', item.controlNumber ?? '-'],
          ['external Submission ID', item.externalSubmissionId ?? '-'],
          ['claim Control Number', item.claimControlNumber ?? '-'],
          ['clearinghouse Trace Number', item.clearinghouseTraceNumber ?? '-'],
          ['payer Claim Number', item.payerClaimNumber ?? '-'],
          ['acknowledgement Type', item.acknowledgementType ?? '-'],
          ['status Code', item.statusCode ?? '-'],
          ['status Description', item.statusDescription ?? '-'],
          ['received Date', formatDate(item.receivedDate)],
          ['rejection Level', item.rejectionLevel ?? '-'],
          ['rejection Source', item.rejectionSource ?? '-'],
          ['rejection Reason Codes', (item.rejectionReasonCodes ?? []).join(', ') || '-'],
          ['STC Category', item.stcCategoryCode ?? '-'],
          ['STC Status', item.stcStatusCode ?? '-'],
          ['STC Entity', item.stcEntityCode ?? '-'],
          ['Affected Service Line', item.affectedServiceLine ?? '-'],
          ['Remediation Code', item.remediationCode ?? '-'],
          ['Remediation Field', item.remediationFieldPath ?? '-'],
          ['Remediation Severity', item.remediationSeverity ?? '-'],
          ['next Action Required', item.nextActionRequired ?? '-'],
          ['response Status Code', formatNumber(item.responseStatusCode)],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
      <RcmAiInsightSection title="AI Rejection Analysis" variant="rejection" insight={item.aiRejectionAnalysis} />
      {item.responsePayloadRedacted ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Raw Redacted Response</h3>
          <pre className="max-h-80 overflow-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 text-xs text-[var(--color-text)]">
            {item.responsePayloadRedacted}
          </pre>
        </section>
      ) : null}
    </div>
  )
}

export function renderClaimTrackingGridItem(item: ClaimTracking, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getClaimTrackingLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">timeline status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.normalizedStatus ?? item.statusCode ?? '-'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">source</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.trackingSource ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
