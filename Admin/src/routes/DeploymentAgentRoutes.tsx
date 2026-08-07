import { Navigate, Route, Routes } from 'react-router-dom'
import { DeploymentDashboardPage } from '@/pages/deployment/DeploymentDashboardPage'
import { CredentialsPage } from '@/pages/deployment/CredentialsPage'
import { DeploymentTargetsPage } from '@/pages/deployment/DeploymentTargetsPage'
import { ApplicationsPage } from '@/pages/deployment/ApplicationsPage'
import { DeploymentsPage } from '@/pages/deployment/DeploymentsPage'
import { DeploymentReportsPage } from '@/pages/deployment/DeploymentReportsPage'
import { DeploymentVersionHistoryPage } from '@/pages/deployment/DeploymentVersionHistoryPage'
import { PredictionHistoryPage } from '@/pages/deployment/PredictionHistoryPage'
import { NotificationsLogsPage } from '@/pages/deployment/NotificationsLogsPage'

export function DeploymentAgentRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DeploymentDashboardPage />} />
      <Route path="credentials" element={<CredentialsPage />} />
      <Route path="targets" element={<DeploymentTargetsPage />} />
      <Route path="applications" element={<ApplicationsPage />} />
      <Route path="deployments" element={<DeploymentsPage />} />
      <Route path="predictions" element={<PredictionHistoryPage />} />
      <Route path="version-history" element={<DeploymentVersionHistoryPage />} />
      <Route path="reports" element={<DeploymentReportsPage />} />
      <Route path="notifications" element={<NotificationsLogsPage />} />
    </Routes>
  )
}
