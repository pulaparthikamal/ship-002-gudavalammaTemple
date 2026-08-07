import { useEffect, useState } from 'react'
import { Edit, Plus, Scale, Trash2 } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { useCompareMineCareProcurementOptionsMutation, useCreateMineCareProcurementOptionMutation, useDeleteMineCareProcurementOptionMutation, useGetMineCareProcurementComparisonsQuery, useGetMineCareProcurementOptionsQuery, useUpdateMineCareProcurementOptionMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareProcurementComparison, MineCareProcurementOption } from '@/types/mineCareAi'
import { DetailGrid, EmptyState, equipmentTypeOptions, ErrorBanner, errorMessage, formatConfidence, formatCurrency, MineCarePage, MineCareTable, SurfacePanel } from './shared'

const defaultForm: Partial<MineCareProcurementOption> = {
  name: '',
  equipmentType: 'Crusher',
  vendor: '',
  purchaseCost: 0,
  warrantyYears: 1,
  expectedMaintenanceCost: 0,
  fuelCost: 0,
  expectedLifeYears: 5,
  resaleValue: 0,
  downtimeRiskCost: 0,
  notes: '',
}

export function MineCareProcurementAdvisorPage() {
  const { data = [], isLoading, isError, error } = useGetMineCareProcurementOptionsQuery()
  const { data: comparisons = [] } = useGetMineCareProcurementComparisonsQuery()
  const [compare, { data: comparison, isLoading: isComparing }] = useCompareMineCareProcurementOptionsMutation()
  const [createOption, { isLoading: isCreating }] = useCreateMineCareProcurementOptionMutation()
  const [updateOption, { isLoading: isUpdating }] = useUpdateMineCareProcurementOptionMutation()
  const [deleteOption, { isLoading: isDeleting }] = useDeleteMineCareProcurementOptionMutation()
  const [selected, setSelected] = useState<string[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MineCareProcurementOption | null>(null)
  const [form, setForm] = useState<Partial<MineCareProcurementOption>>(defaultForm)
  const [actionError, setActionError] = useState('')
  const latestComparison = comparison ?? comparisons[0]
  const selectedIds = selected.filter((id) => data.some((item) => item.optionId === id))
  const selectedOptions = data.filter((item) => selectedIds.includes(item.optionId))
  const selectedEquipmentTypes = [...new Set(selectedOptions.map((item) => item.equipmentType).filter(Boolean))]

  useEffect(() => {
    setSelected((current) => current.filter((id) => data.some((item) => item.optionId === id)))
  }, [data])

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
    setActionError('')
    setDialogOpen(true)
  }

  const openEdit = (item: MineCareProcurementOption) => {
    setEditing(item)
    setForm(item)
    setActionError('')
    setDialogOpen(true)
  }

  const runCompare = async () => {
    setActionError('')
    if (selectedIds.length < 2) {
      setActionError('Select at least two procurement options to compare.')
      return
    }
    if (selectedEquipmentTypes.length > 1) {
      setActionError(`Select options from one equipment type only. Current selection includes: ${selectedEquipmentTypes.join(', ')}.`)
      return
    }
    try {
      await compare({ optionIds: selectedIds }).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to compare procurement options right now.'))
    }
  }

  const save = async () => {
    setActionError('')
    if (!String(form.name ?? '').trim()) {
      setActionError('Procurement option name is required.')
      return
    }
    try {
      if (editing) {
        await updateOption({ id: editing.optionId, data: form }).unwrap()
      } else {
        await createOption(form).unwrap()
      }
      setDialogOpen(false)
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to save procurement option.'))
    }
  }

  const remove = async (item: MineCareProcurementOption) => {
    setActionError('')
    try {
      await deleteOption(item.optionId).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to delete procurement option.'))
    }
  }

  const renderComparison = (item?: MineCareProcurementComparison) => {
    if (!item) return <EmptyState message="Run a comparison to see lifecycle cost recommendations." />
    return (
      <div className="space-y-5">
        <DetailGrid values={{ 'Best Option': item.bestOption, Confidence: formatConfidence(item.confidence), 'Recommended Actions': item.recommendedActions.join(', ') }} />
        {item.vendorRiskSummary ? (
          <section>
            <h3 className="font-semibold">AI vendor risk summary</h3>
            <p className="mt-2 text-sm text-muted-foreground">{item.vendorRiskSummary}</p>
          </section>
        ) : null}
        {item.decisionFactors?.length ? (
          <section>
            <h3 className="font-semibold">Decision factors</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{item.decisionFactors.map((factor) => <li key={factor}>{factor}</li>)}</ul>
          </section>
        ) : null}
        {item.negotiationPoints?.length ? (
          <section>
            <h3 className="font-semibold">Negotiation points</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{item.negotiationPoints.map((point) => <li key={point}>{point}</li>)}</ul>
          </section>
        ) : null}
        <MineCareTable
          data={item.comparison}
          getRowId={(row) => row.optionId}
          emptyMessage="No comparison rows."
          columns={[
            { header: 'Option', field: 'optionId' },
            { header: 'Name', field: 'name' },
            { header: 'Five Year TCO', field: 'fiveYearTco', render: (row) => formatCurrency(row.fiveYearTco) },
          ]}
        />
      </div>
    )
  }

  return (
    <MineCarePage title="Procurement Advisor" description="Compare purchase options by lifecycle cost, warranty, maintenance, and downtime exposure.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load procurement options.') : actionError} />
      <SurfacePanel
        title="Compare options"
        description="Select options and compare total cost of ownership."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--color-text-muted)]">{selectedIds.length} selected</span>
            <Button label="Select All" severity="secondary" outlined onClick={() => setSelected(data.map((item) => item.optionId))} disabled={!data.length || selectedIds.length === data.length} />
            <Button label="Clear" severity="secondary" outlined onClick={() => setSelected([])} disabled={!selectedIds.length} />
            <Button label="Create Option" icon={<Plus className="h-4 w-4" />} severity="secondary" outlined onClick={openCreate} />
            <Button label="Compare" icon={<Scale className="h-4 w-4" />} loading={isComparing} disabled={selectedIds.length < 2 || selectedEquipmentTypes.length > 1} onClick={runCompare} />
          </div>
        }
      >
        <MineCareTable<MineCareProcurementOption>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.optionId}
          showSelection
          selectedItems={data.filter((item) => selectedIds.includes(item.optionId))}
          onSelectionChange={(items) => setSelected(items.map((item) => item.optionId))}
          rowClassName={(item) => selected.includes(item.optionId) ? 'bg-[var(--color-primary-soft)]' : ''}
          emptyMessage="No procurement options found."
          actions={[
            { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: openEdit },
            { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', loading: isDeleting, onClick: remove },
          ]}
          columns={[
            { header: 'Option', field: 'optionId' },
            { header: 'Name', field: 'name' },
            { header: 'Type', field: 'equipmentType' },
            { header: 'Vendor', field: 'vendor' },
            { header: 'Purchase', field: 'purchaseCost', render: (item) => formatCurrency(item.purchaseCost) },
            { header: 'Maint./Yr', field: 'expectedMaintenanceCost', render: (item) => formatCurrency(item.expectedMaintenanceCost) },
            { header: 'Downtime Risk', field: 'downtimeRiskCost', render: (item) => formatCurrency(item.downtimeRiskCost) },
          ]}
        />
      </SurfacePanel>
      <SurfacePanel title="Latest comparison" description={latestComparison?.reason || 'AI-assisted TCO result.'}>
        {renderComparison(latestComparison)}
      </SurfacePanel>
      <SurfacePanel title="Comparison history" description="Saved procurement comparison runs.">
        <MineCareTable<MineCareProcurementComparison>
          data={comparisons}
          getRowId={(item) => item.comparisonId}
          emptyMessage="No comparison history found."
          columns={[
            { header: 'Comparison', field: 'comparisonId' },
            { header: 'Best Option', field: 'bestOption' },
            { header: 'Options', key: 'options', render: (item) => item.selectedOptionIds.join(', ') },
            { header: 'Confidence', field: 'confidence', render: (item) => formatConfidence(item.confidence) },
            { header: 'AI Decision', key: 'decisionFactors', render: (item) => item.decisionFactors?.[0] || item.reason },
          ]}
        />
      </SurfacePanel>
      <Dialog header={editing ? 'Edit Procurement Option' : 'Create Procurement Option'} visible={dialogOpen} style={{ width: 'min(820px, 95vw)' }} modal className="crud-form-dialog" maskClassName="crud-form-dialog-mask" onHide={() => setDialogOpen(false)} footer={<div className="flex justify-end gap-2"><Button label="Cancel" severity="secondary" outlined onClick={() => setDialogOpen(false)} /><Button label="Save" loading={isCreating || isUpdating} onClick={save} /></div>}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Name<InputText value={form.name ?? ''} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Equipment Type<Dropdown value={form.equipmentType} options={equipmentTypeOptions} onChange={(event) => setForm((current) => ({ ...current, equipmentType: event.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Vendor<InputText value={form.vendor ?? ''} onChange={(event) => setForm((current) => ({ ...current, vendor: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Purchase Cost<InputNumber value={form.purchaseCost ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, purchaseCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Warranty Years<InputNumber value={form.warrantyYears ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, warrantyYears: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Expected Maintenance Cost<InputNumber value={form.expectedMaintenanceCost ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, expectedMaintenanceCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Fuel Cost<InputNumber value={form.fuelCost ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, fuelCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Expected Life Years<InputNumber value={form.expectedLifeYears ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, expectedLifeYears: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Resale Value<InputNumber value={form.resaleValue ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, resaleValue: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Downtime Risk Cost<InputNumber value={form.downtimeRiskCost ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, downtimeRiskCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Notes<InputTextarea rows={3} value={form.notes ?? ''} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full" /></label>
        </div>
      </Dialog>
    </MineCarePage>
  )
}
