import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetMineCareSparePartsQuery } from '@/services/api/endpoints/mineCareAiApi'
import { MineCarePage, SparePartTable, SurfacePanel } from './shared'

export function MineCareSparesPage() {
  const { data = [], isLoading } = useGetMineCareSparePartsQuery()

  if (isLoading) return <LoadingScreen message="Loading spare parts planner..." />

  return (
    <MineCarePage title="Spare Parts Planner" description="Forecast reorder requirements based on upcoming services and current stock.">
      <SurfacePanel title="Spare Part Forecast">
        <SparePartTable parts={data} />
      </SurfacePanel>
    </MineCarePage>
  )
}
