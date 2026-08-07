import { z } from 'zod'
import { RcmAiInsightSection } from '@/components/rcm/RcmAiInsightSection'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { EraException, EraExceptionCreatePayload, EraExceptionFormValues } from '@/types/eraException'

export const eraExceptionApiDetails = {
  endpoint: '/rcm/era-exceptions',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const eraExceptionFormSchema = z.object({
  _id: z.string().optional(),
  exceptionType: z.string().trim().min(1),
  severity: z.string().trim(),
  status: z.string().trim(),
  assignedTo: z.string().trim(),
  resolutionNotes: z.string().trim(),
  ignoredReason: z.string().trim(),
  relatedClaim: z.string().trim(),
  relatedERA: z.string().trim(),
  relatedPaymentPosting: z.string().trim(),
  relatedDenial: z.string().trim(),
  relatedARWorkItem: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<EraExceptionFormValues>

export const eraExceptionDefaultValues: EraExceptionFormValues = {
  _id: '',
  exceptionType: 'UNMATCHED_ERA',
  severity: 'MEDIUM',
  status: 'OPEN',
  assignedTo: '',
  resolutionNotes: '',
  ignoredReason: '',
  relatedClaim: '',
  relatedERA: '',
  relatedPaymentPosting: '',
  relatedDenial: '',
  relatedARWorkItem: '',
  active: true,
}

function optionalText(value: string) {
  const trimmed = value.trim()
  return trimmed ? trimmed : undefined
}

export function createEraExceptionFormConfig(): CrudFormConfig<EraExceptionFormValues> {
  return {
    schema: eraExceptionFormSchema,
    defaultValues: eraExceptionDefaultValues,
    columns: 2,
    fields: [
      { name: '_id', label: 'ID', type: 'hidden' },
      {
        name: 'exceptionType',
        label: 'Exception Type',
        type: 'select',
        options: ['UNMATCHED_ERA', 'DUPLICATE_ERA', 'CLAIM_NOT_FOUND', 'SERVICE_LINE_MISMATCH', 'UNDERPAYMENT_VARIANCE', 'OVERPAYMENT_VARIANCE', 'POSTING_IMBALANCE', 'MISSING_PAYMENT_POSTING', 'DENIED_SERVICE_LINE', 'UNRESOLVED_ADJUSTMENT'].map((value) => ({ label: value, value })),
      },
      {
        name: 'severity',
        label: 'Severity',
        type: 'select',
        options: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => ({ label: value, value })),
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        options: ['OPEN', 'IN_REVIEW', 'ESCALATED', 'REPROCESSING', 'RESOLVED', 'IGNORED'].map((value) => ({ label: value, value })),
      },
      { name: 'assignedTo', label: 'Assigned To', type: 'text' },
      { name: 'relatedClaim', label: 'Claim ID', type: 'text' },
      { name: 'relatedERA', label: 'ERA ID', type: 'text' },
      { name: 'relatedPaymentPosting', label: 'Payment Posting ID', type: 'text' },
      { name: 'resolutionNotes', label: 'Resolution Notes', type: 'textarea', rows: 3, fullWidth: true },
      { name: 'ignoredReason', label: 'Ignored Reason', type: 'textarea', rows: 2, fullWidth: true },
      { name: 'active', label: 'Active', type: 'switch' },
    ],
  }
}

export function createEraExceptionTableColumns(): CrudTableColumn<EraException>[] {
  return [
    { field: 'exceptionType', header: 'Type', sortable: true },
    { field: 'severity', header: 'Severity', sortable: true },
    { field: 'status', header: 'Status', sortable: true },
    { field: 'assignedTo', header: 'Owner', sortable: true },
    { field: 'relatedClaim', header: 'Claim' },
    { field: 'updatedAt', header: 'Updated', sortable: true },
  ]
}

export function mapEraExceptionToFormValues(item: EraException): EraExceptionFormValues {
  return {
    _id: item._id,
    exceptionType: item.exceptionType ?? '',
    severity: item.severity ?? '',
    status: item.status ?? '',
    assignedTo: item.assignedTo ?? '',
    resolutionNotes: item.resolutionNotes ?? '',
    ignoredReason: item.ignoredReason ?? '',
    relatedClaim: item.relatedClaim ?? '',
    relatedERA: item.relatedERA ?? '',
    relatedPaymentPosting: item.relatedPaymentPosting ?? '',
    relatedDenial: item.relatedDenial ?? '',
    relatedARWorkItem: item.relatedARWorkItem ?? '',
    active: item.active,
  }
}

export function mapEraExceptionFormToPayload(values: EraExceptionFormValues): EraExceptionCreatePayload {
  return {
    exceptionType: values.exceptionType,
    severity: optionalText(values.severity),
    status: optionalText(values.status),
    assignedTo: optionalText(values.assignedTo),
    resolutionNotes: optionalText(values.resolutionNotes),
    ignoredReason: optionalText(values.ignoredReason),
    relatedClaim: optionalText(values.relatedClaim),
    relatedERA: optionalText(values.relatedERA),
    relatedPaymentPosting: optionalText(values.relatedPaymentPosting),
    relatedDenial: optionalText(values.relatedDenial),
    relatedARWorkItem: optionalText(values.relatedARWorkItem),
    active: values.active,
  }
}

export function renderEraExceptionDetails(item: EraException) {
  return (
    <div className="space-y-5">
      <div className="grid gap-3 text-sm sm:grid-cols-2">
        <div><span className="font-semibold">Type:</span> {item.exceptionType}</div>
        <div><span className="font-semibold">Status:</span> {item.status ?? '-'}</div>
        <div><span className="font-semibold">Severity:</span> {item.severity ?? '-'}</div>
        <div><span className="font-semibold">Assigned:</span> {item.assignedTo ?? '-'}</div>
        <div><span className="font-semibold">Claim:</span> {item.relatedClaim ?? '-'}</div>
        <div><span className="font-semibold">ERA:</span> {item.relatedERA ?? '-'}</div>
        <div className="sm:col-span-2"><span className="font-semibold">Resolution:</span> {item.resolutionNotes ?? '-'}</div>
      </div>
      <RcmAiInsightSection title="AI Exception Analysis" variant="era-exception" insight={item.aiAnalysis} history={item.aiRecommendationHistory} />
    </div>
  )
}

export function renderEraExceptionGridItem(item: EraException) {
  return `${item.exceptionType} - ${item.status ?? 'OPEN'}`
}
