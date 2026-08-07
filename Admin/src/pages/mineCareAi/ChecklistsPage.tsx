import { useMemo, useState } from 'react'
import { Activity, CheckCircle, ClipboardCheck, Eye } from 'lucide-react'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { useGenerateMineCareChecklistMutation, useGetMineCareChecklistsQuery, useGetMineCareEquipmentQuery, useUpdateMineCareChecklistItemMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareChecklist } from '@/types/mineCareAi'
import { ConfidenceBadge, DetailGrid, ErrorBanner, errorMessage, equipmentOptions, formatConfidence, MineCarePage, MineCareTable, ScrollRegion, StatusBadge, SummaryCard, SurfacePanel } from './shared'

export function MineCareChecklistsPage() {
  const { data = [], isLoading, isError, error } = useGetMineCareChecklistsQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [generate, { isLoading: isGenerating }] = useGenerateMineCareChecklistMutation()
  const [toggleItem] = useUpdateMineCareChecklistItemMutation()
  const [form, setForm] = useState({ equipmentId: '', serviceType: '', requiredParts: '' })
  const [actionError, setActionError] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const selected = useMemo(() => data.find((item) => item.checklistId === selectedId) ?? data[0], [data, selectedId])
  const [detail, setDetail] = useState<MineCareChecklist | null>(null)
  const activeChecklists = data.filter((item) => (item.checklistStatus ?? item.status) === 'Active')
  const completedChecklists = data.filter((item) => (item.checklistStatus ?? item.status) === 'Completed')
  const averageCompletion = data.length ? Math.round(data.reduce((sum, item) => sum + (item.progressPercent ?? 0), 0) / data.length) : 0

  const runGenerate = async () => {
    setActionError('')
    if (!form.equipmentId) {
      setActionError('Select equipment before generating a checklist.')
      return
    }
    try {
      await generate({ equipmentId: form.equipmentId, serviceType: form.serviceType, requiredParts: form.requiredParts.split(',').map((item) => item.trim()).filter(Boolean) }).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to generate checklist right now.'))
    }
  }

  return (
    <MineCarePage title="Maintenance Checklists" description="Generate and track guided service checklists for mine assets.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load checklists.') : actionError} />
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active Checklists" value={activeChecklists.length} icon={ClipboardCheck} />
        <SummaryCard label="Completed Checklists" value={completedChecklists.length} icon={CheckCircle} />
        <SummaryCard label="Average Completion" value={`${averageCompletion}%`} icon={Activity} />
      </div>

      <SurfacePanel
        title="Generate checklist"
        description="Create a safety-aware checklist from equipment context and service requirements."
        actions={<Button label="Generate" icon={<ClipboardCheck className="h-4 w-4" />} loading={isGenerating} onClick={runGenerate} />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">Equipment<Dropdown value={form.equipmentId} options={equipmentOptions(equipment)} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.value }))} className="w-full" filter /></label>
          <label className="space-y-1 text-sm font-medium">Service Type<InputText value={form.serviceType} onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Required Parts<InputText value={form.requiredParts} onChange={(event) => setForm((current) => ({ ...current, requiredParts: event.target.value }))} className="w-full" /></label>
        </div>
      </SurfacePanel>

      <SurfacePanel title="Checklist library" description="Generated checklist records.">
        <MineCareTable<MineCareChecklist>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.checklistId}
          emptyMessage="No checklists found."
          actions={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: (item) => { setSelectedId(item.checklistId); setDetail(item) } }]}
          columns={[
            { header: 'Checklist', field: 'checklistId' },
            { header: 'Title', field: 'checklistTitle' },
            { header: 'Equipment', field: 'equipmentId' },
            { header: 'Service', field: 'serviceType' },
            { header: 'Progress', key: 'progress', render: (item) => `${item.completedItems ?? item.items.filter((task) => task.completed).length}/${item.totalItems ?? item.items.length} (${item.progressPercent ?? 0}%)` },
            { header: 'AI', key: 'ai', render: (item) => <ConfidenceBadge value={item.confidence} source="agentic" /> },
            { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.checklistStatus ?? item.status} /> },
          ]}
        />
      </SurfacePanel>

      {selected ? (
        <SurfacePanel title="Checklist steps" description={selected.checklistTitle}>
          <ScrollRegion>
            <div className="space-y-3">
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-[var(--color-text-strong)]">Progress</span>
                <span className="text-[var(--color-text-muted)]">{selected.completedItems ?? selected.items.filter((item) => item.completed).length}/{selected.totalItems ?? selected.items.length} completed</span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[var(--color-surface)]">
                <div className="h-2 rounded-full bg-[var(--color-primary)]" style={{ width: `${selected.progressPercent ?? 0}%` }} />
              </div>
            </div>
            {selected.items.map((item) => (
              <div key={item.itemId} className="flex items-start gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                <Checkbox checked={item.completed} onChange={(event) => toggleItem({ id: selected.checklistId, itemId: item.itemId, completed: Boolean(event.checked) })} />
                <div className="min-w-0">
                  <p className="font-medium text-[var(--color-text-strong)]">{item.step}. {item.task}</p>
                  <p className="text-sm text-[var(--color-text-muted)]">{item.safetyNote || 'Standard site safety applies.'}</p>
                </div>
              </div>
            ))}
            </div>
          </ScrollRegion>
        </SurfacePanel>
      ) : null}

      <Dialog header="Checklist details" visible={Boolean(detail)} style={{ width: 'min(760px, 95vw)' }} modal className="crud-view-dialog" maskClassName="crud-form-dialog-mask" contentClassName="overflow-x-auto" onHide={() => setDetail(null)}>
        {detail ? (
          <div className="space-y-5">
            <DetailGrid values={{ Checklist: detail.checklistId, Equipment: `${detail.equipmentName} (${detail.equipmentId})`, Service: detail.serviceType, Status: <StatusBadge value={detail.checklistStatus ?? detail.status} />, Progress: `${detail.completedItems ?? 0}/${detail.totalItems ?? detail.items.length} (${detail.progressPercent ?? 0}%)`, Confidence: formatConfidence(detail.confidence) }} />
            <DetailGrid values={{ 'Skill Requirement': detail.skillRequirement ?? '-', 'Quality Gate': detail.qualityGate ?? '-' }} />
            <section><h3 className="font-semibold">Safety precautions</h3><p className="mt-2 text-sm">{detail.safetyPrecautions.join(', ') || '-'}</p></section>
            <section><h3 className="font-semibold">Required tools</h3><p className="mt-2 text-sm">{detail.requiredTools.join(', ') || '-'}</p></section>
            {detail.aiPreparationNotes?.length ? <section><h3 className="font-semibold">AI preparation notes</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{detail.aiPreparationNotes.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          </div>
        ) : null}
      </Dialog>
    </MineCarePage>
  )
}
