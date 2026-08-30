import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectAuthAudience, selectIsAuthenticated, selectIsSessionExpired } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'

export function ProtectedRoute() {
  const location = useLocation()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isSessionExpired = useAppSelector(selectIsSessionExpired)
  const audience = useAppSelector(selectAuthAudience)

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        replace
        state={{
          from: location,
          reason: isSessionExpired ? 'expired' : 'auth-required',
        }}
      />
    )
  }

  if (audience === 'devotee') {
    return <Navigate to="/devotee/dashboard" replace />
  }

  return <Outlet />
}
