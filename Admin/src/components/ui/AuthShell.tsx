import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from './BrandLogo'
import { cn } from '@/utils/classNames'

interface AuthShellProps {
  title: string
  description: ReactNode
  children: ReactNode
  cardClassName?: string
}

export function AuthShell({ title, description, children, cardClassName }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-page)] px-5 py-10 text-[var(--color-text)]">
      <Link
        to="/"
        className="text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text-strong)]"
      >
        ← Back to temple site
      </Link>
      <section
        className={cn(
          'w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-panel md:p-7',
          cardClassName,
        )}
      >
        <div className="mb-6 text-center">
          <BrandLogo className="mx-auto mb-5 h-11 max-w-44" />
          <h1 className="text-2xl font-semibold text-[var(--color-text-strong)]">{title}</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">{description}</p>
        </div>
        {children}
      </section>
    </main>
  )
}
