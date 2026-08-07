import { z } from 'zod'
import { ExternalLink } from 'lucide-react'
import type { CrudFormConfig, CrudTableColumn } from '@/types/crud'
import type { RcmReferenceOptions } from '@/models/rcmReferenceOptions'
import type { Document, DocumentCreatePayload, DocumentFormValues } from '@/types/document'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { getFileNameFromPath } from '@/utils/fileUploads'
import { formatReferenceLabel } from '@/models/rcmReferenceOptions'

export const documentApiDetails = {
  endpoint: '/rcm/documents',
  filterQueryParam: 'filter',
  responseDataPath: 'data',
  responseTotalPath: 'meta.total',
} as const

export const documentEntityTypeOptions = [
  { label: 'Patient', value: 'patient' },
  { label: 'Insurance policy', value: 'insurancePolicy' },
  { label: 'Appointment', value: 'appointment' },
  { label: 'Encounter', value: 'encounter' },
  { label: 'Charge', value: 'charge' },
  { label: 'Coding review', value: 'codingReview' },
  { label: 'Claim', value: 'claim' },
  { label: 'Claim submission', value: 'claimSubmission' },
  { label: 'Claim tracking', value: 'claimTracking' },
  { label: 'ERA / EOB', value: 'eraEobProcessing' },
  { label: 'Payment posting', value: 'paymentPosting' },
  { label: 'Denial', value: 'denial' },
  { label: 'Appeal', value: 'appeal' },
  { label: 'Corrected claim', value: 'correctedClaim' },
  { label: 'AR work item', value: 'arWorkItem' },
  { label: 'Patient billing', value: 'patientBilling' },
  { label: 'Collection', value: 'collection' },
] as const

export const documentTypeOptions = [
  { label: 'Clinical note', value: 'Clinical Note' },
  { label: 'Patient ID', value: 'Patient ID' },
  { label: 'Insurance card', value: 'Insurance Card' },
  { label: 'Eligibility response', value: 'Eligibility Response' },
  { label: 'Referral', value: 'Referral' },
  { label: 'Prior authorization', value: 'Prior Authorization' },
  { label: 'Charge support', value: 'Charge Support' },
  { label: 'Claim attachment', value: 'Claim Attachment' },
  { label: 'ERA / EOB', value: 'ERA / EOB' },
  { label: 'Denial letter', value: 'Denial Letter' },
  { label: 'Appeal packet', value: 'Appeal Packet' },
  { label: 'Corrected claim support', value: 'Corrected Claim Support' },
  { label: 'Patient statement', value: 'Patient Statement' },
  { label: 'Other', value: 'Other' },
] as const

export const documentFormSchema = z.object({
  _id: z.string().optional(),
  patientId: z.string().trim(),
  encounterId: z.string().trim(),
  claimId: z.string().trim(),
  denialId: z.string().trim(),
  appealId: z.string().trim(),
  eraId: z.string().trim(),
  paymentPostingId: z.string().trim(),
  entityType: z.string().trim(),
  entityId: z.string().trim(),
  documentCategory: z.string().trim(),
  uploadSource: z.string().trim(),
  documentType: z.string().trim().min(1, 'Document type is required.'),
  fileName: z.string().trim(),
  fileType: z.string().trim(),
  fileSize: z.number().nullable(),
  fileUrl: z.string().trim().min(1, 'Upload a document before saving.'),
  mimeType: z.string().trim(),
  uploadedBy: z.string().trim(),
  uploadedAt: z.date().nullable(),
  tags: z.string().trim(),
  description: z.string().trim(),
  active: z.boolean(),
}) as z.ZodType<DocumentFormValues>

export const documentDefaultValues: DocumentFormValues = {
  _id: '',
  patientId: '',
  encounterId: '',
  claimId: '',
  denialId: '',
  appealId: '',
  eraId: '',
  paymentPostingId: '',
  entityType: '',
  entityId: '',
  documentCategory: '',
  uploadSource: '',
  documentType: '',
  fileName: '',
  fileType: '',
  fileSize: null,
  fileUrl: '',
  mimeType: '',
  uploadedBy: '',
  uploadedAt: null,
  tags: '',
  description: '',
  active: true,
}

