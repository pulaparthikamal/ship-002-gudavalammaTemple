import { Navigate, Route, Routes } from 'react-router-dom'
import { DevoteeLayout } from '@/layouts/DevoteeLayout'
import { DevoteeAccommodationPage } from '@/pages/devotee/DevoteeAccommodationPage'
import { DevoteeBookingsPage } from '@/pages/devotee/DevoteeBookingsPage'
import { DevoteeDarshanPage } from '@/pages/devotee/DevoteeDarshanPage'
import { DevoteeDonationPage } from '@/pages/devotee/DevoteeDonationPage'
import { DevoteeEventsPage } from '@/pages/devotee/DevoteeEventsPage'
import { DevoteeFacilitiesPage } from '@/pages/devotee/DevoteeFacilitiesPage'
import { DevoteeForgotPasswordPage } from '@/pages/devotee/DevoteeForgotPasswordPage'
import { DevoteeLivePage } from '@/pages/devotee/DevoteeLivePage'
import { DevoteeLoginPage } from '@/pages/devotee/DevoteeLoginPage'
import { DevoteeNearbyPlacesPage } from '@/pages/devotee/DevoteeNearbyPlacesPage'
import { DevoteePrasadamPage } from '@/pages/devotee/DevoteePrasadamPage'
import { DevoteeProfilePage } from '@/pages/devotee/DevoteeProfilePage'
import { DevoteeRegisterPage } from '@/pages/devotee/DevoteeRegisterPage'
import { DevoteeSevaPage } from '@/pages/devotee/DevoteeSevaPage'
import { DevoteeProtectedRoute } from './DevoteeProtectedRoute'
import { DevoteePublicOnlyRoute } from './DevoteePublicOnlyRoute'

export function DevoteeRoutes() {
  return (
    <Routes>
      {/* One shared DevoteeLayout for every devotee-side route, including
          auth pages — so login/register/forgot-password get the real
          dp-header/dp-footer (with nav to every other page) instead of
          rendering standalone with no way out. DevoteeLayout's header
          already handles the unauthenticated case correctly (it's the same
          header shown to guests everywhere else). */}
      <Route element={<DevoteeLayout />}>
        <Route element={<DevoteePublicOnlyRoute />}>
          <Route path="login" element={<DevoteeLoginPage />} />
          <Route path="register" element={<DevoteeRegisterPage />} />
          <Route path="forgot-password" element={<DevoteeForgotPasswordPage />} />
        </Route>

        <Route index element={<Navigate to="/" replace />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />

        {/* Guest checkout: these pages work without a session — booking forms
            collect name/email/phone inline when the visitor isn't logged in. */}
        <Route path="darshan" element={<DevoteeDarshanPage />} />
        <Route path="seva" element={<DevoteeSevaPage />} />
        <Route path="accommodation" element={<DevoteeAccommodationPage />} />
        <Route path="donations" element={<DevoteeDonationPage />} />
        <Route path="prasadam" element={<DevoteePrasadamPage />} />
        <Route path="live" element={<DevoteeLivePage />} />
        <Route path="facilities" element={<DevoteeFacilitiesPage />} />
        <Route path="events" element={<DevoteeEventsPage />} />
        <Route path="nearby-places" element={<DevoteeNearbyPlacesPage />} />

        {/* These inherently require a real account — no persistent guest identity. */}
        <Route element={<DevoteeProtectedRoute />}>
          <Route path="bookings" element={<DevoteeBookingsPage />} />
          <Route path="profile" element={<DevoteeProfilePage />} />
        </Route>
      </Route>
    </Routes>
  )
}
