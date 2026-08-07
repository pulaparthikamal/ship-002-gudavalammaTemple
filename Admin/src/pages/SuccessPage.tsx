import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { CheckCircle2, ArrowLeft, ExternalLink } from 'lucide-react'

const PLATFORM_META: Record<string, { color: string; label: string; emoji: string }> = {
  linkedin: { color: '#0077B5', label: 'LinkedIn', emoji: '💼' },
  facebook: { color: '#1877F2', label: 'Facebook', emoji: '📘' },
  instagram: { color: '#E1306C', label: 'Instagram', emoji: '📸' },
  youtube: { color: '#FF0000', label: 'YouTube', emoji: '▶️' },
  twitter: { color: '#1DA1F2', label: 'Twitter / X', emoji: '🐦' },
}

const REDIRECT_DELAY = 4 // seconds

export function SuccessPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const platform = searchParams.get('platform') || ''
  const meta = PLATFORM_META[platform.toLowerCase()] ?? {
    color: 'var(--color-primary)',
    label: platform.charAt(0).toUpperCase() + platform.slice(1) || 'Social Media',
    emoji: '🔗',
  }

  const [countdown, setCountdown] = useState(REDIRECT_DELAY)

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          navigate('/settings', { replace: true })
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [navigate])

  const progress = ((REDIRECT_DELAY - countdown) / REDIRECT_DELAY) * 100

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div
        className="w-full max-w-md rounded-2xl border bg-[var(--color-surface)] shadow-lg overflow-hidden"
        style={{ borderColor: `${meta.color}30` }}
      >
        {/* Coloured top stripe */}
        <div className="h-1.5 w-full" style={{ backgroundColor: meta.color }} />

        <div className="flex flex-col items-center px-8 py-10 text-center">
          {/* Animated check */}
          <div
            className="mb-6 flex h-20 w-20 items-center justify-center rounded-full shadow-lg"
            style={{ backgroundColor: `${meta.color}15`, border: `2px solid ${meta.color}30` }}
          >
            <CheckCircle2 size={44} style={{ color: meta.color }} strokeWidth={1.5} />
          </div>

          <h1 className="text-2xl font-bold text-[var(--color-text-strong)] mb-2">
            {meta.emoji} {meta.label} Connected!
          </h1>
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed max-w-sm">
            Your <strong>{meta.label}</strong> account has been successfully linked. You can now schedule and publish content directly from the dashboard.
          </p>

          {/* Auto-redirect progress */}
          <div className="mt-8 w-full space-y-2">
            <div className="h-1.5 w-full rounded-full bg-[var(--color-border)]">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%`, backgroundColor: meta.color }}
              />
            </div>
            <p className="text-xs text-[var(--color-text-muted)]">
              Returning to Settings in <strong>{countdown}s</strong>…
            </p>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row items-center gap-3 w-full">
            <Link
              to="/settings"
              className="flex-1 flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: meta.color }}
            >
              <ArrowLeft size={15} />
              Go to Settings now
            </Link>
            <Link
              to="/dashboard"
              className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-strong)] transition-colors hover:bg-[var(--color-surface-muted)]"
            >
              Dashboard
              <ExternalLink size={13} />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
