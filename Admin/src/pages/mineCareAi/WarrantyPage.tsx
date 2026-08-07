import { LoadingScreen } from '@/components/ui/LoadingScreen'
import {
  useGetMineCareWarrantyAlertsQuery,
  useGetMineCareWarrantyClaimsQuery,
  useUpdateMineCareWarrantyClaimStatusMutation,
} from '@/services/api/endpoints/mineCareAiApi'
import { MineCarePage, SurfacePanel, WarrantyClaimTable, WarrantyTable } from './shared'

export function MineCareWarrantyPage() {
  const { data: alerts = [], isLoading: alertsLoading } = useGetMineCareWarrantyAlertsQuery()
  const { data: claims = [], isLoading: claimsLoading } = useGetMineCareWarrantyClaimsQuery()
  const [updateClaimStatus] = useUpdateMineCareWarrantyClaimStatusMutation()

  if (alertsLoading || claimsLoading) return <LoadingScreen message="Loading warranty tracker..." />

  const active = alerts.filter((warranty) => warranty.status === 'Active')
  const expiringSoon = alerts.filter((warranty) => warranty.status === 'Expiring Soon')
  const expired = alerts.filter((warranty) => warranty.status === 'Expired')

  return (
    <MineCarePage title="Warranty Tracker" description="Monitor warranty expiry, hour limits, and recoverable breakdown claims.">
      <div className="space-y-4">
        <SurfacePanel title="Active Warranties">
          <WarrantyTable warranties={active} tableHeightClassName="max-h-[24rem]" />
        </SurfacePanel>
        <SurfacePanel title="Expiring Soon">
          <WarrantyTable warranties={expiringSoon} tableHeightClassName="max-h-[24rem]" />
        </SurfacePanel>
        <SurfacePanel title="Expired Warranties">
          <WarrantyTable warranties={expired} tableHeightClassName="max-h-[24rem]" />
        </SurfacePanel>
        <SurfacePanel title="Claim Opportunities">
          <WarrantyClaimTable
            claims={claims}
            tableHeightClassName="max-h-[24rem]"
            onStatusChange={(item, status) => {
              if (item.id) void updateClaimStatus({ id: item.id, status })
            }}
          />
        </SurfacePanel>
      </div>
    </MineCarePage>
  )
}
