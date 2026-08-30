import { Navigate, Outlet } from 'react-router-dom'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'
import { useGetEnabledNavTabsQuery } from '@/services/api/endpoints/navTabsApi'
import type { NavTabKey } from '@/services/api/endpoints/navTabsApi'

/**
 * Blocks direct-URL access to a devotee nav tab a staff admin has disabled
 * for the current viewer's role (Guest vs logged-in Devotee) — hiding the
 * link in DevoteeLayout's nav isn't enough on its own, since the route
 * itself is still reachable by typing the URL.
 */
export function NavTabGate({ tabKey }: { tabKey: NavTabKey }) {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data: enabledTabs, isLoading } = useGetEnabledNavTabsQuery(isAuthenticated ? 'user' : 'guest')

  if (isLoading) {
    return null
  }

  if (!enabledTabs?.some((tab) => tab.key === tabKey)) {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}
