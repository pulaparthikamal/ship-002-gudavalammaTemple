import { useEffect } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { ProgressSpinner } from 'primereact/progressspinner'
import { Message } from 'primereact/message'
import { Badge } from 'primereact/badge'
import { usePredictForEncounterMutation } from '@/services/api/endpoints/claimPredictionsApi'
import { useUpdateEncounterMutation } from '@/services/api/endpoints/encountersApi'
import { getApiErrorMessage } from '@/services/api/apiError'
import type { Encounter } from '@/types/encounter'
import { Brain, DollarSign, ShieldCheck, TrendingUp, Check, Info } from 'lucide-react'

interface EncounterCostEstimationDialogProps {
  visible: boolean
  onHide: () => void
  encounter: Encounter
}

export function EncounterCostEstimationDialog({ visible, onHide, encounter }: EncounterCostEstimationDialogProps) {
  const [estimate, { data: predictions, isLoading, error }] = usePredictForEncounterMutation()
  const [updateEncounter, { isLoading: isUpdating }] = useUpdateEncounterMutation()

  useEffect(() => {
    if (visible && encounter._id) {
      estimate(encounter._id)
    }
  }, [visible, encounter._id, estimate])

  const handleApply = async () => {
    if (!predictions || predictions.length === 0) return

    const totalPatientResp = predictions.reduce((sum, p) => sum + (p.predictedPatientResponsibility || 0), 0)
    const totalInsurancePaid = predictions.reduce((sum, p) => sum + (p.predictedPaid || 0), 0)
    const totalAllowed = predictions.reduce((sum, p) => sum + (p.predictedAllowed || 0), 0)

    try {
      await updateEncounter({
        id: encounter._id,
        data: {
          estimate: {
            ...encounter.estimate,
            estimatedPatientResponsibility: totalPatientResp,
            estimatedInsurancePayment: totalInsurancePaid,
            estimatedAllowedAmount: totalAllowed,
            lastEstimatedAt: new Date(),
          },
          active: encounter.active,
        },
      }).unwrap()
      onHide()
    } catch (err) {
      console.error('Failed to update encounter estimate:', err)
    }
  }

  const totalAllowed = predictions?.reduce((sum, p) => sum + p.predictedAllowed, 0) || 0
  const totalPaid = predictions?.reduce((sum, p) => sum + p.predictedPaid, 0) || 0
  const totalPatientResp = predictions?.reduce((sum, p) => sum + (p.predictedPatientResponsibility || 0), 0) || 0
  const avgConfidence = predictions?.length 
    ? (predictions.reduce((sum, p) => sum + p.confidenceScore, 0) / predictions.length) 
    : 0

  const getRiskColor = (level?: string) => {
    switch (level) {
      case 'Low': return 'success'
      case 'Medium': return 'warning'
      case 'High':
      case 'Critical': return 'danger'
      default: return 'info'
    }
  }

  return (
    <Dialog
      visible={visible}
      onHide={onHide}
      header={
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-[var(--color-primary)]" />
          <span>Real-Time Cost Estimation (Encounter)</span>
        </div>
      }
      className="crud-view-dialog max-w-2xl w-full"
      maskClassName="crud-form-dialog-mask"
      modal
      draggable={false}
      resizable={false}
      footer={
        <div className="flex justify-end gap-2 p-2">
          <Button label="Cancel" text onClick={onHide} disabled={isLoading || isUpdating} />
          <Button 
            label="Apply to Encounter" 
            icon={<Check className="h-4 w-4 mr-2" />} 
            onClick={handleApply} 
            loading={isUpdating} 
            disabled={isLoading || !predictions?.length} 
          />
        </div>
      }
    >
      <div className="space-y-4">
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <ProgressSpinner style={{ width: '50px', height: '50px' }} strokeWidth="8" fill="var(--surface-ground)" animationDuration=".5s" />
            <p className="text-sm font-medium text-[var(--color-text-muted)] animate-pulse">Resolving contract rates, eligibility benefits, and claim risk...</p>
          </div>
        )}

        {error && (
          <Message severity="error" text={getApiErrorMessage(error)} className="w-full" />
        )}

        {!isLoading && predictions && predictions.length > 0 && (
          <div className="space-y-6">
            <section className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[var(--color-text-muted)] mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Estimated Allowed</span>
                </div>
                <div className="text-xl font-bold text-[var(--color-text-strong)]">${totalAllowed.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[var(--color-text-muted)] mb-1">
                  <ShieldCheck className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Insurance Paid</span>
                </div>
                <div className="text-xl font-bold text-[var(--color-text-strong)]">${totalPaid.toFixed(2)}</div>
              </div>
              <div className="rounded-lg border border-[var(--color-primary)]/30 bg-[var(--color-primary-soft)] p-4 shadow-sm">
                <div className="flex items-center gap-2 text-[var(--color-primary)] mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase">Patient Resp.</span>
                </div>
                <div className="text-xl font-bold text-[var(--color-primary)]">${totalPatientResp.toFixed(2)}</div>
              </div>
            </section>

            <div className="overflow-hidden rounded-lg border border-[var(--color-border)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2">
                <h4 className="text-xs font-bold uppercase text-[var(--color-text-muted)]">Encounter Procedures</h4>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-[var(--color-text-muted)]">Estimate Confidence:</span>
                  <Badge value={`${(avgConfidence * 100).toFixed(0)}%`} severity={avgConfidence > 0.7 ? 'success' : 'warning'} />
                </div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {predictions.map((p) => (
                  <div key={p.cptCode} className="flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[var(--color-hover)]">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[var(--color-text-strong)]">{p.cptCode}</span>
                        <Badge value={p.riskLevel} severity={getRiskColor(p.riskLevel)} className="text-[10px]" />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] uppercase text-[var(--color-text-muted)]">
                        <span>{p.feeScheduleMatchLevel ? `Fee schedule: ${p.feeScheduleMatchLevel}` : 'Fee schedule fallback'}</span>
                        {p.pricingState ? <span>State {p.pricingState}</span> : null}
                        {p.placeOfServiceCode ? <span>POS {p.placeOfServiceCode}</span> : null}
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1">{p.explanation?.split('.')[0]}.</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-sm font-bold text-[var(--color-text-strong)]">${p.predictedPatientResponsibility?.toFixed(2)}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] uppercase">Patient Responsibility</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <article className="rounded-lg border border-[var(--color-warning-text)]/30 bg-[var(--color-warning-soft)] p-4">
              <div className="flex gap-3">
                <Info className="h-5 w-5 text-[var(--color-warning-text)] shrink-0 mt-0.5" />
                <div className="text-xs text-[var(--color-warning-text)] leading-relaxed">
                  <strong>Notice:</strong> These estimates use the matched payer fee schedule, current eligibility benefit data, and historical fallback only when real-time contract or benefit data is missing. Actual amounts may vary after final payer adjudication.
                </div>
              </div>
            </article>
          </div>
        )}

        {!isLoading && predictions && predictions.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[var(--color-text-muted)]">No predictions could be generated for the current encounter codes.</p>
          </div>
        )}
      </div>
    </Dialog>
  )
}
