import { Navigate, Outlet } from 'react-router-dom'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/hooks/redux'

export function PublicOnlyRoute() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}
