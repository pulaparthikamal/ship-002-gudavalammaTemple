import { Navigate, Route, Routes } from 'react-router-dom'
import {
  MineCareActionCenterPage,
  MineCareAiDashboardPage,
  MineCareAlertsPage,
  MineCareAssetPassportPage,
  MineCareBudgetPage,
  MineCareChecklistsPage,
  MineCareCopilotPage,
  MineCareDowntimeSimulatorPage,
  MineCareEquipmentOnboardingPage,
  MineCareEquipmentRegistryPage,
  MineCareKnowledgeAssistantPage,
  MineCareOperatorObservationsPage,
  MineCareProcurementAdvisorPage,
  MineCareRecommendationsPage,
  MineCareReportsPage,
  MineCareRepairReplacePage,
  MineCareRiskRankingPage,
  MineCareRootCausePage,
  MineCareSensorMlPage,
  MineCareServiceCalendarPage,
  MineCareSparesPage,
  MineCareVendorSlaPage,
  MineCareWarrantyPage,
  MineCareWorkforcePage,
} from '@/pages/mineCareAi'

export function MineCareAiRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<MineCareAiDashboardPage />} />
      <Route path="recommendations" element={<MineCareRecommendationsPage />} />
      <Route path="equipment" element={<MineCareEquipmentRegistryPage />} />
      <Route path="equipment/new" element={<MineCareEquipmentOnboardingPage />} />
      <Route path="equipment/:id" element={<MineCareAssetPassportPage />} />
      <Route path="service-calendar" element={<MineCareServiceCalendarPage />} />
      <Route path="risk-ranking" element={<MineCareRiskRankingPage />} />
      <Route path="warranty" element={<MineCareWarrantyPage />} />
      <Route path="operator-observations" element={<MineCareOperatorObservationsPage />} />
      <Route path="alerts" element={<MineCareAlertsPage />} />
      <Route path="spares" element={<MineCareSparesPage />} />
      <Route path="budget" element={<MineCareBudgetPage />} />
      <Route path="action-center" element={<MineCareActionCenterPage />} />
      <Route path="copilot" element={<MineCareCopilotPage />} />
      <Route path="reports" element={<MineCareReportsPage />} />
      <Route path="root-cause" element={<MineCareRootCausePage />} />
      <Route path="checklists" element={<MineCareChecklistsPage />} />
      <Route path="knowledge-assistant" element={<MineCareKnowledgeAssistantPage />} />
      <Route path="vendor-sla" element={<MineCareVendorSlaPage />} />
      <Route path="repair-replace" element={<MineCareRepairReplacePage />} />
      <Route path="downtime-simulator" element={<MineCareDowntimeSimulatorPage />} />
      <Route path="workforce" element={<MineCareWorkforcePage />} />
      <Route path="procurement-advisor" element={<MineCareProcurementAdvisorPage />} />
      <Route path="sensor-ml" element={<MineCareSensorMlPage />} />
    </Routes>
  )
}
