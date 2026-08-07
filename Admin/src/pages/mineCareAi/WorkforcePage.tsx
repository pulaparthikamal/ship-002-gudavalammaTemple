import { useState } from 'react'
import { Edit, Plus, Trash2, UserCheck } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { Dropdown } from 'primereact/dropdown'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { MultiSelect } from 'primereact/multiselect'
import { useCreateMineCareTechnicianMutation, useDeleteMineCareTechnicianMutation, useGetMineCareEquipmentQuery, useGetMineCareTechniciansQuery, useRecommendMineCareTechnicianMutation, useUpdateMineCareTechnicianMutation } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareTechnician } from '@/types/mineCareAi'
import { equipmentOptions, equipmentTypeOptions, ErrorBanner, errorMessage, issueTypeOptions, MineCarePage, MineCareTable, selectedEquipmentType, StatusBadge, SurfacePanel } from './shared'

const availabilityOptions = ['Available', 'Busy', 'On Leave'].map((value) => ({ label: value, value }))
const skillOptions = ['Hydraulics', 'Engine', 'Excavator', 'Crusher', 'Bearing', 'Lubrication', 'Electrical', 'Controls', 'Drill'].map((value) => ({ label: value, value }))
const defaultForm: Partial<MineCareTechnician> = {
  technicianName: '',
  employeeId: '',
  skills: [],
  equipmentTypes: [],
  issueTypes: [],
  availabilityStatus: 'Available',
  averageResolutionHours: 8,
  successRate: 85,
  completedJobs: 0,
  location: '',
}

