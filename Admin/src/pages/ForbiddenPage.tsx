import { ShieldAlert } from 'lucide-react'
import { Button } from 'primereact/button'
import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center text-center">
      <ShieldAlert className="h-12 w-12 text-[var(--color-warning-text)]" aria-hidden="true" />
      <h1 className="mt-5 text-3xl font-semibold text-[var(--color-text-strong)]">Access denied</h1>
      <p className="mt-3 text-[var(--color-text-muted)]">
        Your account does not have permission to open this workspace area.
      </p>
      <Link to="/dashboard" className="mt-6">
        <Button label="Back to dashboard" />
      </Link>
    </div>
  )
}
