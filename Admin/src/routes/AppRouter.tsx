import { Route, Routes } from 'react-router-dom'
import { AppLayout } from '@/layouts/AppLayout'
import { DevoteeLayout } from '@/layouts/DevoteeLayout'
import { ForbiddenPage } from '@/pages/ForbiddenPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { DevoteeRoutes } from './DevoteeRoutes'
import { DevoteeDashboardPage } from '@/pages/devotee/DevoteeDashboardPage'
import { HomeGate } from './HomeGate'
import { ProfilePage } from '@/pages/ProfilePage'
import { RolesPage } from '@/pages/RolesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { UsersPage } from '@/pages/UsersPage'
import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'
import { DashboardMain } from '@/pages/DashboardMain'
import { DonorsPage } from '@/pages/DonorsPage'
import { PropertiesPage } from '@/pages/PropertiesPage'
import { AssetsPage } from '@/pages/AssetsPage'
import { LiabilitiesPage } from '@/pages/LiabilitiesPage'
import { ExpenseTrackerPage } from '@/pages/ExpenseTrackerPage'
import { SevaCatalogPage } from '@/pages/SevaCatalogPage'
import { DarshanQuotaPage } from '@/pages/DarshanQuotaPage'
import { AccommodationRoomTypePage } from '@/pages/AccommodationRoomTypePage'
import { PrasadamItemPage } from '@/pages/PrasadamItemPage'
import { DonationFundPage } from '@/pages/DonationFundPage'
import { FacilityPage } from '@/pages/FacilityPage'
import { AnnouncementsPage } from '@/pages/AnnouncementsPage'
import { TempleProfilePage } from '@/pages/TempleProfilePage'
import { LanguagesPage } from '@/pages/LanguagesPage'
import { ScreenBuilderPage } from '@/pages/ScreenBuilderPage'
import { EventsPage } from '@/pages/EventsPage'
import { DonationsPage } from '@/pages/DonationsPage'
import { BookingsPage } from '@/pages/BookingsPage'
import { NearbyPlacesPage } from '@/pages/NearbyPlacesPage'
import { ReconfigureTemplePage } from '@/pages/ReconfigureTemplePage'
import { AnalyticsPage } from '@/pages/AnalyticsPage'
import { NavTabsPage } from '@/pages/NavTabsPage'

export function AppRouter() {
  return (
    <Routes>
      <Route element={<HomeGate />}>
        <Route element={<DevoteeLayout />}>
          <Route path="/" element={<DevoteeDashboardPage />} />
        </Route>
      </Route>

      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      </Route>

      <Route path="/devotee/*" element={<DevoteeRoutes />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/dashboard" element={<DashboardMain />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/donors" element={<DonorsPage />} />
          <Route path="/properties" element={<PropertiesPage />} />
          <Route path="/assets" element={<AssetsPage />} />
          <Route path="/liabilities" element={<LiabilitiesPage />} />
          <Route path="/expense-tracker" element={<ExpenseTrackerPage />} />
          <Route path="/seva-catalog" element={<SevaCatalogPage />} />
          <Route path="/darshan-quotas" element={<DarshanQuotaPage />} />
          <Route path="/accommodation-room-types" element={<AccommodationRoomTypePage />} />
          <Route path="/prasadam-items" element={<PrasadamItemPage />} />
          <Route path="/donation-funds" element={<DonationFundPage />} />
          <Route path="/facilities-admin" element={<FacilityPage />} />
          <Route path="/announcements" element={<AnnouncementsPage />} />
          <Route path="/temple-profile" element={<TempleProfilePage />} />
          <Route path="/languages" element={<LanguagesPage />} />
          <Route path="/screen-builder" element={<ScreenBuilderPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/staff-donations" element={<DonationsPage />} />
          <Route path="/staff-bookings" element={<BookingsPage />} />
          <Route path="/nearby-places" element={<NearbyPlacesPage />} />
          <Route path="/reconfigure-temple" element={<ReconfigureTemplePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/nav-tabs" element={<NavTabsPage />} />
          <Route path="/forbidden" element={<ForbiddenPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
