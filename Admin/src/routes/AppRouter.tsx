import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { ServerDashboardPage } from '@/pages/ServerDashboardPage'
import { ConfigurationPage } from '@/pages/ConfigurationPage'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LoginPage } from '@/pages/LoginPage'
import { LogsPage } from '@/pages/LogsPage'
import { CleanupTimelinePage } from '@/pages/CleanupTimelinePage'
import { FileScannerPage } from '@/pages/FileScannerPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { RcmRoutes } from './RcmRoutes'
import { MineCareAiRoutes } from './MineCareAiRoutes'
import { ProfilePage } from '@/pages/ProfilePage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ServerReportsPage } from '@/pages/ServerReportsPage'
import { ServerActivityPage } from '@/pages/ServerActivityPage'
import { ServerMetricsPage } from '@/pages/ServerMetricsPage'
import { RemediationPage } from '@/pages/RemediationPage'
import { RolesPage } from '@/pages/RolesPage'
import { ServerConnectionPage } from '@/pages/ServerConnectionPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { SocialMediaRoutes } from './SocialMediaRoutes'
import { UsersPage } from '@/pages/UsersPage'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { DashboardMain } from '@/pages/DashboardMain'
import { SocialApprovalPage } from '@/pages/SocialApprovalPage'
import { DeploymentAgentRoutes } from './DeploymentAgentRoutes'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/social/approval/:token" element={<SocialApprovalPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardMain />} />
          <Route path="/rcm/*" element={<RcmRoutes />} />
          <Route path="/minecare-ai/*" element={<MineCareAiRoutes />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/socialMedia/*" element={<SocialMediaRoutes />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />

          {/* deployment */}
          <Route path="/deployment/*" element={<DeploymentAgentRoutes />} />

          {/* server */}
          <Route path="/serverAgent">
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<ServerDashboardPage />} />
            <Route path="servers" element={<ServerConnectionPage />} />
            <Route path="metrics" element={<ServerMetricsPage />} />
            <Route path="activities" element={<ServerActivityPage />} />
            <Route path="configuration" element={<ConfigurationPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route path="disk-cleanup" element={<CleanupTimelinePage />} />
            <Route path="cleanup-timeline" element={<CleanupTimelinePage />} />
            <Route path="file-scanner" element={<FileScannerPage />} />
            <Route path="reports" element={<ServerReportsPage />} />
            <Route path="remediation" element={<RemediationPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
