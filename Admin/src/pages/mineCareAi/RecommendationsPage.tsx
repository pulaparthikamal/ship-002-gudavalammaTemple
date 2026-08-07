import { useMemo, useState } from 'react'
import { BrainCircuit, CheckCircle, DollarSign, Eye, ShieldCheck } from 'lucide-react'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { useGetMineCareEquipmentQuery, useGetMineCareRecommendationsQuery, useUpdateMineCareRecommendationStatusMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareRecommendation } from '@/types/mineCareAi'
import { ConfidenceBadge, DetailGrid, ErrorBanner, MineCarePage, MineCareTable, StatusBadge, SummaryCard, SurfacePanel, errorMessage, equipmentOptions, formatCurrency } from './shared'

const allOption = { label: 'All', value: '' }
const priorityOptions = [allOption, ...['Critical', 'High', 'Medium', 'Low'].map((value) => ({ label: value, value }))]
const sourceOptions = [allOption, ...['Service', 'Warranty', 'Risk', 'Spare', 'Root Cause', 'Checklist', 'Budget', 'AI', 'Vendor', 'Procurement'].map((value) => ({ label: value, value }))]
const statusOptions = ['Open', 'In Progress', 'Completed', 'Dismissed'].map((value) => ({ label: value, value }))
const filterStatusOptions = [allOption, ...statusOptions]

export function MineCareRecommendationsPage() {
  const { data = [], isLoading, isError, error } = useGetMineCareRecommendationsQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [updateStatus, { isLoading: isUpdating }] = useUpdateMineCareRecommendationStatusMutation()
  const [filters, setFilters] = useState({ priority: '', source: '', status: '', equipmentId: '' })
  const [selected, setSelected] = useState<MineCareRecommendation | null>(null)
  const [actionError, setActionError] = useState('')

  const filtered = useMemo(() => data.filter((item) =>
    (!filters.priority || item.priority === filters.priority) &&
    (!filters.source || item.source === filters.source) &&
    (!filters.status || item.status === filters.status) &&
    (!filters.equipmentId || item.equipmentId === filters.equipmentId)
  ), [data, filters])

  const openItems = data.filter((item) => item.status === 'Open' || item.status === 'In Progress')
  const criticalItems = openItems.filter((item) => item.priority === 'Critical')
  const estimatedSavings = openItems.reduce((sum, item) => sum + (item.estimatedSavings ?? 0), 0)
  const warrantyRecovery = openItems.filter((item) => item.source === 'Warranty').reduce((sum, item) => sum + (item.estimatedSavings ?? 0), 0)

  const changeStatus = async (item: MineCareRecommendation, status: MineCareRecommendation['status']) => {
    setActionError('')
    try {
      await updateStatus({ id: item.recommendationId, status }).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to update recommendation status.'))
    }
  }

  return (
    <MineCarePage title="AI Recommendations" description="The MineCare AI brain for prioritized maintenance, warranty, spare, vendor, and cost-saving decisions.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load AI recommendations.') : actionError} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Critical Recommendations" value={criticalItems.length} icon={BrainCircuit} />
        <SummaryCard label="Open Recommendations" value={openItems.length} icon={CheckCircle} />
        <SummaryCard label="Estimated Savings" value={formatCurrency(estimatedSavings)} icon={DollarSign} />
        <SummaryCard label="Warranty Recovery" value={formatCurrency(warrantyRecovery)} icon={ShieldCheck} />
      </div>

      <SurfacePanel title="Recommendation filters" description="Focus by priority, source, status, or equipment.">
        <div className="grid gap-4 md:grid-cols-4">
          <Dropdown value={filters.priority} options={priorityOptions} onChange={(event) => setFilters((current) => ({ ...current, priority: event.value }))} placeholder="Priority" className="w-full" />
          <Dropdown value={filters.source} options={sourceOptions} onChange={(event) => setFilters((current) => ({ ...current, source: event.value }))} placeholder="Source" className="w-full" />
          <Dropdown value={filters.status} options={filterStatusOptions} onChange={(event) => setFilters((current) => ({ ...current, status: event.value }))} placeholder="Status" className="w-full" />
          <Dropdown value={filters.equipmentId} options={[allOption, ...equipmentOptions(equipment)]} onChange={(event) => setFilters((current) => ({ ...current, equipmentId: event.value }))} placeholder="Equipment" className="w-full" filter />
        </div>
      </SurfacePanel>

      <SurfacePanel title="Recommendation center" description="Open each recommendation to see why MineCare AI generated it.">
        <MineCareTable<MineCareRecommendation>
          data={filtered}
          isLoading={isLoading}
          getRowId={(item) => item.recommendationId}
          emptyMessage="No AI recommendations match the current filters."
          actions={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: setSelected }]}
          columns={[
            { header: 'Recommendation', field: 'title' },
            { header: 'Priority', field: 'priority', render: (item) => <StatusBadge value={item.priority} /> },
            { header: 'Source', field: 'source', render: (item) => <StatusBadge value={item.source} /> },
            { header: 'Equipment', key: 'equipment', render: (item) => item.equipmentName || item.equipmentId || 'Fleet-level' },
            { header: 'Savings', field: 'estimatedSavings', render: (item) => formatCurrency(item.estimatedSavings) },
            { header: 'AI', key: 'ai', render: (item) => <ConfidenceBadge value={item.confidence} source="agentic" /> },
            {
              header: 'Status',
              key: 'status',
              render: (item) => <Dropdown value={item.status} options={statusOptions} onChange={(event) => changeStatus(item, event.value)} disabled={isUpdating} className="w-44" />,
            },
          ]}
        />
      </SurfacePanel>

      <Dialog header="Recommendation details" visible={Boolean(selected)} style={{ width: 'min(760px, 95vw)' }} modal className="crud-view-dialog" maskClassName="crud-form-dialog-mask" contentClassName="overflow-x-auto" onHide={() => setSelected(null)}>
        {selected ? (
          <div className="space-y-5">
            <DetailGrid values={{ Recommendation: selected.recommendationId, Priority: <StatusBadge value={selected.priority} />, Source: <StatusBadge value={selected.source} />, Status: <StatusBadge value={selected.status} />, Equipment: selected.equipmentName || selected.equipmentId || 'Fleet-level', Savings: formatCurrency(selected.estimatedSavings), AI: <ConfidenceBadge value={selected.confidence} source="agentic" /> }} />
            <section><h3 className="font-semibold">Title</h3><p className="mt-2 text-sm text-[var(--color-text)]">{selected.title}</p></section>
            <section><h3 className="font-semibold">Why AI recommended this</h3><p className="mt-2 text-sm text-[var(--color-text)]">{selected.reason}</p></section>
            <section><h3 className="font-semibold">Recommended action</h3><p className="mt-2 text-sm font-medium text-[var(--color-text-strong)]">{selected.recommendedAction}</p></section>
            <section><h3 className="font-semibold">Estimated impact</h3><p className="mt-2 text-sm text-[var(--color-text)]">{selected.estimatedImpact}</p></section>
          </div>
        ) : null}
      </Dialog>
    </MineCarePage>
  )
}
