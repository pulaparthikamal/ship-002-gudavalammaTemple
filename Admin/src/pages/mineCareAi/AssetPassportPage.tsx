import { useState } from 'react'
import { Activity, AlertTriangle, ArrowLeft, CalendarDays, FileText, Plus, ShieldCheck } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { Dialog } from 'primereact/dialog'
import { InputNumber } from 'primereact/inputnumber'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { resolveApiAssetUrl } from '@/services/api/apiConfig'
import { useGetMineCareEquipmentDetailsQuery, useRecordMineCareBreakdownRepairMutation } from '@/services/api/endpoints/mineCareAiApi'
import {
  DetailGrid,
  EmptyState,
  ErrorBanner,
  errorMessage,
  MineCarePage,
  MineCareTable,
  ObservationTable,
  ScrollRegion,
  ServiceTable,
  StatusBadge,
  SummaryCard,
  SurfacePanel,
  formatCurrency,
  formatDate,
} from './shared'

const todayInputValue = () => new Date().toISOString().slice(0, 10)

export function MineCareAssetPassportPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { data, isLoading } = useGetMineCareEquipmentDetailsQuery(id)
  const [recordBreakdownRepair, { isLoading: isRecordingBreakdown }] = useRecordMineCareBreakdownRepairMutation()
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false)
  const [actionError, setActionError] = useState('')
  const [breakdownForm, setBreakdownForm] = useState({
    breakdownDate: todayInputValue(),
    failureType: '',
    component: '',
    rootCause: '',
    repairCost: 0,
    downtimeHours: 0,
    warrantyClaimRaised: false,
    createMaintenanceRecord: true,
    technician: '',
    actionTaken: '',
    runningHours: 0,
    repaired: true,
  })

  if (isLoading || !data) return <LoadingScreen message="Loading asset passport..." />

  const { equipment, warranty, warrantyStatus, serviceDue, health, lifecycleTracker, lifecycleTimeline } = data
  const lifecycleRows = lifecycleTimeline.map((item, index) => ({ ...item, id: `${item.label}-${item.date}-${index}` }))
  const maintenanceRows: Array<Record<string, unknown> & { id: string }> = data.maintenanceHistory.map((item, index) => ({ ...item, id: String(item._id ?? `maintenance-${index}`) }))
  const breakdownRows: Array<Record<string, unknown> & { id: string }> = data.breakdownHistory.map((item, index) => ({ ...item, id: String(item._id ?? `breakdown-${index}`) }))
  const documentRows = data.documents ?? []

  const openBreakdownDialog = () => {
    setActionError('')
    setBreakdownForm({
      breakdownDate: todayInputValue(),
      failureType: '',
      component: '',
      rootCause: '',
      repairCost: 0,
      downtimeHours: 0,
      warrantyClaimRaised: false,
      createMaintenanceRecord: true,
      technician: '',
      actionTaken: '',
      runningHours: equipment.currentRunningHours,
      repaired: true,
    })
    setBreakdownDialogOpen(true)
  }

  const submitBreakdownRepair = async () => {
    setActionError('')
    if (!breakdownForm.failureType.trim()) {
      setActionError('Failure type is required to record a breakdown.')
      return
    }
    try {
      await recordBreakdownRepair({
        equipmentId: equipment.equipmentId,
        ...breakdownForm,
      }).unwrap()
      setBreakdownDialogOpen(false)
    } catch (err) {
      setActionError(errorMessage(err, 'Unable to record breakdown repair right now.'))
    }
  }

  return (
    <MineCarePage
        title={`${equipment.equipmentId} - ${equipment.name}`}
        description="Asset passport with lifecycle, warranty, service, health, and operator context."
        actions={
          <Button
            type="button"
            label="Back"
            icon={<ArrowLeft className="h-4 w-4" />}
            outlined
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/minecare-ai/equipment'))}
          />
        }
    >
      <ErrorBanner message={actionError} />
      <div className="grid gap-4 md:grid-cols-4">
        <SummaryCard label="Health Score" value={health.score} icon={Activity} />
        <SummaryCard label="Risk Level" value={<StatusBadge value={health.riskLevel} />} icon={AlertTriangle} />
        <SummaryCard label="Warranty" value={<StatusBadge value={warrantyStatus.status} />} icon={ShieldCheck} />
        <SummaryCard label="Next Service" value={serviceDue ? `${serviceDue.remainingHours} hrs` : 'N/A'} icon={CalendarDays} />
      </div>

      {(data.assetAiSummary || data.nextBestAction || data.lifecycleRiskNarrative) ? (
        <SurfacePanel title="AI Asset Brief" description={data.assetAiSummary}>
          <DetailGrid
            values={{
              'Next Best Action': data.nextBestAction ?? '-',
              'Lifecycle Risk': data.lifecycleRiskNarrative ?? '-',
            }}
          />
        </SurfacePanel>
      ) : null}

      <SurfacePanel
        title="Asset Documents"
        description="Uploaded onboarding and knowledge documents linked to this equipment. Ready documents are indexed for Knowledge Assistant and Copilot answers."
      >
        {documentRows.length ? (
          <MineCareTable
            data={documentRows}
            getRowId={(item) => item.documentId}
            emptyMessage="No asset documents found."
            columns={[
              {
                header: 'Document',
                key: 'document',
                render: (item) => (
                  <div className="flex min-w-56 items-center gap-2">
                    <FileText className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-text-strong)]">{item.originalName || item.fileName}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{item.documentId}</p>
                    </div>
                  </div>
                ),
              },
              { header: 'Type', field: 'documentType' },
              { header: 'Source', field: 'uploadSource', render: (item) => item.uploadSource || '-' },
              { header: 'Chunks', field: 'chunkCount' },
              { header: 'Status', field: 'status', render: (item) => <StatusBadge value={item.status} /> },
              {
                header: 'File',
                key: 'file',
                render: (item) => item.fileUrl ? (
                  <Button
                    type="button"
                    label="Open"
                    icon={<FileText className="h-4 w-4" />}
                    size="small"
                    outlined
                    onClick={() => window.open(resolveApiAssetUrl(item.fileUrl), '_blank', 'noopener,noreferrer')}
                  />
                ) : '-',
              },
            ]}
          />
        ) : <EmptyState message="No onboarding or knowledge documents are linked to this asset yet." />}
      </SurfacePanel>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Equipment Information">
          <DetailGrid
            values={{
              Type: equipment.type,
              Brand: equipment.brand,
              Model: equipment.model,
              Serial: equipment.serialNumber,
              Location: equipment.location,
              Department: equipment.department,
              Vendor: equipment.vendor,
              'Invoice Value': formatCurrency(equipment.invoiceValue),
              'Running Hours': equipment.currentRunningHours,
              Criticality: equipment.criticality,
              Status: equipment.status,
            }}
          />
        </SurfacePanel>

        <SurfacePanel title="Purchase & Invoice">
          <DetailGrid
            values={{
              'Purchase Date': formatDate(equipment.purchaseDate),
              Vendor: equipment.vendor,
              'Invoice Value': formatCurrency(equipment.invoiceValue),
              Department: equipment.department,
            }}
          />
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Warranty">
          <DetailGrid
            values={{
              'Warranty Start': formatDate(warranty?.startDate),
              'Warranty End': formatDate(warranty?.endDate),
              'Hour Limit': warranty?.hourLimit ?? '-',
              Status: <StatusBadge value={warrantyStatus.status} />,
              'Remaining Days': warrantyStatus.remainingDays,
              'Remaining Hours': warrantyStatus.remainingHours,
            }}
          />
        </SurfacePanel>
        <SurfacePanel title="Service Due">
          {serviceDue ? <ServiceTable services={[serviceDue]} /> : <EmptyState message="No service due record is currently available." />}
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Health Score">
          <DetailGrid
            values={{
              Score: health.score,
              Status: <StatusBadge value={health.status} />,
              'Risk Level': <StatusBadge value={health.riskLevel} />,
            }}
          />
        </SurfacePanel>
        <SurfacePanel title="AI Recommendation">
          {health.recommendations.length ? (
            <ul className="space-y-2 text-sm text-[var(--color-text)]">
              {health.recommendations.map((recommendation) => <li key={recommendation}>{recommendation}</li>)}
            </ul>
          ) : <EmptyState message="No AI recommendations available for this asset." />}
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Maintenance History">
          {maintenanceRows.length ? (
            <MineCareTable
              data={maintenanceRows}
              getRowId={(item) => item.id}
              emptyMessage="No maintenance history records available."
              columns={[
                { header: 'Date', key: 'serviceDate', render: (item) => formatDate(String(item.serviceDate ?? '')) },
                { header: 'Type', key: 'serviceType', render: (item) => String(item.serviceType ?? '-') },
                { header: 'Action Taken', key: 'actionTaken', render: (item) => String(item.actionTaken ?? '-') },
                { header: 'Technician', key: 'technician', render: (item) => String(item.technician ?? '-') },
                { header: 'Cost', key: 'cost', render: (item) => formatCurrency(Number(item.cost ?? 0)) },
                { header: 'Downtime', key: 'downtimeHours', render: (item) => `${Number(item.downtimeHours ?? 0)} hrs` },
              ]}
            />
          ) : <EmptyState message="No maintenance history records available." />}
        </SurfacePanel>
        <SurfacePanel
          title="Breakdown History"
          actions={<Button label="Record Breakdown" icon={<Plus className="h-4 w-4" />} severity="secondary" outlined onClick={openBreakdownDialog} />}
        >
          {breakdownRows.length ? (
            <MineCareTable
              data={breakdownRows}
              getRowId={(item) => item.id}
              emptyMessage="No breakdown history records available."
              columns={[
                { header: 'Date', key: 'breakdownDate', render: (item) => formatDate(String(item.breakdownDate ?? '')) },
                { header: 'Failure', key: 'failureType', render: (item) => String(item.failureType ?? '-') },
                { header: 'Root Cause', key: 'rootCause', render: (item) => String(item.rootCause ?? '-') },
                { header: 'Repair Cost', key: 'repairCost', render: (item) => formatCurrency(Number(item.repairCost ?? 0)) },
                { header: 'Downtime', key: 'downtimeHours', render: (item) => `${Number(item.downtimeHours ?? 0)} hrs` },
              ]}
            />
          ) : <EmptyState message="No breakdown history records available." />}
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Asset Lifecycle Timeline">
          <MineCareTable
            data={lifecycleRows}
            getRowId={(item) => item.id}
            emptyMessage="No lifecycle records found."
            columns={[
              { header: 'Stage', field: 'label' },
              { header: 'Date', field: 'date', render: (item) => formatDate(item.date) },
              { header: 'Detail', field: 'detail' },
            ]}
          />
          <div className="mt-4">
            <DetailGrid
              values={{
                'Current Age': lifecycleTracker.currentAge,
                'Expected Life': lifecycleTracker.expectedLife,
                'Replacement Year': lifecycleTracker.replacementYear,
              }}
            />
          </div>
        </SurfacePanel>
        <SurfacePanel title="Operator Observations">
          <ObservationTable observations={data.observations} />
        </SurfacePanel>
      </div>

      <SurfacePanel title="Asset Health Timeline" description="Chronological health story from purchase through services, observations, breakdowns, AI analyses, alerts, and current state.">
        {data.healthTimeline?.length ? (
          <ScrollRegion>
            <div className="space-y-3">
              {data.healthTimeline.map((item, index) => (
                <div key={`${item.title}-${item.date}-${index}`} className="grid gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 md:grid-cols-[140px_160px_1fr]">
                  <div className="text-sm font-semibold text-[var(--color-text-strong)]">{formatDate(item.date)}</div>
                  <div className="flex flex-wrap items-start gap-2">
                    <StatusBadge value={item.type} />
                    <StatusBadge value={item.severity} />
                  </div>
                  <div>
                    <p className="font-semibold text-[var(--color-text-strong)]">{item.title}</p>
                    <p className="mt-1 text-sm text-[var(--color-text)]">{item.description}</p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.source}</p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollRegion>
        ) : <EmptyState message="No asset health timeline records are available." />}
      </SurfacePanel>
      <Dialog
        header="Record Breakdown Repair"
        visible={breakdownDialogOpen}
        style={{ width: 'min(780px, 95vw)' }}
        modal
        className="crud-form-dialog"
        maskClassName="crud-form-dialog-mask"
        onHide={() => setBreakdownDialogOpen(false)}
        footer={<div className="flex justify-end gap-2"><Button label="Cancel" severity="secondary" outlined onClick={() => setBreakdownDialogOpen(false)} /><Button label="Save Breakdown" loading={isRecordingBreakdown} onClick={submitBreakdownRepair} /></div>}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">Equipment<InputText value={`${equipment.name} (${equipment.equipmentId})`} disabled className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Breakdown Date<InputText type="date" value={breakdownForm.breakdownDate} onChange={(event) => setBreakdownForm((current) => ({ ...current, breakdownDate: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Failure Type<InputText value={breakdownForm.failureType} onChange={(event) => setBreakdownForm((current) => ({ ...current, failureType: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Component<InputText value={breakdownForm.component} onChange={(event) => setBreakdownForm((current) => ({ ...current, component: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Running Hours<InputNumber value={breakdownForm.runningHours} min={0} onValueChange={(event) => setBreakdownForm((current) => ({ ...current, runningHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Repair Cost<InputNumber value={breakdownForm.repairCost} min={0} onValueChange={(event) => setBreakdownForm((current) => ({ ...current, repairCost: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Downtime Hours<InputNumber value={breakdownForm.downtimeHours} min={0} onValueChange={(event) => setBreakdownForm((current) => ({ ...current, downtimeHours: Number(event.value ?? 0) }))} className="w-full" inputClassName="w-full" /></label>
          <label className="space-y-1 text-sm font-medium">Technician<InputText value={breakdownForm.technician} onChange={(event) => setBreakdownForm((current) => ({ ...current, technician: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Root Cause<InputTextarea rows={3} value={breakdownForm.rootCause} onChange={(event) => setBreakdownForm((current) => ({ ...current, rootCause: event.target.value }))} className="w-full" /></label>
          <label className="space-y-1 text-sm font-medium md:col-span-2">Repair Action Taken<InputTextarea rows={3} value={breakdownForm.actionTaken} onChange={(event) => setBreakdownForm((current) => ({ ...current, actionTaken: event.target.value }))} className="w-full" /></label>
          <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={breakdownForm.warrantyClaimRaised} onChange={(event) => setBreakdownForm((current) => ({ ...current, warrantyClaimRaised: Boolean(event.checked) }))} /> Warranty claim raised</label>
          <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={breakdownForm.createMaintenanceRecord} onChange={(event) => setBreakdownForm((current) => ({ ...current, createMaintenanceRecord: Boolean(event.checked) }))} /> Create maintenance history record</label>
          <label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={breakdownForm.repaired} onChange={(event) => setBreakdownForm((current) => ({ ...current, repaired: Boolean(event.checked) }))} /> Equipment repaired</label>
        </div>
      </Dialog>
    </MineCarePage>
  )
}
