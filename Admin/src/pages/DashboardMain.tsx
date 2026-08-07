import { Activity, Server, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { selectSession } from '@/features/session/sessionSlice'
import { useAppSelector } from '@/hooks/redux'

const metricCards = [
  {
    label: 'Users',
    value: '128',
    icon: Users,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  },
  {
    label: 'API health',
    value: '99.9%',
    icon: Server,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  },
  {
    label: 'Policy checks',
    value: '42',
    icon: ShieldCheck,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  },
  {
    label: 'Events today',
    value: '734',
    icon: Activity,
    tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
  },
]

export function DashboardMain() {
  const session = useAppSelector(selectSession)

  return (
    <div className="mx-auto space-y-8">
      <PageHeader
        eyebrow="Dashboard"
        title="Workspace overview"
        description="Operational status and session activity."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metricCards.map((card) => (
          <article
            key={card.label}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-[var(--color-text-muted)]">{card.label}</p>
                <p className="mt-2 text-3xl font-semibold text-[var(--color-text-strong)]">{card.value}</p>
              </div>
              <div className={`grid h-11 w-11 place-items-center rounded-lg ${card.tone}`}>
                <card.icon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">User workspace</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
            Use the Users module for the configurable CRUD screen, API-driven table, forms, and validation examples.
          </p>
        </div>

        <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">Session</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-[var(--color-text-muted)]">Session ID</dt>
              <dd className="mt-1 break-all font-medium text-[var(--color-text-strong)]">
                {session.sessionId ?? 'Not established'}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Started</dt>
              <dd className="mt-1 font-medium text-[var(--color-text-strong)]">{session.startedAt ?? 'Pending'}</dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">Last active</dt>
              <dd className="mt-1 font-medium text-[var(--color-text-strong)]">
                {session.lastActiveAt ?? 'Pending'}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  )
}
