import { LoadingScreen } from '@/components/ui/LoadingScreen'
import { useGetMineCareAlertsQuery, useUpdateMineCareAlertStatusMutation } from '@/services/api/endpoints/mineCareAiApi'
import { AlertTable, MineCarePage, SurfacePanel } from './shared'

export function MineCareAlertsPage() {
  const { data = [], isLoading } = useGetMineCareAlertsQuery()
  const [updateStatus] = useUpdateMineCareAlertStatusMutation()

  if (isLoading) return <LoadingScreen message="Loading alerts..." />

  return (
    <MineCarePage title="Alerts" description="Consolidated service, warranty, risk, and spare-part alerts.">
      <SurfacePanel title="Active Alerts">
        <AlertTable
          alerts={data}
          tableHeightClassName="max-h-[calc(100vh-18rem)]"
          onStatusChange={(item, status) => {
            if (item.id) void updateStatus({ id: item.id, status })
          }}
        />
      </SurfacePanel>
    </MineCarePage>
  )
}
