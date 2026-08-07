import { useState } from 'react'
import { Eye, TimerReset } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { useGetMineCareDowntimeScenariosQuery, useGetMineCareEquipmentQuery, useSimulateMineCareDowntimeMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareDowntimeScenario } from '@/types/mineCareAi'
import { DetailGrid, ErrorBanner, errorMessage, equipmentOptions, formatCurrency, formatPercent, MineCarePage, MineCareTable, StatusBadge, SurfacePanel } from './shared'

export function MineCareDowntimeSimulatorPage() {
  const { data = [], isLoading, isError, error } = useGetMineCareDowntimeScenariosQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [simulate, { isLoading: isSimulating }] = useSimulateMineCareDowntimeMutation()
  const [form, setForm] = useState({ equipmentId: '', expectedDowntimeHours: 0, productionLossPerHour: 0, repairDelayDays: 0, dependentProcesses: '' })
  const [actionError, setActionError] = useState('')
  const [selected, setSelected] = useState<MineCareDowntimeScenario | null>(null)

  const runSimulate = async () => {
    setActionError('')
    if (!form.equipmentId) {
      setActionError('Select equipment before simulating downtime.')
      return
    }
    try {
      await simulate({ ...form, dependentProcesses: form.dependentProcesses.split(',').map((item) => item.trim()).filter(Boolean) } as any).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to simulate downtime right now.'))
    }
  }

  return (
    <MineCarePage title="Downtime Simulator" description="Estimate production loss and priority from downtime and repair delay assumptions.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load downtime scenarios.') : actionError} />
      <SurfacePanel
        title="Scenario inputs"
        description="Run a quick production impact simulation."
        actions={<Button label="Simulate" icon={<TimerReset className="h-4 w-4" />} loading={isSimulating} onClick={runSimulate} />}
      >
        <div className="grid gap-4 md:grid-cols-5">
          <label className="space-y-1 text-sm font-medium md:col-span-2">Equipment<Dropdown value={form.equipmentId} options={equipmentOptions(equipment)} onChange={(event) => setForm((current) => ({ ...current, equipmentId: event.value }))} className="w-full" filter /></label>
          <label className="space-y-1 text-sm font-medium">Downtime Hours<InputNumber value={form.expectedDowntimeHours} min={0} onValueChange={(event) => setForm((current) => ({ ...current, expectedDowntimeHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Loss / Hour<InputNumber value={form.productionLossPerHour} min={0} onValueChange={(event) => setForm((current) => ({ ...current, productionLossPerHour: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Delay Days<InputNumber value={form.repairDelayDays} min={0} onValueChange={(event) => setForm((current) => ({ ...current, repairDelayDays: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-5">Dependent Processes<InputText value={form.dependentProcesses} onChange={(event) => setForm((current) => ({ ...current, dependentProcesses: event.target.value }))} className="w-full" /></label>
        </div>
      </SurfacePanel>
      <SurfacePanel title="Saved scenarios" description="Downtime impact estimates and recommendations.">
        <MineCareTable<MineCareDowntimeScenario>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.scenarioId}
          emptyMessage="No downtime scenarios found."
          actions={[{ label: 'View', icon: <Eye className="h-4 w-4" />, onClick: setSelected }]}
          columns={[
            { header: 'Scenario', field: 'scenarioId' },
            { header: 'Equipment', field: 'equipmentId' },
            { header: 'Hours', field: 'expectedDowntimeHours' },
            { header: 'Delay', field: 'repairDelayDays', render: (item) => `${item.repairDelayDays}d` },
            { header: 'Production Loss', field: 'productionLoss', render: (item) => formatCurrency(item.productionLoss) },
            { header: 'Risk', field: 'riskLevel', render: (item) => <StatusBadge value={item.riskLevel} /> },
            { header: 'Action', field: 'recommendedAction' },
          ]}
        />
      </SurfacePanel>
      <Dialog header="Downtime scenario details" visible={Boolean(selected)} style={{ width: 'min(720px, 95vw)' }} modal className="crud-view-dialog" maskClassName="crud-form-dialog-mask" contentClassName="overflow-x-auto" onHide={() => setSelected(null)}>
        {selected ? (
          <div className="space-y-5">
            <DetailGrid values={{ Scenario: selected.scenarioId, Equipment: `${selected.equipmentName} (${selected.equipmentId})`, 'Downtime Hours': selected.expectedDowntimeHours, 'Loss / Hour': formatCurrency(selected.productionLossPerHour), 'Repair Delay': `${selected.repairDelayDays} day(s)`, Risk: <StatusBadge value={selected.riskLevel} /> }} />
            <DetailGrid values={{ 'Production Loss': formatCurrency(selected.productionLoss), 'Failure Probability': formatPercent(selected.failureProbability), 'Dependent Processes': selected.dependentProcesses.join(', ') || '-' }} />
            {selected.impactExplanation ? <section><h3 className="font-semibold">AI impact explanation</h3><p className="mt-2 text-sm">{selected.impactExplanation}</p></section> : null}
            <section><h3 className="font-semibold">Recommended action</h3><p className="mt-2 text-sm">{selected.recommendedAction}</p></section>
            {selected.recoveryPlan?.length ? <section><h3 className="font-semibold">Recovery plan</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.recoveryPlan.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
            {selected.mitigationOptions?.length ? <section><h3 className="font-semibold">Mitigation options</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{selected.mitigationOptions.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
          </div>
        ) : null}
      </Dialog>
    </MineCarePage>
  )
}
