import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Download, ExternalLink, FileText, Link2, RefreshCw, X } from 'lucide-react'
import { Button } from 'primereact/button'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useGetDocumentsQuery } from '@/services/api/endpoints/documentsApi'
import { useGetEncountersQuery } from '@/services/api/endpoints/encountersApi'
import { useGetPatientsQuery } from '@/services/api/endpoints/patientsApi'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { hasModuleAccess } from '@/utils/permissions'
import { getFileNameFromPath } from '@/utils/fileUploads'
import type { Document } from '@/types/document'
import type { Encounter } from '@/types/encounter'
import type { Patient } from '@/types/patient'

const repositoryQuery = {
  page: 1,
  limit: 500,
  sortfield: 'uploadedAt',
  direction: 'desc' as const,
  criteria: [],
}

const moduleRouteMap: Record<string, string> = {
  appeal: '/rcm/appeals',
  authorization: '/rcm/prior-authorizations',
  claim: '/rcm/claims',
  denial: '/rcm/denials',
  encounter: '/rcm/encounters',
  era: '/rcm/era-eob-processings',
  eraEobProcessing: '/rcm/era-eob-processings',
  eligibility: '/rcm/eligibility-verifications',
  insurancePolicy: '/rcm/insurance-policies',
  patient: '/rcm/patients',
  paymentPosting: '/rcm/payment-postings',
}

const linkedRecordQueryParamMap: Record<string, string> = {
  appeal: 'appealId',
  claim: 'claimId',
  denial: 'denialId',
  encounter: 'encounterId',
  era: 'eraEobProcessingId',
  eraEobProcessing: 'eraEobProcessingId',
  patient: 'patientId',
  paymentPosting: 'paymentPostingId',
}

const billingDocumentMatchers = [
  'appeal',
  'authorization',
  'billing',
  'claim',
  'denial',
  'eligibility',
  'eob',
  'era',
  'payment',
]

type DocumentFilters = {
  patientId: string
  encounterId: string
  category: string
  uploadSource: string
  uploadedBy: string
  uploadDate: string
}

type EncounterGroup = {
  encounterId: string
  encounterLabel: string
  documents: Document[]
}

type PatientGroup = {
  patientId: string
  patientLabel: string
  encounters: EncounterGroup[]
}

const initialFilters: DocumentFilters = {
  patientId: '',
  encounterId: '',
  category: '',
  uploadSource: '',
  uploadedBy: '',
  uploadDate: '',
}

function normalizeRole(value: string) {
  return value.trim().toLowerCase().replace(/[_\s-]+/g, '')
}

function hasRole(userRoles: string[] | undefined, role: string) {
  const expectedRole = normalizeRole(role)
  return Boolean(userRoles?.some((userRole) => normalizeRole(userRole).includes(expectedRole)))
}

function getPatientLabel(patient?: Patient, fallbackId?: string) {
  if (!patient) {
    return fallbackId ? `Unmatched patient ${fallbackId}` : 'Unlinked patient'
  }

  const name = [patient.firstName, patient.lastName].filter(Boolean).join(' ').trim()
  return `${name || 'Unnamed patient'}${patient.medicalRecordNumber ? ` (${patient.medicalRecordNumber})` : ''}`
}

function getEncounterLabel(encounter?: Encounter, fallbackId?: string) {
  if (!encounter) {
    return fallbackId ? `Encounter ${fallbackId}` : 'Documents without encounter'
  }

  return encounter.encounterId ? `Encounter #${encounter.encounterId}` : `Encounter ${encounter._id}`
}

function getDocumentCategory(document: Document) {
  return document.documentCategory || document.documentType || 'Uploaded Document'
}

function getUploadSource(document: Document) {
  return document.uploadSource || document.entityType || 'Documents Library'
}

function getEffectivePatientId(document: Document, encounterById: Map<string, Encounter>) {
  const encounterId = document.encounterId || (document.entityType === 'encounter' ? document.entityId : undefined)
  return document.patientId || (encounterId ? encounterById.get(encounterId)?.patientId : undefined)
}

function getLinkedRecordType(document: Document) {
  if (document.appealId) return 'appeal'
  if (document.denialId) return 'denial'
  if (document.paymentPostingId) return 'paymentPosting'
  if (document.eraId) return 'eraEobProcessing'
  if (document.claimId) return 'claim'
  if (document.encounterId) return 'encounter'
  if (document.patientId) return 'patient'
  return document.entityType
}

function getLinkedRecordId(document: Document) {
  return (
    document.appealId ||
    document.denialId ||
    document.paymentPostingId ||
    document.eraId ||
    document.claimId ||
    document.encounterId ||
    document.patientId ||
    document.entityId
  )
}

