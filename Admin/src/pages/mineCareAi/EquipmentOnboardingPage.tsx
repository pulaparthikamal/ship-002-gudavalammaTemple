import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, Sparkles, Trash2, UploadCloud } from 'lucide-react'
import { Button } from 'primereact/button'
import {
  useCreateMineCareEquipmentMutation,
  useExtractMineCareEquipmentDocumentsMutation,
  useUploadMineCareKnowledgeDocumentMutation,
} from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareDocumentExtractionResponse, MineCareEquipmentPayload } from '@/types/mineCareAi'
import { DetailGrid, EquipmentForm, formatConfidence, normalizePercentRatio, MineCarePage, ScrollRegion, StatusBadge, SurfacePanel } from './shared'

function extractionToForm(extraction: MineCareDocumentExtractionResponse): Partial<MineCareEquipmentPayload> {
  return {
    equipmentId: extraction.equipment.equipmentId ?? '',
    name: extraction.equipment.name ?? '',
    type: extraction.equipment.type ?? '',
    brand: extraction.equipment.brand ?? '',
    model: extraction.equipment.model ?? '',
    serialNumber: extraction.equipment.serialNumber ?? '',
    location: extraction.equipment.location ?? '',
    department: extraction.equipment.department ?? 'Operations',
    purchaseDate: extraction.equipment.purchaseDate ?? '',
    invoiceValue: extraction.equipment.invoiceValue ?? 0,
    vendor: extraction.equipment.vendor ?? '',
    currentRunningHours: extraction.equipment.currentRunningHours ?? 0,
    averageDailyUsage: extraction.equipment.averageDailyUsage ?? 8,
    status: extraction.equipment.status ?? 'Operational',
    criticality: extraction.equipment.criticality ?? 'Medium',
    warranty: {
      startDate: extraction.warranty.startDate ?? '',
      endDate: extraction.warranty.endDate ?? '',
      hourLimit: extraction.warranty.hourLimit ?? 0,
      coveredComponents: extraction.warranty.coveredComponents ?? [],
      terms: extraction.warranty.terms ?? '',
    },
    serviceSchedules: extraction.serviceSchedules,
  }
}

function extractionErrorMessage(error: unknown) {
  const apiError = error as { data?: { respMessage?: string; message?: string; detail?: string }; message?: string }
  return apiError?.data?.respMessage || apiError?.data?.message || apiError?.data?.detail || apiError?.message || 'Document extraction failed.'
}

