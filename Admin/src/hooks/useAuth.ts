import { selectAuth, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from './redux'

export function useAuth() {
  const auth = useAppSelector(selectAuth)
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  return {
    ...auth,
    isAuthenticated,
  }
}
