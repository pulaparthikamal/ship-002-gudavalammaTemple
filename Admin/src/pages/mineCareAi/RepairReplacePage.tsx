import { useState } from 'react'
import { Eye, RefreshCw } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { useAnalyzeMineCareRepairReplaceMutation, useGetMineCareEquipmentQuery, useGetMineCareRepairReplaceAnalysesQuery } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareRepairReplaceAnalysis } from '@/types/mineCareAi'
import { ConfidenceBadge, DetailGrid, ErrorBanner, errorMessage, equipmentOptions, formatConfidence, formatCurrency, MineCarePage, MineCareTable, StatusBadge, SurfacePanel } from './shared'

export function MineCareRepairReplacePage() {
  const { data = [], isLoading, isError, error } = useGetMineCareRepairReplaceAnalysesQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [analyze, { isLoading: isAnalyzing }] = useAnalyzeMineCareRepairReplaceMutation()
  const [form, setForm] = useState({ equipmentId: '', repairCost: 0, replacementCost: 0 })
  const [actionError, setActionError] = useState('')
  const [selected, setSelected] = useState<MineCareRepairReplaceAnalysis | null>(null)

  const runAnalyze = async () => {
    setActionError('')
    if (!form.equipmentId) {
      setActionError('Select equipment before running repair/replace analysis.')
      return
    }
    try {
      await analyze(form).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to generate repair/replace recommendation right now.'))
    }
  }

  return (
    <MineCarePage title="Repair / Replace" description="Compare repair exposure against replacement economics and downtime risk.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load repair/replace history.') : actionError} />
      <SurfacePanel
        title="Run analysis"
        description="Generate a persisted recommendation for a selected asset."
        actions={<Button label="Analyze" icon={<RefreshCw className="h-4 w-4" />} loading={isAnalyzing} onClick={runAnalyze} />}
      >
        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-1 text-sm font-medium">Equipment<Dropdown value={form.equipmentId} options={equipmentOptions(equipment)} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.value }))} className="w-full" filter /></label>
          <label className="space-y-1 text-sm font-medium">Repair Cost<InputNumber value={form.repairCost} min={0} onValueChange={(event) => setForm((current) => ({ ...current, repairCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Replacement Cost<InputNumber value={form.replacementCost} min={0} onValueChange={(event) => setForm((current) => ({ ...current, replacementCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
        </div>
      </SurfacePanel>
      <SurfacePanel title="Analysis history" description="Saved repair versus replacement recommendations.">
        <MineCareTable<MineCareRepairReplaceAnalysis>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.analysisId}
          emptyMessage="No repair/replace analyses found."
          actions={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: setSelected }]}
          columns={[
            { header: 'Analysis', field: 'analysisId' },
            { header: 'Equipment', field: 'equipmentId' },
            { header: 'Recommendation', field: 'recommendation', render: (item) => <StatusBadge value={item.recommendation} /> },
            { header: 'Repair Cost', key: 'repair', render: (item) => formatCurrency(item.financialImpact?.repairOptionCost) },
            { header: 'Replacement', key: 'replacement', render: (item) => formatCurrency(item.financialImpact?.replacementOptionCost) },
            { header: 'AI', key: 'ai', render: (item) => <ConfidenceBadge value={item.confidence} source="agentic" /> },
            { header: 'Reason', field: 'reason' },
          ]}
        />
      </SurfacePanel>
      <Dialog header="Repair / replace details" visible={Boolean(selected)} style={{ width: 'min(760px, 95vw)' }} modal className="crud-view-dialog" maskClassName="crud-form-dialog-mask" contentClassName="overflow-x-auto" onHide={() => setSelected(null)}>
        {selected ? (
          <div className="space-y-5">
            <DetailGrid values={{ Analysis: selected.analysisId, Equipment: `${selected.equipmentName} (${selected.equipmentId})`, Recommendation: <StatusBadge value={selected.recommendation} />, 'Repair Ratio': selected.repairCostRatio, 'Replacement Year': selected.estimatedReplacementYear, Confidence: formatConfidence(selected.confidence) }} />
            <DetailGrid values={{ 'Repair Cost': formatCurrency(selected.financialImpact?.repairOptionCost), 'Replacement Cost': formatCurrency(selected.financialImpact?.replacementOptionCost), 'Downtime Risk': formatCurrency(selected.financialImpact?.downtimeRisk), 'Projected Savings': formatCurrency(selected.financialImpact?.projectedSavings) }} />
            {selected.paybackEstimate ? <DetailGrid values={{ 'AI Payback Estimate': selected.paybackEstimate }} /> : null}
            <section><h3 className="font-semibold">Reason</h3><p className="mt-2 text-sm">{selected.reason}</p></section>
            {selected.decisionFactors?.length ? <section><h3 className="font-semibold">Decision factors</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.decisionFactors.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
            <section><h3 className="font-semibold">Recommended actions</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.recommendedActions.map((item) => <li key={item}>{item}</li>)}</ul></section>
          </div>
        ) : null}
      </Dialog>
    </MineCarePage>
  )
}
