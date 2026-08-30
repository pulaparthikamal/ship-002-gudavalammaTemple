import { Navigate, Outlet } from 'react-router-dom'
import { selectAuthAudience, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'

/**
 * The site root ("/") is a public/adaptive home page: anonymous visitors and
 * logged-in devotees both render it (via DevoteeLayout + DevoteeDashboardPage);
 * a logged-in staff member is redirected to their own dashboard instead.
 */
export function HomeGate() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const audience = useAppSelector(selectAuthAudience)

  if (isAuthenticated && audience === 'staff') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
