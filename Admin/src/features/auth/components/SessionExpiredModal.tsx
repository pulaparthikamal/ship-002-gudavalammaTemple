import { useEffect } from 'react'
import { Dialog } from 'primereact/dialog'
import { Button } from 'primereact/button'
import { useNavigate } from 'react-router-dom'
import { useAppDispatch, useAppSelector } from '@/hooks/redux'
import { logout, selectAuthError, selectIsSessionExpired, selectTokenExpiresAt, sessionExpired } from '@/features/auth/authSlice'
import { AlertCircle } from 'lucide-react'

export function SessionExpiredModal() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const isExpired = useAppSelector(selectIsSessionExpired)
  const expiresAt = useAppSelector(selectTokenExpiresAt)
  const errorMsg = useAppSelector(selectAuthError)

  useEffect(() => {
    if (!expiresAt || isExpired) return

    const checkExpiration = () => {
      const now = Date.now()
      if (expiresAt <= now) {
        dispatch(sessionExpired('Your session has expired. Please sign in again.'))
      }
    }

    // Initial check
    checkExpiration()

    const timer = setInterval(checkExpiration, 1000)
    return () => clearInterval(timer)
  }, [expiresAt, isExpired, dispatch])

  const handleLoginAgain = () => {
    dispatch(logout())
    navigate('/login', { replace: true })
  }

  return (
    <Dialog
      visible={isExpired}
      onHide={handleLoginAgain}
      modal
      header="Session Expired"
      closable={false}
      footer={
        <div className="flex justify-end">
          <Button label="Login Again" icon="pi pi-sign-in" className="flex items-center gap-1" onClick={handleLoginAgain} autoFocus />
        </div>
      }
      className="session-expiry-dialog"
    >
      <div className="flex items-center gap-4 py-2">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <p className="text-sm text-[var(--color-text-muted)]">
          {errorMsg || 'Your session has expired. Please sign in again to continue.'}
        </p>
      </div>
    </Dialog>
  )
}
