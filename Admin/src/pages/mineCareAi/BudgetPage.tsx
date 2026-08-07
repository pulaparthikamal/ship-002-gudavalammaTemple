import { Activity, AlertTriangle, DollarSign, ShieldCheck, Wrench } from 'lucide-react'
import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetMineCareBudgetForecastQuery } from '@/services/api/endpoints/mineCareAiApi'
import { DetailGrid, MineCarePage, SummaryCard, SurfacePanel, formatCurrency } from './shared'

export function MineCareBudgetPage() {
  const { data, isLoading } = useGetMineCareBudgetForecastQuery()

  if (isLoading || !data) return <LoadingScreen message="Loading budget forecast..." />

  return (
    <MineCarePage title="Budget Forecast" description="Estimate maintenance budget, risk buffer, exposure, and savings for the current month.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Maintenance Budget" value={formatCurrency(data.monthlyMaintenanceBudget)} icon={DollarSign} />
        <SummaryCard label="Service Cost" value={formatCurrency(data.serviceCost)} icon={Wrench} />
        <SummaryCard label="Risk Buffer" value={formatCurrency(data.riskBuffer)} icon={AlertTriangle} />
        <SummaryCard label="Cost Exposure" value={formatCurrency(data.costExposure)} icon={Activity} />
        <SummaryCard label="Potential Savings" value={formatCurrency(data.potentialSavings)} icon={ShieldCheck} />
      </div>
      <SurfacePanel title="Forecast Breakdown">
        <DetailGrid
          values={{
            Month: data.month,
            'Monthly Maintenance Budget': formatCurrency(data.monthlyMaintenanceBudget),
            'Planned Service Cost': formatCurrency(data.serviceCost),
            'Risk Buffer': formatCurrency(data.riskBuffer),
            'Cost Exposure': formatCurrency(data.costExposure),
            'Potential Warranty Savings': formatCurrency(data.potentialSavings),
            'Upcoming Service Count': data.upcomingServiceCount,
          }}
        />
      </SurfacePanel>
      {data.aiNarrative ? (
        <SurfacePanel title="AI Budget Explanation" description={data.aiNarrative}>
          <div className="grid gap-4 xl:grid-cols-2">
            <div>
              <h3 className="font-semibold text-[var(--color-text-strong)]">Cost drivers</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
                {(data.costDrivers ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-[var(--color-text-strong)]">Recommended actions</h3>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--color-text)]">
                {(data.recommendedActions ?? []).map((item) => <li key={item}>{item}</li>)}
              </ul>
            </div>
          </div>
        </SurfacePanel>
      ) : null}
    </MineCarePage>
  )
}