export function createDocumentFormConfig(
  referenceOptions: RcmReferenceOptions = {},
): CrudFormConfig<DocumentFormValues> {
  void referenceOptions
  return {
    schema: documentFormSchema,
    defaultValues: documentDefaultValues,
    columns: 2,
    fields: [
      {
        name: '_id',
        label: 'ID',
        type: 'hidden',
      },
    {
      name: 'patientId',
      label: 'Patient',
      type: 'autocomplete',
      section: 'Workflow link',
      placeholder: 'Select patient',
      options: referenceOptions.patients ?? [],
      autocomplete: {
        dropdown: true,
        forceSelection: true,
        emptyMessage: 'No patients found',
      },
    },
    {
      name: 'entityType',
      label: 'Linked module',
      type: 'select',
      section: 'Workflow link',
      placeholder: 'Select linked module',
      options: [...documentEntityTypeOptions],
    },
    {
      name: 'entityId',
      label: 'Entity ID',
      type: 'text',
      section: 'Workflow link',
      placeholder: 'Paste the linked record ID',
      helperText: 'Used to find documents from patient, encounter, claim, denial, and appeal workflows.',
    },
    {
      name: 'documentType',
      label: 'Document type',
      type: 'select',
      section: 'Document',
      placeholder: 'Select document type',
      options: [...documentTypeOptions],
      required: true,
    },
    {
      name: 'fileUrl',
      label: 'Document file',
      type: 'upload',
      section: 'Document',
      fullWidth: true,
      required: true,
      upload: {
        accept: '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.csv,.txt',
        chooseLabel: 'Upload document',
        emptyMessage: 'No document uploaded yet.',
        folder: 'rcm-documents',
      },
    },
    {
      name: 'fileName',
      label: 'Display file name',
      type: 'text',
      section: 'Document',
      placeholder: 'Defaults to uploaded file name',
    },
    {
      name: 'mimeType',
      label: 'MIME type',
      type: 'text',
      section: 'Document',
      placeholder: 'application/pdf',
    },
    {
      name: 'uploadedBy',
      label: 'Uploaded by',
      type: 'text',
      section: 'Audit',
      placeholder: 'User, team, or source system',
    },
    {
      name: 'uploadedAt',
      label: 'Uploaded at',
      type: 'date',
      section: 'Audit',
      date: {
        showButtonBar: true,
      },
    },
    {
      name: 'tags',
      label: 'Tags',
      type: 'textarea',
      section: 'Metadata',
      rows: 3,
      fullWidth: true,
      helperText: 'Enter one value per line or separate values with commas.',
    },
    {
      name: 'description',
      label: 'Description',
      type: 'textarea',
      section: 'Metadata',
      rows: 3,
      fullWidth: true,
    },
    {
      name: 'active',
      label: 'Active',
      type: 'switch',
      section: 'Metadata',
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

export function mapDocumentToFormValues(item: Document): DocumentFormValues {
  return {
    _id: item._id,
    patientId: item.patientId ?? '',
    encounterId: item.encounterId ?? '',
    claimId: item.claimId ?? '',
    denialId: item.denialId ?? '',
    appealId: item.appealId ?? '',
    eraId: item.eraId ?? '',
    paymentPostingId: item.paymentPostingId ?? '',
    entityType: item.entityType ?? '',
    entityId: item.entityId ?? '',
    documentCategory: item.documentCategory ?? item.documentType ?? '',
    uploadSource: item.uploadSource ?? '',
    documentType: item.documentType ?? item.documentCategory ?? '',
    fileName: item.fileName ?? '',
    fileType: item.fileType ?? item.mimeType ?? '',
    fileSize: item.fileSize ?? null,
    fileUrl: item.fileUrl ?? '',
    mimeType: item.mimeType ?? item.fileType ?? '',
    uploadedBy: item.uploadedBy ?? '',
    uploadedAt: toFormDate(item.uploadedAt),
    tags: formatStringList(item.tags),
    description: item.description ?? '',
    active: item.active,
  }
}

export function mapDocumentFormToPayload(values: DocumentFormValues): DocumentCreatePayload {
  const fileUrl = optionalText(values.fileUrl)

  return {
    patientId: optionalText(values.patientId),
    encounterId: optionalText(values.encounterId),
    claimId: optionalText(values.claimId),
    denialId: optionalText(values.denialId),
    appealId: optionalText(values.appealId),
    eraId: optionalText(values.eraId),
    paymentPostingId: optionalText(values.paymentPostingId),
    entityType: optionalText(values.entityType),
    entityId: optionalText(values.entityId),
    documentCategory: optionalText(values.documentCategory) ?? optionalText(values.documentType),
    uploadSource: optionalText(values.uploadSource),
    documentType: optionalText(values.documentType) ?? optionalText(values.documentCategory),
    fileName: optionalText(values.fileName) ?? (fileUrl ? getFileNameFromPath(fileUrl) : undefined),
    fileType: optionalText(values.fileType) ?? optionalText(values.mimeType),
    fileSize: optionalNumber(values.fileSize),
    fileUrl,
    mimeType: optionalText(values.mimeType) ?? optionalText(values.fileType),
    uploadedBy: optionalText(values.uploadedBy),
    uploadedAt: optionalDate(values.uploadedAt),
    tags: parseStringList(values.tags),
    description: optionalText(values.description),
    active: values.active,
  }
}

function getDocumentLabel(item: Document, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return [item.fileName, item.documentType, formatDate(item.uploadedAt)].filter((value) => value && value !== '-').join(' / ') || item._id
}

function formatEntityType(value?: string) {
  if (!value) {
    return '-'
  }

  return documentEntityTypeOptions.find((option) => option.value === value)?.label ?? value
}

function getPatientName(item: Document, referenceOptions: RcmReferenceOptions = {}) {
  return formatReferenceLabel(referenceOptions.patients, item.patientId)
}

function getResolvedFileUrl(item: Document) {
  return item.fileUrl ? resolveApiAssetUrl(item.fileUrl) : ''
}

export function createDocumentTableColumns(referenceOptions: RcmReferenceOptions = {}): Array<CrudTableColumn<Document>> {
  return [
    {
      key: 'record',
      header: 'File Name',
      sortField: 'fileName',
      exportValue: (item) => getDocumentLabel(item, referenceOptions),
      render: (item) => getDocumentLabel(item, referenceOptions),
    },
    {
      key: 'patientId',
      header: 'Patient Name',
      sortField: 'patientId',
      field: 'patientId',
      exportValue: (item) => getPatientName(item, referenceOptions),
      filter: {
        key: 'patientId',
        input: 'select',
        placeholder: 'Patient',
        options: referenceOptions.patients ?? [],
      },
      render: (item) => getPatientName(item, referenceOptions),
    },
    {
      key: 'documentType',
      header: 'Category',
      sortField: 'documentType',
      field: 'documentType',
      filter: {
        key: 'documentType',
        input: 'select',
        placeholder: 'Document category',
        options: [...documentTypeOptions],
      },
      render: (item) => item.documentType ?? '-',
    },
    {
      key: 'entityType',
      header: 'Linked Module',
      sortField: 'entityType',
      field: 'entityType',
      exportValue: (item) => formatEntityType(item.entityType),
      filter: {
        key: 'entityType',
        input: 'select',
        placeholder: 'Linked module',
        options: [...documentEntityTypeOptions],
      },
      render: (item) => formatEntityType(item.entityType),
    },
    {
      key: 'entityId',
      header: 'Linked Record',
      field: 'entityId',
      exportValue: (item) => [formatEntityType(item.entityType), item.entityId].filter((value) => value && value !== '-').join(' / '),
      render: (item) => (
        <div className="space-y-1">
          <p className="break-all text-sm font-semibold text-[var(--color-text-strong)]">{item.entityId ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'uploadedBy',
      header: 'Uploaded By',
      sortField: 'uploadedBy',
      field: 'uploadedBy',
      exportValue: (item) => item.uploadedBy ?? '-',
      render: (item) => item.uploadedBy ?? '-',
    },
    {
      key: 'created',
      header: 'Uploaded Date',
      sortField: 'uploadedAt',
      field: 'uploadedAt',
      filter: {
        key: 'uploadedAt',
        input: 'date',
        placeholder: 'Uploaded date',
      },
      render: (item) => formatDate(item.uploadedAt),
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

export function renderDocumentDetails(item: Document, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  const fileUrl = getResolvedFileUrl(item)

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-lg font-semibold text-[var(--color-text-strong)]">Document</h3>
        {fileUrl ? (
          <a
            href={fileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-md border border-[var(--color-border)] px-3 py-2 text-sm font-semibold text-[var(--color-primary)] transition-colors hover:bg-[var(--color-hover)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open document
          </a>
        ) : null}
        {renderSection([
          ['Document ID', item.documentId],
          ['Patient', getPatientName(item, referenceOptions)],
          ['Entity type', formatEntityType(item.entityType)],
          ['Entity ID', item.entityId ?? '-'],
          ['Document type', item.documentType ?? '-'],
          ['File name', item.fileName ?? (item.fileUrl ? getFileNameFromPath(item.fileUrl) : '-')],
          ['File URL', item.fileUrl ?? '-'],
          ['MIME type', item.mimeType ?? '-'],
          ['Uploaded by', item.uploadedBy ?? '-'],
          ['Uploaded at', formatDate(item.uploadedAt)],
          ['Tags', (item.tags ?? []).join(', ') || '-'],
          ['Description', item.description ?? '-'],
          ['Active', formatBoolean(item.active)],
        ])}
      </section>
    </div>
  )
}

export function renderDocumentGridItem(item: Document, referenceOptions: RcmReferenceOptions = {}) {
  void referenceOptions
  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-[var(--color-text-strong)]">{getDocumentLabel(item, referenceOptions)}</p>
      <dl className="space-y-2">
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Document type</dt>
          <dd className="text-[13px] font-medium text-[var(--color-text-strong)]">{item.documentType ?? '-'}</dd>
        </div>
        <div className="space-y-1">
          <dt className="text-[10px] font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Linked record</dt>
          <dd className="break-all text-[13px] font-medium text-[var(--color-text-strong)]">
            {[formatEntityType(item.entityType), item.entityId].filter((value) => value && value !== '-').join(' / ') || '-'}
          </dd>
        </div>
      </dl>
    </div>
  )
}
