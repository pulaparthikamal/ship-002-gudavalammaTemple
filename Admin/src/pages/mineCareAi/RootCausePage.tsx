import { useState } from 'react'
import { BrainCircuit, Eye } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { useAnalyzeMineCareRootCauseMutation, useGetMineCareEquipmentQuery, useGetMineCareRootCausesQuery } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareRootCauseAnalysis } from '@/types/mineCareAi'
import { ConfidenceBadge, DetailGrid, ErrorBanner, errorMessage, equipmentOptions, formatConfidence, MineCarePage, MineCareTable, ScrollRegion, StatusBadge, SurfacePanel } from './shared'

export function MineCareRootCausePage() {
  const { data = [], isLoading, isError, error } = useGetMineCareRootCausesQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [analyze, { isLoading: isAnalyzing }] = useAnalyzeMineCareRootCauseMutation()
  const [form, setForm] = useState({ equipmentId: '', failureType: '', component: '', problem: '' })
  const [actionError, setActionError] = useState('')
  const [selected, setSelected] = useState<MineCareRootCauseAnalysis | null>(null)

  const runAnalyze = async () => {
    setActionError('')
    if (!form.equipmentId) {
      setActionError('Select equipment before generating root cause analysis.')
      return
    }
    if (!form.failureType.trim()) {
      setActionError('Failure type is required before generating root cause analysis.')
      return
    }
    try {
      await analyze(form).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to generate root cause analysis right now.'))
    }
  }

  return (
    <MineCarePage title="Root Cause Analysis" description="Analyze failure symptoms against history, observations, and maintenance context.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load root cause analyses.') : actionError} />
      <SurfacePanel
        title="New analysis"
        description="Generate an AI-assisted root cause draft and persist it for review."
        actions={<Button label="Analyze" icon={<BrainCircuit className="h-4 w-4" />} loading={isAnalyzing} onClick={runAnalyze} />}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1 text-sm font-medium">Equipment<Dropdown value={form.equipmentId} options={equipmentOptions(equipment)} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.value }))} className="w-full" filter /></label>
          <label className="space-y-1 text-sm font-medium">Failure Type<InputText value={form.failureType} onChange={(event) => setForm((current) => ({ ...current, failureType: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Component<InputText value={form.component} onChange={(event) => setForm((current) => ({ ...current, component: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-4">Problem<InputTextarea rows={3} value={form.problem} onChange={(event) => setForm((current) => ({ ...current, problem: event.target.value }))} className="w-full" /></label>
        </div>
      </SurfacePanel>

      <SurfacePanel title="Analysis history" description="Saved root cause drafts and reviewed findings.">
        <MineCareTable<MineCareRootCauseAnalysis>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.analysisId}
          emptyMessage="No root cause analyses found."
          actions={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: setSelected }]}
          columns={[
            { header: 'Analysis', field: 'analysisId' },
            { header: 'Equipment', field: 'equipmentId' },
            { header: 'Failure', field: 'failureType' },
            { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
            { header: 'AI', key: 'ai', render: (item) => <ConfidenceBadge value={item.confidence} source={item.aiProvider} /> },
            { header: 'Root Causes', key: 'causes', render: (item) => item.likelyRootCauses.slice(0, 2).join(', ') },
          ]}
        />
      </SurfacePanel>

      <SurfacePanel title="Root cause history timeline" description="Repeated failure story across saved RCA analyses.">
        {data.length ? (
          <ScrollRegion>
            <div className="space-y-3">
              {data.map((item) => (
                <div key={`timeline-${item.analysisId}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-[var(--color-text-strong)]">{item.equipmentName} · {item.failureType}</p>
                      <p className="text-sm text-[var(--color-text-muted)]">{item.created ? new Date(item.created).toLocaleDateString() : '-'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge value={item.status} />
                      <ConfidenceBadge value={item.confidence} source={item.aiProvider} />
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-[var(--color-text)]">{item.likelyRootCauses[0] || item.problem}</p>
                  <p className="mt-2 text-sm font-medium text-[var(--color-text-strong)]">{item.recommendedActions[0] || 'Review root cause evidence.'}</p>
                </div>
              ))}
            </div>
          </ScrollRegion>
        ) : <p className="text-sm text-[var(--color-text-muted)]">No RCA timeline records found.</p>}
      </SurfacePanel>

      <Dialog header="Root cause details" visible={Boolean(selected)} style={{ width: 'min(760px, 95vw)' }} modal className="crud-view-dialog" maskClassName="crud-form-dialog-mask" contentClassName="overflow-x-auto" onHide={() => setSelected(null)}>
        {selected ? (
          <div className="space-y-5">
            <DetailGrid values={{ Analysis: selected.analysisId, Equipment: `${selected.equipmentName} (${selected.equipmentId})`, Failure: selected.failureType, Component: selected.component || '-', Status: <StatusBadge value={selected.status} />, AI: <ConfidenceBadge value={selected.confidence} source={selected.aiProvider} /> }} />
            <section><h3 className="font-semibold">Problem</h3><p className="mt-2 text-sm text-[var(--color-text)]">{selected.problem}</p></section>
            {selected.evidenceSummary ? <section><h3 className="font-semibold">AI evidence summary</h3><p className="mt-2 text-sm text-[var(--color-text)]">{selected.evidenceSummary}</p></section> : null}
            <section><h3 className="font-semibold">Evidence</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.evidence.map((item) => <li key={item}>{item}</li>)}</ul></section>
            <section><h3 className="font-semibold">Likely root causes</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.likelyRootCauses.map((item) => <li key={item}>{item}</li>)}</ul></section>
            {selected.causeConfidence?.length ? (
              <section><h3 className="font-semibold">Cause confidence</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.causeConfidence.map((item) => <li key={item.cause}>{item.cause}: {formatConfidence(item.confidence)}</li>)}</ul></section>
            ) : null}
            <section><h3 className="font-semibold">Recommended actions</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ul></section>
            {selected.preventiveControls?.length ? (
              <section><h3 className="font-semibold">Preventive controls</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.preventiveControls.map((item) => <li key={item}>{item}</li>)}</ul></section>
            ) : null}
          </div>
        ) : null}
      </Dialog>
    </MineCarePage>
  )
}
