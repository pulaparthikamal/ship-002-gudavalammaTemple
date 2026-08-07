import { Loader2 } from 'lucide-react'

interface LoadingScreenProps {
  message?: string
  className?: string
}

export function LoadingScreen({ message = 'Loading workspace', className = 'bg-[var(--color-page)]' }: LoadingScreenProps) {
  return (
    <div className={`flex min-h-screen items-center justify-center text-[var(--color-text)] ${className}`}>
      <div className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-panel">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--color-primary)]" aria-hidden="true" />
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  )
}
