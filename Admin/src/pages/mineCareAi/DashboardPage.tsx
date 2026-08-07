import { Activity, AlertTriangle, BrainCircuit, CalendarDays, ClipboardList, DollarSign, Gauge, ShieldCheck, TrendingUp, Wrench } from 'lucide-react'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetMineCareDashboardSummaryQuery } from '@/services/api/endpoints/mineCareAiApi'
import { AlertTable, MineCarePage, RiskTable, ScrollRegion, ServiceTable, SummaryCard, SurfacePanel, formatCurrency } from './shared'

export function MineCareAiDashboardPage() {
  const { data, isLoading } = useGetMineCareDashboardSummaryQuery()

  if (isLoading || !data) return <LoadingScreen message="Loading MineCare AI dashboard..." />

  return (
    <MineCarePage
        title="Fleet Health Command Center"
        description="Executive maintenance intelligence across fleet health, risk, savings, service, warranty, spares, and AI recommendations."
    >
      {data.aiExecutiveSummary ? (
        <SurfacePanel title="AI Executive Summary" description="MineCare AI decision brief for the current fleet state.">
          <p className="text-sm font-medium text-[var(--color-text-strong)]">{data.aiExecutiveSummary}</p>
          {data.aiDecisionBrief?.length ? (
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
              {data.aiDecisionBrief.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : null}
        </SurfacePanel>
      ) : null}

      {data.commandCenter ? (
        <SurfacePanel title="Command center" description="MineCare AI fleet-level signal for the current maintenance window.">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <SummaryCard compact label="Fleet Health" value={`${data.commandCenter.fleetHealthPercent}%`} icon={Gauge} />
            <SummaryCard compact label="Healthy Assets" value={data.commandCenter.healthyAssets} icon={Activity} />
            <SummaryCard compact label="Warning Assets" value={data.commandCenter.warningAssets} icon={AlertTriangle} />
            <SummaryCard compact label="Critical Assets" value={data.commandCenter.criticalAssets} icon={Wrench} />
            <SummaryCard compact label="Service Due This Week" value={data.commandCenter.serviceDueThisWeek} icon={CalendarDays} />
            <SummaryCard compact label="Warranty Recovery" value={formatCurrency(data.commandCenter.warrantyRecoveryOpportunity)} icon={ShieldCheck} />
            <SummaryCard compact label="Downtime Avoided" value={formatCurrency(data.commandCenter.estimatedDowntimeAvoided)} icon={TrendingUp} />
            <SummaryCard compact label="AI Estimated Savings" value={formatCurrency(data.commandCenter.aiEstimatedSavings)} icon={BrainCircuit} />
          </div>
        </SurfacePanel>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard compact label="Total Equipment" value={data.cards.totalEquipment} icon={Activity} />
        <SummaryCard compact label="Critical Assets" value={data.cards.criticalAssets} icon={AlertTriangle} />
        <SummaryCard compact label="Service Due This Week" value={data.cards.serviceDueThisWeek} icon={CalendarDays} />
        <SummaryCard compact label="Warranty Expiring Soon" value={data.cards.warrantyExpiringSoon} icon={ShieldCheck} />
        <SummaryCard compact label="Spare Shortages" value={data.cards.sparePartShortages} icon={Wrench} />
        <SummaryCard compact label="Cost Exposure" value={formatCurrency(data.cards.estimatedCostExposure)} icon={DollarSign} />
        <SummaryCard compact label="Potential Savings" value={formatCurrency(data.cards.potentialSavings)} icon={ClipboardList} />
        <SummaryCard compact label="Total AI Savings" value={formatCurrency(data.savings?.totalEstimatedSavings ?? data.cards.potentialSavings)} icon={BrainCircuit} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Health Score Distribution">
          <div className="grid gap-3 sm:grid-cols-4">
            <SummaryCard compact label="Good" value={data.healthScoreDistribution.good} icon={Activity} />
            <SummaryCard compact label="Medium" value={data.healthScoreDistribution.medium} icon={ShieldCheck} />
            <SummaryCard compact label="High Risk" value={data.healthScoreDistribution.highRisk} icon={AlertTriangle} />
            <SummaryCard compact label="Critical" value={data.healthScoreDistribution.critical} icon={Wrench} />
          </div>
        </SurfacePanel>

        <SurfacePanel title="Fleet Risk Distribution">
          <div className="space-y-3">
            {[
              { label: 'Healthy', value: data.healthScoreDistribution.good, color: 'bg-emerald-500' },
              { label: 'Warning', value: data.healthScoreDistribution.medium + data.healthScoreDistribution.highRisk, color: 'bg-amber-500' },
              { label: 'Critical', value: data.healthScoreDistribution.critical, color: 'bg-red-500' },
            ].map((item) => {
              const total = Math.max(1, data.cards.totalEquipment)
              return (
                <div key={item.label}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-[var(--color-text-strong)]">{item.label}</span>
                    <span className="text-[var(--color-text-muted)]">{item.value} asset(s)</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--color-surface-muted)]">
                    <div className={`h-2 rounded-full ${item.color}`} style={{ width: `${Math.round((item.value / total) * 100)}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="AI Cost Savings">
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryCard compact label="Warranty Recovery" value={formatCurrency(data.savings?.warrantyRecoveryOpportunity)} icon={ShieldCheck} />
            <SummaryCard compact label="Downtime Avoided" value={formatCurrency(data.savings?.estimatedDowntimeAvoided)} icon={TrendingUp} />
            <SummaryCard compact label="Preventive Savings" value={formatCurrency(data.savings?.preventiveMaintenanceSavings)} icon={Wrench} />
            <SummaryCard compact label="Spare Optimization" value={formatCurrency(data.savings?.sparePartsOptimizationSavings)} icon={ClipboardList} />
          </div>
        </SurfacePanel>

        <SurfacePanel title="Top AI Recommendations">
          {data.topRecommendations?.length ? (
            <ScrollRegion>
              <div className="space-y-3">
                {data.topRecommendations.map((item) => (
                  <div key={item.recommendationId} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-semibold text-[var(--color-text-strong)]">{item.title}</p>
                      <span className="text-sm font-semibold text-[var(--color-primary)]">{formatCurrency(item.estimatedSavings)}</span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{item.reason}</p>
                  </div>
                ))}
              </div>
            </ScrollRegion>
          ) : <p className="text-sm text-[var(--color-text-muted)]">No AI recommendations available.</p>}
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Top Risk Assets">
          <RiskTable risks={data.topRiskAssets} />
        </SurfacePanel>
        <SurfacePanel title="Upcoming Services">
          <ServiceTable services={data.upcomingServices} />
        </SurfacePanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SurfacePanel title="Warranty Alerts">
          <AlertTable alerts={data.warrantyAlerts} />
        </SurfacePanel>
      </div>
    </MineCarePage>
  )
}
