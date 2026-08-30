import { Navigate, Outlet } from 'react-router-dom'
import { selectAuthAudience, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'

export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const audience = useAppSelector(selectAuthAudience)

  if (!isAuthenticated) {
    return <Outlet />
  }

  return <Navigate to={audience === 'devotee' ? '/devotee/dashboard' : '/dashboard'} replace />
}
