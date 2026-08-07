import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  eyebrow?: string
  description?: string
  actions?: ReactNode
}

export function PageHeader({ title, eyebrow, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-6 md:flex-row md:items-end md:justify-between">
      <div className="max-w-3xl">
        {eyebrow ? (
          <p className="mb-2 text-sm font-semibold uppercase tracking-normal text-[var(--color-primary)]">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold text-[var(--color-text-strong)]">{title}</h1>
        {description ? <p className="mt-2 text-base text-[var(--color-text-muted)]">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  )
}
