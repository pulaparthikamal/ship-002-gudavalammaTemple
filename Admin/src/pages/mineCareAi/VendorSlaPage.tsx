import { useState } from 'react'
import { Edit, Handshake, Plus, ShieldAlert, Trash2, Wallet } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { MultiSelect } from 'primereact/multiselect'
import { useCreateMineCareVendorSlaMutation, useDeleteMineCareVendorSlaMutation, useGetMineCareEquipmentQuery, useGetMineCareVendorSlaScorecardQuery, useGetMineCareVendorSlasQuery, useUpdateMineCareVendorSlaMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareVendorSla } from '@/types/mineCareAi'
import { contractTypeOptions, ErrorBanner, errorMessage, equipmentOptions, formatCurrency, formatDate, MineCarePage, MineCareTable, StatusBadge, SummaryCard, SurfacePanel } from './shared'

const statusOptions = ['Active', 'At Risk', 'Breached', 'Closed'].map((value) => ({ label: value, value }))

const defaultForm: Partial<MineCareVendorSla> = {
  vendorName: '',
  contractType: 'OEM Support',
  equipmentIds: [],
  serviceFrequencyDays: 30,
  committedResponseHours: 24,
  actualResponseHours: 0,
  plannedServiceDate: new Date().toISOString().slice(0, 10),
  actualServiceDate: '',
  missedServiceCount: 0,
  slaCompliancePercent: 100,
  penaltyAmount: 0,
  status: 'Active',
}

export function MineCareVendorSlaPage() {
  const { data = [], isLoading, isError, error } = useGetMineCareVendorSlasQuery()
  const { data: scorecard } = useGetMineCareVendorSlaScorecardQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [createSla, { isLoading: isCreating }] = useCreateMineCareVendorSlaMutation()
  const [updateSla, { isLoading: isUpdating }] = useUpdateMineCareVendorSlaMutation()
  const [deleteSla, { isLoading: isDeleting }] = useDeleteMineCareVendorSlaMutation()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MineCareVendorSla | null>(null)
  const [form, setForm] = useState<Partial<MineCareVendorSla>>(defaultForm)
  const [actionError, setActionError] = useState('')

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
    setActionError('')
    setDialogOpen(true)
  }

  const openEdit = (item: MineCareVendorSla) => {
    setEditing(item)
    setForm({ ...item, plannedServiceDate: item.plannedServiceDate?.slice(0, 10), actualServiceDate: item.actualServiceDate?.slice(0, 10) ?? '' })
    setActionError('')
    setDialogOpen(true)
  }

  const save = async () => {
    setActionError('')
    if (!String(form.vendorName ?? '').trim()) {
      setActionError('Vendor name is required.')
      return
    }
    try {
      if (editing) {
        await updateSla({ id: editing.slaId, data: form }).unwrap()
      } else {
        await createSla(form).unwrap()
      }
      setDialogOpen(false)
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to save Vendor SLA.'))
    }
  }

  const remove = async (item: MineCareVendorSla) => {
    setActionError('')
    try {
      await deleteSla(item.slaId).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to delete Vendor SLA.'))
    }
  }

  return (
    <MineCarePage title="Vendor SLA" description="Track vendor response commitments, compliance, missed services, and penalty exposure.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load Vendor SLA records.') : actionError} />
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Active Contracts" value={scorecard?.activeContracts ?? 0} icon={Handshake} detail="Current vendor support" />
        <SummaryCard label="At Risk" value={scorecard?.atRiskContracts ?? 0} icon={ShieldAlert} detail="At risk or breached SLAs" />
        <SummaryCard label="Penalty Exposure" value={formatCurrency(scorecard?.totalPenaltyExposure)} icon={Wallet} detail="Potential recoverable penalties" />
      </div>
      <SurfacePanel title="SLA contracts" description="Vendor performance and contractual commitments." actions={<Button label="Create Vendor SLA" icon={<Plus className="h-4 w-4" />} onClick={openCreate} />}>
        <MineCareTable<MineCareVendorSla>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.slaId}
          emptyMessage="No vendor SLA records found."
          actions={[
            { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: openEdit },
            { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', loading: isDeleting, onClick: remove },
          ]}
          columns={[
            { header: 'SLA', field: 'slaId' },
            { header: 'Vendor', field: 'vendorName' },
            { header: 'Contract', field: 'contractType' },
            { header: 'Equipment', key: 'equipment', render: (item) => item.equipmentIds.join(', ') },
            { header: 'Planned', field: 'plannedServiceDate', render: (item) => formatDate(item.plannedServiceDate) },
            { header: 'Compliance', field: 'slaCompliancePercent', render: (item) => `${item.slaCompliancePercent}%` },
            { header: 'Penalty', field: 'penaltyAmount', render: (item) => formatCurrency(item.penaltyAmount) },
            { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
          ]}
        />
      </SurfacePanel>
      <Dialog header={editing ? 'Edit Vendor SLA' : 'Create Vendor SLA'} visible={dialogOpen} style={{ width: 'min(820px, 95vw)' }} modal className="crud-form-dialog" maskClassName="crud-form-dialog-mask" onHide={() => setDialogOpen(false)} footer={<div className="flex justify-end gap-2"><Button label="Cancel" severity="secondary" outlined onClick={() => setDialogOpen(false)} /><Button label="Save" loading={isCreating || isUpdating} onClick={save} /></div>}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Vendor Name<InputText value={form.vendorName ?? ''} onChange={(event) => setForm((current) => ({ ...current, vendorName: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Contract Type<Dropdown value={form.contractType} options={contractTypeOptions} onChange={(event) => setForm((current) => ({ ...current, contractType: event.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Equipment<MultiSelect value={form.equipmentIds ?? []} options={equipmentOptions(equipment)} onChange={(event) => setForm((current) => ({ ...current, equipmentIds: event.value }))} className="w-full" filter display="chip" /></label>
          <label className="space-y-1 text-sm font-medium">Service Frequency Days<InputNumber value={form.serviceFrequencyDays ?? 30} min={1} onValueChange={(event) => setForm((current) => ({ ...current, serviceFrequencyDays: Number(event.value ?? 1) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Committed Response Hours<InputNumber value={form.committedResponseHours ?? 24} min={0} onValueChange={(event) => setForm((current) => ({ ...current, committedResponseHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Actual Response Hours<InputNumber value={form.actualResponseHours ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, actualResponseHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Missed Services<InputNumber value={form.missedServiceCount ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, missedServiceCount: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Planned Service Date<input type="date" value={form.plannedServiceDate ?? ''} onChange={(event) => setForm((current) => ({ ...current, plannedServiceDate: event.target.value }))} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">Actual Service Date<input type="date" value={form.actualServiceDate ?? ''} onChange={(event) => setForm((current) => ({ ...current, actualServiceDate: event.target.value }))} className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2" /></label>
          <label className="space-y-1 text-sm font-medium">SLA Compliance %<InputNumber value={form.slaCompliancePercent ?? 100} min={0} max={100} onValueChange={(event) => setForm((current) => ({ ...current, slaCompliancePercent: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Penalty Amount<InputNumber value={form.penaltyAmount ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, penaltyAmount: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Status<Dropdown value={form.status} options={statusOptions} onChange={(event) => setForm((current) => ({ ...current, status: event.value }))} className="w-full" /></label>
        </div>
      </Dialog>
    </MineCarePage>
  )
}