function formatDate(value?: string | Date | null) {
  if (!value) return '-'

  const dateValue = new Date(value)
  if (Number.isNaN(dateValue.getTime())) return '-'

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(dateValue)
}

function formatBytes(value?: number) {
  if (!value) return '-'
  if (value < 1024) return `${value} B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function fileName(document: Document) {
  return document.fileName || (document.fileUrl ? getFileNameFromPath(document.fileUrl) : 'Untitled document')
}


function downloadDocument(document: Document) {
  if (!document.fileUrl) return

  const link = window.document.createElement('a')
  link.href = resolveApiAssetUrl(document.fileUrl)
  link.download = fileName(document)
  link.target = '_blank'
  window.document.body.appendChild(link)
  link.click()
  window.document.body.removeChild(link)
}

function makeOptions(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

function isBillingDocument(document: Document) {
  const haystack = [
    document.entityType,
    document.documentCategory,
    document.documentType,
    document.uploadSource,
    document.claimId,
    document.denialId,
    document.appealId,
    document.eraId,
    document.paymentPostingId,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  return billingDocumentMatchers.some((matcher) => haystack.includes(matcher))
}

function matchesUploadDate(document: Document, uploadDate: string) {
  if (!uploadDate) return true
  if (!document.uploadedAt) return false

  const dateValue = new Date(document.uploadedAt)
  return !Number.isNaN(dateValue.getTime()) && dateValue.toISOString().slice(0, 10) === uploadDate
}

function buildPatientGroups(
  documents: Document[],
  patientById: Map<string, Patient>,
  encounterById: Map<string, Encounter>,
): PatientGroup[] {
  const patientGroups = new Map<string, Map<string, Document[]>>()

  documents.forEach((document) => {
    const encounterId = document.encounterId || (document.entityType === 'encounter' ? document.entityId : undefined) || 'no-encounter'
    const patientId = getEffectivePatientId(document, encounterById) || 'unlinked'

    if (!patientGroups.has(patientId)) {
      patientGroups.set(patientId, new Map())
    }

    const encounters = patientGroups.get(patientId)!
    if (!encounters.has(encounterId)) {
      encounters.set(encounterId, [])
    }
    encounters.get(encounterId)!.push(document)
  })

  return Array.from(patientGroups.entries()).map(([patientId, encounters]) => ({
    patientId,
    patientLabel: getPatientLabel(patientById.get(patientId), patientId === 'unlinked' ? undefined : patientId),
    encounters: Array.from(encounters.entries()).map(([encounterId, encounterDocuments]) => ({
      encounterId,
      encounterLabel: getEncounterLabel(
        encounterById.get(encounterId),
        encounterId === 'no-encounter' ? undefined : encounterId,
      ),
      documents: encounterDocuments,
    })),
  }))
}

function buildPatientAttachmentFallbackDocuments(patients: Patient[], documents: Document[]): Document[] {
  const registeredPatientAttachmentUrls = new Set(
    documents
      .filter((document) => document.fileUrl && (document.patientId || document.entityId))
      .map((document) => `${document.patientId ?? document.entityId}:${document.fileUrl}`),
  )

  return patients.flatMap((patient) =>
    (patient.attachments ?? [])
      .filter((attachment) => Boolean(attachment.fileUrl?.trim()))
      .filter((attachment) => !registeredPatientAttachmentUrls.has(`${patient._id}:${attachment.fileUrl}`))
      .map((attachment, index) => ({
        _id: `patient-attachment:${patient._id}:${index}:${attachment.fileUrl}`,
        documentId: `patient-attachment:${patient._id}:${index}`,
        patientId: patient._id,
        entityType: 'patient',
        entityId: patient._id,
        documentCategory: attachment.documentType || 'Patient Document',
        uploadSource: 'Patients',
        documentType: attachment.documentType || 'Patient Document',
        fileName: attachment.title || (attachment.fileUrl ? getFileNameFromPath(attachment.fileUrl) : undefined),
        fileUrl: attachment.fileUrl,
        uploadedAt: patient.updatedAt,
        description: attachment.description,
        active: true,
        createdAt: patient.createdAt,
        updatedAt: patient.updatedAt,
      }))
  )
}

export function DocumentsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const currentUser = useAppSelector(selectCurrentUser)
  const [filters, setFilters] = useState<DocumentFilters>(initialFilters)

  const documentsQuery = useGetDocumentsQuery(repositoryQuery, { pollingInterval: 30000 })
  const patientsQuery = useGetPatientsQuery(repositoryQuery)
  const encountersQuery = useGetEncountersQuery(repositoryQuery)

  const documentRecords = documentsQuery.data?.data ?? []
  const patients = patientsQuery.data?.data ?? []
  const encounters = encountersQuery.data?.data ?? []
  const documents = useMemo(
    () => [
      ...documentRecords,
      ...buildPatientAttachmentFallbackDocuments(patients, documentRecords),
    ],
    [documentRecords, patients],
  )

  const patientById = useMemo(() => new Map(patients.map((patient) => [patient._id, patient])), [patients])
  const encounterById = useMemo(() => new Map(encounters.map((encounter) => [encounter._id, encounter])), [encounters])
  const assignedPatientIds = useMemo(
    () =>
      new Set(
        encounters
          .filter((encounter) =>
            [encounter.providerId, encounter.renderingProviderId, encounter.supervisingProviderId].includes(currentUser?.id),
          )
          .map((encounter) => encounter.patientId)
          .filter((patientId): patientId is string => Boolean(patientId)),
      ),
    [currentUser?.id, encounters],
  )

  const isAdmin = hasRole(currentUser?.roles, 'admin') || hasRole(currentUser?.roles, 'superadmin')
  const isBilling = hasRole(currentUser?.roles, 'billing')
  const isProvider = hasRole(currentUser?.roles, 'provider')
  const isAuditor = hasRole(currentUser?.roles, 'auditor')
  const canViewPage = isAdmin || isBilling || isProvider || isAuditor || hasModuleAccess(currentUser?.permissions, 'documents')

  const visibleDocuments = useMemo(
    () =>
      documents.filter((document) => {
        if (isAdmin) return true
        if (isBilling) return isBillingDocument(document)
        if (isProvider) {
          const patientId = getEffectivePatientId(document, encounterById)
          return Boolean(patientId && assignedPatientIds.has(patientId))
        }
        if (isAuditor) return true
        return canViewPage
      }),
    [assignedPatientIds, canViewPage, documents, encounterById, isAdmin, isAuditor, isBilling, isProvider],
  )

  const filteredDocuments = useMemo(
    () =>
      visibleDocuments.filter((document) => {
        return (
          (!filters.patientId || getEffectivePatientId(document, encounterById) === filters.patientId) &&
          (!filters.encounterId || document.encounterId === filters.encounterId || document.entityId === filters.encounterId) &&
          (!filters.category || getDocumentCategory(document) === filters.category) &&
          (!filters.uploadSource || getUploadSource(document) === filters.uploadSource) &&
          (!filters.uploadedBy || document.uploadedBy === filters.uploadedBy) &&
          matchesUploadDate(document, filters.uploadDate)
        )
      }),
    [encounterById, filters, visibleDocuments],
  )

  const patientGroups = useMemo(
    () => buildPatientGroups(filteredDocuments, patientById, encounterById),
    [encounterById, filteredDocuments, patientById],
  )

  const filterOptions = useMemo(
    () => ({
      categories: makeOptions(visibleDocuments.map(getDocumentCategory)),
      sources: makeOptions(visibleDocuments.map(getUploadSource)),
      uploadedBy: makeOptions(visibleDocuments.map((document) => document.uploadedBy ?? '')),
    }),
    [visibleDocuments],
  )
  const hasActiveFilters = useMemo(
    () => Object.values(filters).some((value) => Boolean(value)),
    [filters],
  )

  const openLinkedRecord = (document: Document) => {
    const recordType = getLinkedRecordType(document)
    const recordId = getLinkedRecordId(document)
    const route = recordType ? moduleRouteMap[recordType] : undefined
    const queryParam = recordType ? linkedRecordQueryParamMap[recordType] ?? 'dashboardEntityId' : 'dashboardEntityId'

    if (route && recordId) {
      const nextSearchParams = new URLSearchParams()
      nextSearchParams.set(queryParam, String(recordId))
      nextSearchParams.set('returnTo', `${location.pathname}${location.search}`)
      nextSearchParams.set('returnLabel', 'Back to Documents')
      navigate(`${route}?${nextSearchParams.toString()}`)
    }
  }

  if (!canViewPage) {
    return (
      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-strong)]">Documents Library</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          You do not have permission to view the RCM document repository.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">RCM repository</p>
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">Documents Library</h1>
          <p className="mt-1 max-w-3xl text-sm text-[var(--color-text-muted)]">
            Patient-centric source of truth for uploaded PDF, JPG, PNG, and TIFF documents across revenue cycle workflows.
          </p>
        </div>
        <Button
          type="button"
          label="Refresh"
          icon={<RefreshCw className="h-4 w-4" aria-hidden="true" />}
          severity="secondary"
          outlined
          loading={documentsQuery.isFetching}
          onClick={() => void documentsQuery.refetch()}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {[
          ['Visible documents', visibleDocuments.length],
          ['Filtered documents', filteredDocuments.length],
          ['Patients', patientGroups.length],
          ['Read-only mode', isAuditor ? 'Yes' : 'No'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-[var(--color-text-strong)]">{value}</p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--color-text-strong)]">Filters</p>
          <Button
            type="button"
            label="Clear filters"
            icon={<X className="h-4 w-4" aria-hidden="true" />}
            severity="secondary"
            text
            disabled={!hasActiveFilters}
            onClick={() => setFilters(initialFilters)}
          />
        </div>
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            Patient
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              value={filters.patientId}
              onChange={(event) => setFilters((current) => ({ ...current, patientId: event.target.value }))}
            >
              <option value="">All patients</option>
              {patients.map((patient) => (
                <option key={patient._id} value={patient._id}>{getPatientLabel(patient)}</option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            Encounter
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              value={filters.encounterId}
              onChange={(event) => setFilters((current) => ({ ...current, encounterId: event.target.value }))}
            >
              <option value="">All encounters</option>
              {encounters.map((encounter) => (
                <option key={encounter._id} value={encounter._id}>{getEncounterLabel(encounter)}</option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            Category
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
            >
              <option value="">All categories</option>
              {filterOptions.categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            Upload Source
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              value={filters.uploadSource}
              onChange={(event) => setFilters((current) => ({ ...current, uploadSource: event.target.value }))}
            >
              <option value="">All sources</option>
              {filterOptions.sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            Uploaded By
            <select
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              value={filters.uploadedBy}
              onChange={(event) => setFilters((current) => ({ ...current, uploadedBy: event.target.value }))}
            >
              <option value="">All users</option>
              {filterOptions.uploadedBy.map((uploadedBy) => (
                <option key={uploadedBy} value={uploadedBy}>{uploadedBy}</option>
              ))}
            </select>
          </label>

          <label className="flex min-w-0 flex-col gap-1.5 text-sm font-semibold text-[var(--color-text-strong)]">
            Upload Date
            <input
              className="h-10 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-normal"
              type="date"
              value={filters.uploadDate}
              onChange={(event) => setFilters((current) => ({ ...current, uploadDate: event.target.value }))}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4">
        {documentsQuery.isLoading ? (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
            Loading document repository...
          </div>
        ) : patientGroups.length ? (
          patientGroups.map((patientGroup) => (
            <section key={patientGroup.patientId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
              <div className="border-b border-[var(--color-border)] px-4 py-3">
                <h2 className="text-lg font-semibold text-[var(--color-text-strong)]">{patientGroup.patientLabel}</h2>
              </div>

              <div className="divide-y divide-[var(--color-border)]">
                {patientGroup.encounters.map((encounterGroup) => (
                  <div key={encounterGroup.encounterId} className="p-4">
                    <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-strong)]">{encounterGroup.encounterLabel}</h3>
                    <div className="space-y-2">
                      {encounterGroup.documents.map((document) => {
                        const linkedRecordType = getLinkedRecordType(document)
                        const linkedId = getLinkedRecordId(document)

                        return (
                          <div
                            key={document._id}
                            className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)]/45 p-3 lg:grid-cols-[minmax(0,1fr)_auto]"
                          >
                            <div className="flex min-w-0 gap-3">
                              <FileText className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-primary)]" aria-hidden="true" />
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-[var(--color-text-strong)]">{fileName(document)}</p>
                                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                  {getDocumentCategory(document)} / {getUploadSource(document)} / {document.fileType || document.mimeType || 'Unknown type'} / {formatBytes(document.fileSize)}
                                </p>
                                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                                  Uploaded by {document.uploadedBy || 'Unknown'} on {formatDate(document.uploadedAt)}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                label="View"
                                icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
                                size="small"
                                severity="secondary"
                                outlined
                                disabled={!document.fileUrl}
                                onClick={() => document.fileUrl && window.open(resolveApiAssetUrl(document.fileUrl), '_blank', 'noreferrer')}
                              />
                              <Button
                                type="button"
                                label="Download"
                                icon={<Download className="h-4 w-4" aria-hidden="true" />}
                                size="small"
                                severity="secondary"
                                outlined
                                disabled={!document.fileUrl}
                                onClick={() => downloadDocument(document)}
                              />
                              <Button
                                type="button"
                                label="Linked Record"
                                icon={<Link2 className="h-4 w-4" aria-hidden="true" />}
                                size="small"
                                severity="secondary"
                                outlined
                                disabled={!linkedRecordType || !moduleRouteMap[linkedRecordType] || !linkedId}
                                onClick={() => openLinkedRecord(document)}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6 text-sm text-[var(--color-text-muted)]">
            No documents match the current repository view.
          </div>
        )}
      </div>
    </div>
  )
}
