import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuthAudience, selectIsAuthenticated, selectIsSessionExpired } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'

export function DevoteeProtectedRoute() {
  const location = useLocation()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isSessionExpired = useAppSelector(selectIsSessionExpired)
  const audience = useAppSelector(selectAuthAudience)

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/devotee/login"
        replace
        state={{
          from: location,
          reason: isSessionExpired ? 'expired' : 'auth-required',
        }}
      />
    )
  }

  if (audience === 'staff') {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
