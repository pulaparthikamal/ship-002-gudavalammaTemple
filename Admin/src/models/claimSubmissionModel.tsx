import { z } from 'zod'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import { formatReferenceLabel, type RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { ClaimSubmission, ClaimSubmissionCreatePayload, ClaimSubmissionFormValues } from '@/types/claimSubmission'

export const claimSubmissionApiDetails = {
  endpoint: '/rcm/claim-submissions',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const claimSubmissionFormSchema = z.object({
  _id: z.string().optional(),
  claimId: z.string().trim(),
  submissionMethod: z.string().trim(),
  submissionFileType: z.string().trim(),
  submissionDateTime: z.date().nullable(),
  clearinghouseName: z.string().trim(),
  batchId: z.string().trim(),
  submissionTraceId: z.string().trim(),
  transmissionStatus: z.string().trim(),
  acknowledgementStatus: z.string().trim(),
  acknowledgementDateTime: z.date().nullable(),
  submissionErrorCode: z.string().trim(),
  submissionErrorMessage: z.string().trim(),
  payloadSnapshot: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<ClaimSubmissionFormValues>

export const claimSubmissionDefaultValues: ClaimSubmissionFormValues = {
  _id: '',
  claimId: '',
  submissionMethod: '',
  submissionFileType: '',
  submissionDateTime: null,
  clearinghouseName: '',
  batchId: '',
  submissionTraceId: '',
  transmissionStatus: '',
  acknowledgementStatus: '',
  acknowledgementDateTime: null,
  submissionErrorCode: '',
  submissionErrorMessage: '',
  payloadSnapshot: '',
  active: true,
}

export function createClaimSubmissionFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<ClaimSubmissionFormValues> {
  void referenceOptions
  return {
    schema: claimSubmissionFormSchema,
    defaultValues: claimSubmissionDefaultValues,
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
      name: 'submissionMethod',
      label: 'submission Method',
      type: 'text',
      placeholder: 'submission Method',
    },
    {
      name: 'submissionFileType',
      label: 'submission File Type',
      type: 'text',
      placeholder: 'submission File Type',
    },
    {
      name: 'submissionDateTime',
      label: 'submission Date Time',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'clearinghouseName',
      label: 'clearinghouse Name',
      type: 'text',
      placeholder: 'clearinghouse Name',
    },
    {
      name: 'batchId',
      label: 'batch ID',
      type: 'text',
      placeholder: 'batch ID',
    },
    {
      name: 'submissionTraceId',
      label: 'submission Trace ID',
      type: 'text',
      placeholder: 'submission Trace ID',
    },
    {
      name: 'transmissionStatus',
      label: 'transmission Status',
      type: 'text',
      placeholder: 'transmission Status',
    },
    {
      name: 'acknowledgementStatus',
      label: 'acknowledgement Status',
      type: 'text',
      placeholder: 'acknowledgement Status',
    },
    {
      name: 'acknowledgementDateTime',
      label: 'acknowledgement Date Time',
      type: 'date',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'submissionErrorCode',
      label: 'submission Error Code',
      type: 'text',
      placeholder: 'submission Error Code',
    },
    {
      name: 'submissionErrorMessage',
      label: 'submission Error Message',
      type: 'textarea',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'payloadSnapshot',
      label: 'payload Snapshot',
      type: 'textarea',
      rows: 4,
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

export function mapClaimSubmissionToFormValues(item: ClaimSubmission): ClaimSubmissionFormValues {
  return {
    _id: item._id,
    claimId: item.claimId ?? '',
    submissionMethod: item.submissionMethod ?? '',
    submissionFileType: item.submissionFileType ?? '',
    submissionDateTime: toFormDate(item.submissionDateTime),
    clearinghouseName: item.clearinghouseName ?? '',
    batchId: item.batchId ?? '',
    submissionTraceId: item.submissionTraceId ?? '',
    transmissionStatus: item.transmissionStatus ?? '',
    acknowledgementStatus: item.acknowledgementStatus ?? '',
    acknowledgementDateTime: toFormDate(item.acknowledgementDateTime),
    submissionErrorCode: item.submissionErrorCode ?? '',
    submissionErrorMessage: item.submissionErrorMessage ?? '',
    payloadSnapshot: item.payloadSnapshot ?? '',
    active: item.active,
  }
}

export function mapClaimSubmissionFormToPayload(values: ClaimSubmissionFormValues): ClaimSubmissionCreatePayload {
  return {
    claimId: optionalText(values.claimId),
    submissionMethod: optionalText(values.submissionMethod),
    submissionFileType: optionalText(values.submissionFileType),
    submissionDateTime: optionalDate(values.submissionDateTime),
    clearinghouseName: optionalText(values.clearinghouseName),
    batchId: optionalText(values.batchId),
    submissionTraceId: optionalText(values.submissionTraceId),
    transmissionStatus: optionalText(values.transmissionStatus),
    acknowledgementStatus: optionalText(values.acknowledgementStatus),
    acknowledgementDateTime: optionalDate(values.acknowledgementDateTime),
    submissionErrorCode: optionalText(values.submissionErrorCode),
    submissionErrorMessage: optionalText(values.submissionErrorMessage),
    payloadSnapshot: optionalText(values.payloadSnapshot),
    active: values.active,
  }
}

function getClaimSubmissionLabel(item: ClaimSubmission, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.batchId, item.transmissionStatus].filter((value) => value && value !== '-').join(' / ') || item._id
}

export function createClaimSubmissionTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<ClaimSubmission>> {
  return [
    {
      key: 'record',
      header: 'Claim Submission',
      sortField: 'batchId',
      exportValue: (item) => getClaimSubmissionLabel(item, referenceOptions),
      render: (item) => getClaimSubmissionLabel(item, referenceOptions),
    },
    {
      key: 'transmissionStatus',
      header: 'transmission Status',
      filterable: true,
      field: 'transmissionStatus',
      sortField: 'transmissionStatus',
      exportValue: (item) => item.transmissionStatus ?? '-',
      render: (item) => item.transmissionStatus ?? '-',
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

export function renderClaimSubmissionDetails(item: ClaimSubmission, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Claim Submission</h3>
        {renderSection([
          ['submission ID', item.submissionId],
          ['claim ID', formatReferenceLabel(referenceOptions.claims, item.claimId)],
          ['submission Method', item.submissionMethod ?? '-'],
          ['submission File Type', item.submissionFileType ?? '-'],
          ['submission Date Time', formatDate(item.submissionDateTime)],
          ['clearinghouse Name', item.clearinghouseName ?? '-'],
          ['batch ID', item.batchId ?? '-'],
          ['submission Trace ID', item.submissionTraceId ?? '-'],
          ['transmission Status', item.transmissionStatus ?? '-'],
          ['acknowledgement Status', item.acknowledgementStatus ?? '-'],
          ['acknowledgement Date Time', formatDate(item.acknowledgementDateTime)],
          ['submission Error Code', item.submissionErrorCode ?? '-'],
          ['submission Error Message', item.submissionErrorMessage ?? '-'],
          ['payload Snapshot', item.payloadSnapshot ?? '-'],
          ['active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderClaimSubmissionGridItem(item: ClaimSubmission, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getClaimSubmissionLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">transmission Status</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.transmissionStatus ?? '-'}</dd>
        </div>
      </dl>
    </div>
  )
}
