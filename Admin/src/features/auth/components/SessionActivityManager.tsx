import { useEffect, useRef, useCallback } from 'react'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import {
  selectIsAuthenticated,
  selectRefreshToken,
  updateAccessToken,
  selectTokenExpiresAt,
} from '@/features/auth/authSlice'
import { useRefreshTokenMutation } from '@/features/auth/services/authApi'

// Simple debounce implementation to avoid lodash dependency
function debounce<T extends (...args: any[]) => any>(func: T, wait: number) {
  let timeout: ReturnType<typeof setTimeout> | null = null
  
  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout)
  }

  return debounced
}

// How often to check for activity (in milliseconds)
const ACTIVITY_DEBOUNCE_MS = 30000 // 30 seconds
// Refresh if the session expires in less than this amount (in milliseconds)
const REFRESH_THRESHOLD_MS = 10 * 60 * 1000 // 10 minutes

export function SessionActivityManager() {
  const dispatch = useAppDispatch()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const refreshTokenValue = useAppSelector(selectRefreshToken)
  const expiresAt = useAppSelector(selectTokenExpiresAt)
  const [refresh] = useRefreshTokenMutation()

  const lastRefreshTime = useRef<number>(Date.now())

  const handleActivity = useCallback(
    debounce(async () => {
      if (!isAuthenticated || !refreshTokenValue || !expiresAt) return

      const now = Date.now()
      const timeRemaining = expiresAt - now

      // If session is active and expiring soon (within threshold)
      if (timeRemaining > 0 && timeRemaining < REFRESH_THRESHOLD_MS) {
        // Also ensure we don't refresh too frequently (at least 1 minute apart)
        if (now - lastRefreshTime.current > 60000) {
          try {
            const response = await refresh({ refreshToken: refreshTokenValue }).unwrap()
            dispatch(
              updateAccessToken({
                accessToken: response.accessToken,
                expiresAt: (response as any).expiresAt,
              }),
            )
            lastRefreshTime.current = Date.now()
            console.log('Session extended due to user activity')
          } catch (error) {
            console.error('Failed to extend session:', error)
          }
        }
      }
    }, ACTIVITY_DEBOUNCE_MS),
    [isAuthenticated, refreshTokenValue, expiresAt, refresh, dispatch],
  )

  useEffect(() => {
    if (!isAuthenticated) return

    const events = ['mousemove', 'mousedown', 'keypress', 'scroll', 'touchstart']
    
    events.forEach((event) => {
      window.addEventListener(event, handleActivity)
    })

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleActivity)
      })
      handleActivity.cancel()
    }
  }, [isAuthenticated, handleActivity])

  return null // This is a logic-only component
}