export function MineCareWorkforcePage() {
  const { data = [], isLoading, isError, error } = useGetMineCareTechniciansQuery()
  const { data: equipment = [] } = useGetMineCareEquipmentQuery()
  const [recommend, { data: recommendations = [], isLoading: isRecommending }] = useRecommendMineCareTechnicianMutation()
  const [createTechnician, { isLoading: isCreating }] = useCreateMineCareTechnicianMutation()
  const [updateTechnician, { isLoading: isUpdating }] = useUpdateMineCareTechnicianMutation()
  const [deleteTechnician, { isLoading: isDeleting }] = useDeleteMineCareTechnicianMutation()
  const [recommendForm, setRecommendForm] = useState({ equipmentId: '', issueType: '', requiredSkill: '', location: '' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<MineCareTechnician | null>(null)
  const [form, setForm] = useState<Partial<MineCareTechnician>>(defaultForm)
  const [actionError, setActionError] = useState('')

  const openCreate = () => {
    setEditing(null)
    setForm(defaultForm)
    setActionError('')
    setDialogOpen(true)
  }

  const openEdit = (item: MineCareTechnician) => {
    setEditing(item)
    setForm(item)
    setActionError('')
    setDialogOpen(true)
  }

  const runRecommend = async () => {
    setActionError('')
    const equipmentType = selectedEquipmentType(equipment, recommendForm.equipmentId)
    if (!equipmentType) {
      setActionError('Select equipment before recommending technicians.')
      return
    }
    if (!recommendForm.issueType) {
      setActionError('Select issue type before recommending technicians.')
      return
    }
    try {
      await recommend({ equipmentType, issueType: recommendForm.issueType }).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to generate workforce recommendation right now.'))
    }
  }

  const save = async () => {
    setActionError('')
    if (!String(form.technicianName ?? '').trim()) {
      setActionError('Technician name is required.')
      return
    }
    try {
      if (editing) {
        await updateTechnician({ id: editing.technicianId, data: form }).unwrap()
      } else {
        await createTechnician(form).unwrap()
      }
      setDialogOpen(false)
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to save technician.'))
    }
  }

  const remove = async (item: MineCareTechnician) => {
    setActionError('')
    try {
      await deleteTechnician(item.technicianId).unwrap()
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to delete technician.'))
    }
  }

  return (
    <MineCarePage title="Workforce Advisor" description="Match available technicians to equipment type, issue type, skill fit, and service history.">
      <ErrorBanner message={isError ? errorMessage(error, 'Unable to load technicians.') : actionError} />
      <SurfacePanel
        title="Recommend technician"
        description="Rank technicians for the current maintenance issue."
        actions={<Button label="Recommend" icon={<UserCheck className="h-4 w-4" />} loading={isRecommending} onClick={runRecommend} />}
      >
        <div className="grid gap-4 md:grid-cols-4">
          <label className="space-y-1 text-sm font-medium">Equipment<Dropdown value={recommendForm.equipmentId} options={equipmentOptions(equipment)} onChange={(event) => setRecommendForm((current) => ({ ...current, equipmentId: event.value }))} className="w-full" filter /></label>
          <label className="space-y-1 text-sm font-medium">Issue Type<Dropdown value={recommendForm.issueType} options={issueTypeOptions} onChange={(event) => setRecommendForm((current) => ({ ...current, issueType: event.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Required Skill<Dropdown value={recommendForm.requiredSkill} options={skillOptions} onChange={(event) => setRecommendForm((current) => ({ ...current, requiredSkill: event.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Location<InputText value={recommendForm.location} onChange={(event) => setRecommendForm((current) => ({ ...current, location: event.target.value }))} className="w-full" /></label>
        </div>
      </SurfacePanel>
      <SurfacePanel title="Recommendation results" description="Best-fit technician ranking for the selected issue.">
        <MineCareTable<MineCareTechnician>
          data={recommendations}
          getRowId={(item) => item.technicianId}
          emptyMessage="Run a recommendation to rank technicians."
          columns={[
            { header: 'Technician', field: 'technicianName' },
            { header: 'Availability', field: 'availabilityStatus', render: (item) => <StatusBadge value={item.availabilityStatus} /> },
            { header: 'Score', field: 'matchScore' },
            { header: 'Skills', key: 'skills', render: (item) => item.skills.join(', ') },
            { header: 'AI Fit', key: 'aiExplanation', render: (item) => item.aiExplanation || item.reason },
            { header: 'Skill Gap', key: 'skillGap', render: (item) => item.skillGap?.length ? item.skillGap.join(', ') : 'None' },
            { header: 'Training', key: 'trainingSuggestion', render: (item) => item.trainingSuggestion || '-' },
          ]}
        />
      </SurfacePanel>
      <SurfacePanel title="Technicians" description="MineCare workforce roster." actions={<Button label="Create Technician" icon={<Plus className="h-4 w-4" />} onClick={openCreate} />}>
        <MineCareTable<MineCareTechnician>
          data={data}
          isLoading={isLoading}
          getRowId={(item) => item.technicianId}
          emptyMessage="No technicians found."
          actions={[
            { label: 'Edit', icon: <Edit className="h-4 w-4" />, onClick: openEdit },
            { label: 'Delete', icon: <Trash2 className="h-4 w-4" />, tone: 'danger', loading: isDeleting, onClick: remove },
          ]}
          columns={[
            { header: 'Technician', field: 'technicianName' },
            { header: 'Employee', field: 'employeeId' },
            { header: 'Availability', field: 'availabilityStatus', render: (item) => <StatusBadge value={item.availabilityStatus} /> },
            { header: 'Equipment Types', key: 'equipmentTypes', render: (item) => item.equipmentTypes.join(', ') },
            { header: 'Success', field: 'successRate', render: (item) => `${item.successRate}%` },
            { header: 'Location', field: 'location' },
          ]}
        />
      </SurfacePanel>

      <Dialog header={editing ? 'Edit Technician' : 'Create Technician'} visible={dialogOpen} style={{ width: 'min(820px, 95vw)' }} modal className="crud-form-dialog" maskClassName="crud-form-dialog-mask" onHide={() => setDialogOpen(false)} footer={<div className="flex justify-end gap-2"><Button label="Cancel" severity="secondary" outlined onClick={() => setDialogOpen(false)} /><Button label="Save" loading={isCreating || isUpdating} onClick={save} /></div>}>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Technician Name<InputText value={form.technicianName ?? ''} onChange={(event) => setForm((current) => ({ ...current, technicianName: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Employee ID<InputText value={form.employeeId ?? ''} onChange={(event) => setForm((current) => ({ ...current, employeeId: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Skills<MultiSelect value={form.skills ?? []} options={skillOptions} onChange={(event) => setForm((current) => ({ ...current, skills: event.value }))} className="w-full" display="chip" filter /></label>
          <label className="space-y-1 text-sm font-medium">Equipment Types<MultiSelect value={form.equipmentTypes ?? []} options={equipmentTypeOptions} onChange={(event) => setForm((current) => ({ ...current, equipmentTypes: event.value }))} className="w-full" display="chip" /></label>
          <label className="space-y-1 text-sm font-medium">Issue Types<MultiSelect value={form.issueTypes ?? []} options={issueTypeOptions} onChange={(event) => setForm((current) => ({ ...current, issueTypes: event.value }))} className="w-full" display="chip" /></label>
          <label className="space-y-1 text-sm font-medium">Availability<Dropdown value={form.availabilityStatus} options={availabilityOptions} onChange={(event) => setForm((current) => ({ ...current, availabilityStatus: event.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Average Resolution Hours<InputNumber value={form.averageResolutionHours ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, averageResolutionHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Success Rate<InputNumber value={form.successRate ?? 0} min={0} max={100} onValueChange={(event) => setForm((current) => ({ ...current, successRate: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Completed Jobs<InputNumber value={form.completedJobs ?? 0} min={0} onValueChange={(event) => setForm((current) => ({ ...current, completedJobs: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Location<InputText value={form.location ?? ''} onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))} className="w-full" /></label>
        </div>
      </Dialog>
    </MineCarePage>
  )
}
