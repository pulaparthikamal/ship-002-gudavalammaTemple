import { Activity, Gauge, RadioTower } from 'lucide-react'
import { MineCarePage, SummaryCard, SurfacePanel, EmptyState } from './shared'

export function MineCareSensorMlPage() {
  return (
    <MineCarePage title="Sensor ML" description="Phase 2 placeholder for telemetry scoring and predictive alerts.">
      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard label="Connected Assets" value="0" icon={RadioTower} detail="Telemetry integration pending" />
        <SummaryCard label="Live Signals" value="0" icon={Activity} detail="No stream configured" />
        <SummaryCard label="Model Status" value="Planned" icon={Gauge} detail="Phase 2 UI shell" />
      </div>
      <SurfacePanel title="Telemetry readiness" description="This page reserves the route and app navigation for the Sensor ML workflow.">
        <EmptyState message="Sensor ingestion and ML scoring are not connected yet. Keep Phase 1 and current Phase 2 workflows demo-ready while telemetry integration is prepared." />
      </SurfacePanel>
    </MineCarePage>
  )
}
