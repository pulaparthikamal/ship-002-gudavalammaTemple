import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetMineCareRiskRankingQuery } from '@/services/api/endpoints/mineCareAiApi'
import { MineCarePage, RiskTable, SurfacePanel } from './shared'

export function MineCareRiskRankingPage() {
  const { data = [], isLoading } = useGetMineCareRiskRankingQuery()

  if (isLoading) return <LoadingScreen message="Loading risk ranking..." />

  return (
    <MineCarePage title="Risk Ranking" description="Rank equipment by health score, breakdown probability, criticality, and service urgency.">
      <SurfacePanel title="Ranked Assets">
        <RiskTable risks={data} />
      </SurfacePanel>
    </MineCarePage>
  )
}
