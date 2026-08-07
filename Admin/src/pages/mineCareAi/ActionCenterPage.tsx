import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetMineCareActionCenterQuery, useUpdateMineCareActionStatusMutation } from '@/services/api/endpoints/mineCareAiApi'
import { ActionTable, MineCarePage, SurfacePanel } from './shared'

export function MineCareActionCenterPage() {
  const { data = [], isLoading } = useGetMineCareActionCenterQuery()
  const [updateStatus] = useUpdateMineCareActionStatusMutation()

  if (isLoading) return <LoadingScreen message="Loading action center..." />

  return (
    <MineCarePage title="Action Center" description="Prioritized actions generated from service, warranty, risk, and spare-part signals.">
      <SurfacePanel title="Recommended Actions">
        <ActionTable
          actions={data}
          tableHeightClassName="max-h-[calc(100vh-18rem)]"
          onStatusChange={(item, status) => {
            if (item.id) void updateStatus({ id: item.id, status })
          }}
        />
      </SurfacePanel>
    </MineCarePage>
  )
}
