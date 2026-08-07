import { useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { Button } from 'primereact/button'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useCompleteMineCareServiceMutation, useGetMineCareServiceCalendarQuery } from '@/services/api/endpoints/mineCareAiApi'
import type { MineCareServiceDue } from '@/types/mineCareAi'
import { ErrorBanner, errorMessage, MineCarePage, ServiceTable, SurfacePanel, WarrantyTable } from './shared'

const todayInputValue = () => new Date().toISOString().slice(0, 10)

export function MineCareServiceCalendarPage() {
  const { data, isLoading } = useGetMineCareServiceCalendarQuery()
  const [completeService, { isLoading: isCompleting }] = useCompleteMineCareServiceMutation()
  const [selectedService, setSelectedService] = useState<MineCareServiceDue | null>(null)
  const [actionError, setActionError] = useState('')
  const [completionForm, setCompletionForm] = useState({
    serviceDate: todayInputValue(),
    runningHours: 0,
    actionTaken: '',
    technician: '',
    cost: 0,
    downtimeHours: 0,
  })

  if (isLoading || !data) return <LoadingScreen message="Loading service calendar..." />

  const openCompleteService = (service: MineCareServiceDue) => {
    setActionError('')
    setSelectedService(service)
    setCompletionForm({
      serviceDate: todayInputValue(),
      runningHours: service.nextServiceHours,
      actionTaken: `Completed ${service.serviceName}.`,
      technician: '',
      cost: service.estimatedCost,
      downtimeHours: 0,
    })
  }

  const submitCompleteService = async () => {
    if (!selectedService) return
    setActionError('')
    try {
      await completeService({
        equipmentId: selectedService.equipmentId,
        serviceName: selectedService.serviceName,
        ...completionForm,
      }).unwrap()
      setSelectedService(null)
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to complete service right now.'))
    }
  }

  const serviceActions = [
    {
      label: 'Complete Service',
      icon: <CheckCircle2 className="h-4 w-4" />,
      onClick: openCompleteService,
    },
  ]

  return (
    <MineCarePage title="Service Calendar" description="Weekly, monthly, overdue, and warranty inspection planning.">
      <ErrorBanner message={actionError} />
      {data.aiSummary ? (
        <SurfacePanel title="AI Service Plan" description={data.aiSummary}>
          {data.aiRecommendedPlan?.length ? (
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
              {data.aiRecommendedPlan.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </SurfacePanel>
      ) : null}
      <div className="space-y-4">
        <SurfacePanel title="Overdue Services">
          <ServiceTable services={data.overdueServices} actions={serviceActions} tableHeightClassName="max-h-[24rem]" />
        </SurfacePanel>
        <SurfacePanel title="Due This Week">
          <ServiceTable services={data.weeklyCalendar} actions={serviceActions} tableHeightClassName="max-h-[24rem]" />
        </SurfacePanel>
        <SurfacePanel title="Upcoming Services">
          <ServiceTable services={data.upcomingServices} actions={serviceActions} tableHeightClassName="max-h-[24rem]" />
        </SurfacePanel>
        <SurfacePanel title="Warranty Inspections">
          <WarrantyTable warranties={data.warrantyInspections} />
        </SurfacePanel>
      </div>
      <Dialog
        header="Complete Service"
        visible={Boolean(selectedService)}
        style={{ width: 'min(720px, 95vw)' }}
        modal
        className="crud-form-dialog"
        maskClassName="crud-form-dialog-mask"
        onHide={() => setSelectedService(null)}
        footer={<div className="flex justify-end gap-2"><Button label="Cancel" severity="secondary" outlined onClick={() => setSelectedService(null)} /><Button label="Save Maintenance Record" loading={isCompleting} onClick={submitCompleteService} /></div>}
      >
        {selectedService ? (
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1 text-sm font-medium">Equipment<InputText value={`${selectedService.equipmentName} (${selectedService.equipmentId})`} disabled className="w-full" /></label>
            <label className="space-y-1 text-sm font-medium">Service<InputText value={selectedService.serviceName} disabled className="w-full" /></label>
            <label className="space-y-1 text-sm font-medium">Service Date<InputText type="date" value={completionForm.serviceDate} onChange={(event) => setCompletionForm((current) => ({ ...current, serviceDate: event.target.value }))} className="w-full" /></label>
            <label className="space-y-1 text-sm font-medium">Running Hours<InputNumber value={completionForm.runningHours} min={0} onValueChange={(event) => setCompletionForm((current) => ({ ...current, runningHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
            <label className="space-y-1 text-sm font-medium">Technician<InputText value={completionForm.technician} onChange={(event) => setCompletionForm((current) => ({ ...current, technician: event.target.value }))} className="w-full" /></label>
            <label className="space-y-1 text-sm font-medium">Cost<InputNumber value={completionForm.cost} min={0} onValueChange={(event) => setCompletionForm((current) => ({ ...current, cost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
            <label className="space-y-1 text-sm font-medium">Downtime Hours<InputNumber value={completionForm.downtimeHours} min={0} onValueChange={(event) => setCompletionForm((current) => ({ ...current, downtimeHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
            <label className="space-y-1 text-sm font-medium md:col-span-2">Action Taken<InputTextarea rows={3} value={completionForm.actionTaken} onChange={(event) => setCompletionForm((current) => ({ ...current, actionTaken: event.target.value }))} className="w-full" /></label>
          </div>
        ) : null}
      </Dialog>
    </MineCarePage>
  )
}
