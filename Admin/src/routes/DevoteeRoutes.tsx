import { Navigate, Route, Routes } from 'react-router-dom'
import { DevoteeLayout } from '@/layouts/DevoteeLayout'
import { DevoteeLanguageProvider } from '@/features/devotee/i18n/DevoteeLanguageContext'
import { DevoteeAccommodationPage } from '@/pages/devotee/DevoteeAccommodationPage'
import { DevoteeBookingsPage } from '@/pages/devotee/DevoteeBookingsPage'
import { DevoteeDarshanPage } from '@/pages/devotee/DevoteeDarshanPage'
import { DevoteeDashboardPage } from '@/pages/devotee/DevoteeDashboardPage'
import { DevoteeDonationPage } from '@/pages/devotee/DevoteeDonationPage'
import { DevoteeFacilitiesPage } from '@/pages/devotee/DevoteeFacilitiesPage'
import { DevoteeForgotPasswordPage } from '@/pages/devotee/DevoteeForgotPasswordPage'
import { DevoteeLivePage } from '@/pages/devotee/DevoteeLivePage'
import { DevoteeLoginPage } from '@/pages/devotee/DevoteeLoginPage'
import { DevoteePrasadamPage } from '@/pages/devotee/DevoteePrasadamPage'
import { DevoteeProfilePage } from '@/pages/devotee/DevoteeProfilePage'
import { DevoteeRegisterPage } from '@/pages/devotee/DevoteeRegisterPage'
import { DevoteeSevaPage } from '@/pages/devotee/DevoteeSevaPage'
import { DevoteeProtectedRoute } from './DevoteeProtectedRoute'
import { DevoteePublicOnlyRoute } from './DevoteePublicOnlyRoute'

export function DevoteeRoutes() {
  return (
    <DevoteeLanguageProvider>
      <Routes>
        <Route element={<DevoteePublicOnlyRoute />}>
          <Route path="login" element={<DevoteeLoginPage />} />
          <Route path="register" element={<DevoteeRegisterPage />} />
          <Route path="forgot-password" element={<DevoteeForgotPasswordPage />} />
        </Route>

        <Route element={<DevoteeProtectedRoute />}>
          <Route element={<DevoteeLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<DevoteeDashboardPage />} />
            <Route path="darshan" element={<DevoteeDarshanPage />} />
            <Route path="seva" element={<DevoteeSevaPage />} />
            <Route path="accommodation" element={<DevoteeAccommodationPage />} />
            <Route path="donations" element={<DevoteeDonationPage />} />
            <Route path="prasadam" element={<DevoteePrasadamPage />} />
            <Route path="live" element={<DevoteeLivePage />} />
            <Route path="bookings" element={<DevoteeBookingsPage />} />
            <Route path="facilities" element={<DevoteeFacilitiesPage />} />
            <Route path="profile" element={<DevoteeProfilePage />} />
          </Route>
        </Route>
      </Routes>
    </DevoteeLanguageProvider>
  )
}