export function MineCareEquipmentOnboardingPage() {
  const navigate = useNavigate()
  const [createEquipment] = useCreateMineCareEquipmentMutation()
  const [extractDocuments, { isLoading: isExtracting }] = useExtractMineCareEquipmentDocumentsMutation()
  const [uploadKnowledgeDocuments] = useUploadMineCareKnowledgeDocumentMutation()
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [extraction, setExtraction] = useState<MineCareDocumentExtractionResponse | null>(null)
  const [formSeed, setFormSeed] = useState<Partial<MineCareEquipmentPayload> | undefined>()
  const [formVersion, setFormVersion] = useState(0)
  const [extractError, setExtractError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const totalFileSize = useMemo(
    () => selectedFiles.reduce((sum, file) => sum + file.size, 0),
    [selectedFiles],
  )

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return
    setExtractError('')
    setSelectedFiles((current) => {
      const nextFiles = [...current]
      Array.from(files).forEach((file) => {
        const duplicate = nextFiles.some((item) => item.name === file.name && item.size === file.size)
        if (!duplicate) nextFiles.push(file)
      })
      return nextFiles.slice(0, 10)
    })
  }

  const extractWithAi = async () => {
    if (!selectedFiles.length) {
      setExtractError('Upload at least one invoice, warranty card, manual, or service document.')
      return
    }

    const formData = new FormData()
    selectedFiles.forEach((file) => formData.append('documents[]', file))

    try {
      setExtractError('')
      const result = await extractDocuments(formData).unwrap()
      setExtraction(result)
      setFormSeed(extractionToForm(result))
      setFormVersion((current) => current + 1)
    } catch (error) {
      setExtractError(extractionErrorMessage(error))
    }
  }

  return (
    <MineCarePage
        title="Equipment Onboarding"
        description="Capture equipment identity, warranty, running hours, and service planning details in one flow."
        actions={
          <Button
            type="button"
            label="Back"
            icon={<ArrowLeft className="h-4 w-4" />}
            outlined
            onClick={() => navigate('/minecare-ai/equipment')}
          />
        }
    >
      <SurfacePanel
        title="AI Document Extraction"
        description="Upload purchase, invoice, warranty, or service documents to prefill the onboarding form."
        actions={(
          <Button
            label="Extract with AI"
            icon={<Sparkles className="h-4 w-4" />}
            loading={isExtracting}
            disabled={!selectedFiles.length}
            onClick={extractWithAi}
          />
        )}
      >
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
          <div
            className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border)] bg-[var(--color-surface-muted)] p-6 text-center"
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') fileInputRef.current?.click()
            }}
            role="button"
            tabIndex={0}
          >
            <UploadCloud className="h-10 w-10 text-[var(--color-primary)]" aria-hidden="true" />
            <p className="mt-3 text-sm font-semibold text-[var(--color-text-strong)]">Upload equipment documents</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">PDF, image, or text files. Up to 10 documents.</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,.webp,.tif,.tiff,.txt,.csv"
              className="hidden"
              onChange={(event) => onFilesSelected(event.target.files)}
            />
          </div>

          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text-strong)]">Selected documents</p>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {(totalFileSize / 1024 / 1024).toFixed(2)} MB total
                </p>
              </div>
              {selectedFiles.length ? (
                <Button label="Clear" severity="secondary" text onClick={() => setSelectedFiles([])} />
              ) : null}
            </div>
            <ScrollRegion className="mt-3 max-h-[18rem]">
              <div className="space-y-2">
                {selectedFiles.length ? selectedFiles.map((file) => (
                  <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-md border border-[var(--color-border)] px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--color-text-strong)]">{file.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                    <Button
                      icon={<Trash2 className="h-4 w-4" />}
                      severity="secondary"
                      text
                      aria-label={`Remove ${file.name}`}
                      onClick={() => setSelectedFiles((current) => current.filter((item) => item !== file))}
                    />
                  </div>
                )) : (
                  <p className="rounded-md border border-dashed border-[var(--color-border)] p-3 text-sm text-[var(--color-text-muted)]">
                    No documents selected.
                  </p>
                )}
              </div>
            </ScrollRegion>
            {isExtracting ? <p className="mt-3 text-sm text-[var(--color-text-muted)]">Extracting document text and asking MineCare AI to map equipment fields...</p> : null}
            {extractError ? <p className="mt-3 text-sm font-medium text-red-600">{extractError}</p> : null}
          </div>
        </div>

        {extraction ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Confidence</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-strong)]">{formatConfidence(extraction.confidence)}</p>
              <div className="mt-3">
                <StatusBadge value={normalizePercentRatio(extraction.confidence) >= 0.75 ? 'AI Extracted' : 'Needs Review'} />
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 lg:col-span-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">AI Onboarding Summary</p>
                <StatusBadge value="Review before creating asset" />
              </div>
              <p className="mt-2 text-sm text-[var(--color-text)]">{extraction.onboardingSummary || extraction.aiExtractionSummary || 'AI extraction completed. Review the form fields before saving.'}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {extraction.sourceDocuments.map((document) => <StatusBadge key={document} value={document} />)}
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 lg:col-span-3">
              <DetailGrid
                values={{
                  'Extracted Fields': extraction.extractedFieldsCount ?? '-',
                  'Suggested Criticality': <StatusBadge value={extraction.suggestedCriticality ?? extraction.equipment.criticality ?? 'Medium'} />,
                  'Recommended First Service': extraction.recommendedFirstService || '-',
                  'Warranty Insight': extraction.warrantyInsight || '-',
                }}
              />
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Suggested spare kit</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {extraction.suggestedSpareKit?.length ? extraction.suggestedSpareKit.map((part) => <StatusBadge key={part} value={part} />) : <StatusBadge value="Confirm after manual review" />}
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 lg:col-span-3">
              <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Missing or low-confidence fields</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {extraction.missingFields.length
                  ? extraction.missingFields.map((field) => <StatusBadge key={field} value={field} />)
                  : <StatusBadge value="No missing fields reported" />}
              </div>
            </div>
          </div>
        ) : null}
      </SurfacePanel>

      <SurfacePanel title="New Equipment">
        <EquipmentForm
          key={formVersion}
          initial={formSeed}
          submitLabel="Create Equipment"
          onCancel={() => navigate('/minecare-ai/equipment')}
          onSubmit={async (payload) => {
            const result = await createEquipment(payload).unwrap()
            if (selectedFiles.length) {
              const formData = new FormData()
              selectedFiles.forEach((file) => formData.append('documents[]', file))
              formData.append('documentType', 'Other')
              formData.append('uploadSource', 'onboarding')
              formData.append('equipmentId', result.equipment.equipmentId)
              formData.append('equipmentType', result.equipment.type)
              try {
                await uploadKnowledgeDocuments(formData).unwrap()
              } catch (error) {
                setExtractError(extractionErrorMessage(error))
              }
            }
            navigate(`/minecare-ai/equipment/${result.equipment.equipmentId}`)
          }}
        />
      </SurfacePanel>
    </MineCarePage>
  )
}
