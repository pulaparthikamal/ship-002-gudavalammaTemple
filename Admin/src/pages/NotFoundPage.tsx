import { Compass } from 'lucide-react'
import { Button } from 'primereact/button'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-page)] px-5 text-center">
      <div className="max-w-lg rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-panel">
        <Compass className="mx-auto h-12 w-12 text-[var(--color-primary)]" aria-hidden="true" />
        <h1 className="mt-5 text-3xl font-semibold text-[var(--color-text-strong)]">Page not found</h1>
        <p className="mt-3 text-[var(--color-text-muted)]">The page you requested is not available.</p>
        <Link to="/dashboard" className="mt-6 inline-flex">
          <Button label="Go to dashboard" />
        </Link>
      </div>
    </main>
  )
}
