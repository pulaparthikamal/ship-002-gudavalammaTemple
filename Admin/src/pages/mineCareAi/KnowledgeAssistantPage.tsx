import { useState } from 'react'
import { Upload } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { useAskMineCareKnowledgeAssistantMutation, useGetMineCareEquipmentQuery, useGetMineCareKnowledgeDocumentsQuery, useUploadMineCareKnowledgeDocumentMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareKnowledgeDocument } from '@/types/mineCareAi'
import { ConfidenceBadge, EmptyState, ErrorBanner, errorMessage, equipmentOptions, formatConfidence, MineCarePage, MineCareTable, ScrollRegion, selectedEquipmentType, StatusBadge, SurfacePanel } from './shared'

const documentTypes = ['Manual', 'SOP', 'Warranty', 'OEM Schedule', 'Invoice', 'Purchase Order', 'Service Document', 'Other'].map((value) => ({ label: value, value }))

export function MineCareKnowledgeAssistantPage() {
  const { data = [], isLoading, isError, error } = useGetMineCareKnowledgeDocumentsQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [upload, { isLoading: isUploading }] = useUploadMineCareKnowledgeDocumentMutation()
  const [ask, { data: answer, isLoading: isAsking }] = useAskMineCareKnowledgeAssistantMutation()
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState('Manual')
  const [equipmentId, setEquipmentId] = useState('')
  const [question, setQuestion] = useState('')
  const [actionError, setActionError] = useState('')
  const readyDocuments = data.filter((item) => item.status === 'Ready')

  const submitUpload = async () => {
    setActionError('')
    if (!file) return
    const formData = new FormData()
    formData.append('documents', file)
    formData.append('documentType', documentType)
    formData.append('uploadSource', 'knowledge-assistant')
    if (equipmentId) {
      formData.append('equipmentId', equipmentId)
      formData.append('equipmentType', selectedEquipmentType(equipment, equipmentId))
    }
    try {
      const uploaded = await upload(formData).unwrap()
      if (uploaded.some((item) => item.status === 'Failed')) {
        setActionError('Document was uploaded but could not be processed. Please upload a clearer PDF or image.')
      }
    } catch (err) {
      setActionError(errorMessage(err, 'Document OCR failed. Please upload a clearer PDF or image.'))
    }
  }

  const askQuestion = async () => {
    setActionError('')
    if (!readyDocuments.length) {
      setActionError('Upload and process a document before asking questions.')
      return
    }
    if (!question.trim()) {
      setActionError('Enter a question before asking the knowledge assistant.')
      return
    }
    try {
      await ask({ question }).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to answer from knowledge documents right now.'))
    }
  }

  return (
    <MineCarePage title="Knowledge Assistant" description="Upload manuals or SOPs and ask maintenance questions against the indexed content.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load knowledge documents.') : actionError} />
      <SurfacePanel title="Document ingestion" description="Documents are uploaded to Node, processed through AgenticServer OCR when needed, and indexed in Mongo.">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_240px_auto] md:items-end">
          <label className="space-y-1 text-sm font-medium">Document<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} className="block w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">Type<Dropdown value={documentType} options={documentTypes} onChange={(event) => setDocumentType(event.value)} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Equipment<Dropdown value={equipmentId} options={[{ label: 'General document', value: '' }, ...equipmentOptions(equipment)]} onChange={(event) => setEquipmentId(event.value)} className="w-full" filter /></label>
          <Button label="Upload" icon={<Upload className="h-4 w-4" />} loading={isUploading} disabled={!file} onClick={submitUpload} />
        </div>
      </SurfacePanel>

      <SurfacePanel title="Ask assistant" description="Answers include citations from Ready MineCare documents.">
        <div className="space-y-4">
          <InputText value={question} onChange={(event) => setQuestion(event.target.value)} className="w-full" />
          <Button label="Ask" loading={isAsking} disabled={!readyDocuments.length} onClick={askQuestion} />
          {answer ? (
            <ScrollRegion>
              <div className="space-y-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Answer generated from uploaded documents</p>
                  <ConfidenceBadge value={answer.confidence} source={answer.aiProvider} />
                </div>
                <p className="text-sm text-[var(--color-text)]">{answer.answer}</p>
                {answer.recommendedActions?.length ? (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Recommended actions</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
                    {answer.recommendedActions.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
                ) : null}
                <div>
                  <p className="text-xs font-semibold uppercase tracking-normal text-[var(--color-text-muted)]">Citations</p>
                  {(answer.sources?.length ? answer.sources : answer.citations).length ? (
                    <div className="mt-2 grid gap-3 lg:grid-cols-2">
                      {(answer.sources?.length ? answer.sources : answer.citations).map((item, index) => (
                        <div key={`${item.documentName}-${item.section}-${index}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="font-semibold text-[var(--color-text-strong)]">{item.documentName || item.documentId}</p>
                            <span className="text-xs text-[var(--color-text-muted)]">{item.pageNumber ? `Page ${item.pageNumber}` : item.section || `Chunk ${item.chunkIndex ?? index + 1}`}</span>
                          </div>
                          <p className="mt-2 text-sm text-[var(--color-text)]">{item.snippet || 'Source snippet unavailable.'}</p>
                          {item.confidence ? <p className="mt-2 text-xs text-[var(--color-text-muted)]">Citation confidence {formatConfidence(item.confidence)}</p> : null}
                        </div>
                      ))}
                    </div>
                  ) : <p className="mt-2 text-sm text-[var(--color-text-muted)]">No reliable source found in uploaded documents.</p>}
                </div>
              </div>
            </ScrollRegion>
          ) : <EmptyState message={readyDocuments.length ? 'Ask a question against processed documents.' : 'Upload and process a document before asking questions.'} />}
        </div>
      </SurfacePanel>

      <SurfacePanel title="Knowledge documents" description="Indexed document metadata.">
        <MineCareTable<MineCareKnowledgeDocument>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.documentId}
          emptyMessage="No knowledge documents found."
          columns={[
            { header: 'Document', field: 'documentId' },
            { header: 'File', field: 'originalName' },
            { header: 'Type', field: 'documentType' },
            { header: 'Equipment', field: 'equipmentId' },
            { header: 'Source', field: 'uploadSource', render: (item) => item.uploadSource || '-' },
            { header: 'Chunks', field: 'chunkCount' },
            { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
            {
              header: 'File Link',
              key: 'fileUrl',
              render: (item) => item.fileUrl ? (
                <a className="font-medium text-[var(--color-primary)] hover:underline" href={resolveApiAssetUrl(item.fileUrl)} target="_blank" rel="noreferrer">Open</a>
              ) : '-',
            },
            { header: 'Message', key: 'message', render: (item) => item.status === 'Failed' ? (item.errorMessage || 'Document was uploaded but could not be processed.') : '-' },
          ]}
        />
      </SurfacePanel>
    </MineCarePage>
  )
}
