import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { selectIsAuthenticated, selectIsSessionExpired } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'

export function ProtectedRoute() {
  const location = useLocation()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const isSessionExpired = useAppSelector(selectIsSessionExpired)

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

  return <Outlet />
}
