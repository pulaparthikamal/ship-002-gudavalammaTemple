import { Activity, Server, ShieldCheck, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { selectSession } from '@/features/session/sessionSlice'
import { useStaffTranslation } from '@/i18n/useTranslation'
import { useAppSelector } from '@/hooks/redux'

export function DashboardMain() {
  const session = useAppSelector(selectSession)
  const { t } = useStaffTranslation()

  const metricCards = [
    {
      label: t('dashboard.metricUsers'),
      value: '128',
      icon: Users,
      tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    },
    {
      label: t('dashboard.metricApiHealth'),
      value: '99.9%',
      icon: Server,
      tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    },
    {
      label: t('dashboard.metricPolicyChecks'),
      value: '42',
      icon: ShieldCheck,
      tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    },
    {
      label: t('dashboard.metricEventsToday'),
      value: '734',
      icon: Activity,
      tone: 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]',
    },
  ]

  return (
    <div className="mx-auto space-y-8">
      <PageHeader
        eyebrow={t('dashboard.eyebrow')}
        title={t('dashboard.title')}
        description={t('dashboard.description')}
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
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">{t('dashboard.userWorkspaceTitle')}</h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--color-text-muted)]">
            {t('dashboard.userWorkspaceDescription')}
          </p>
        </div>

        <aside className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
          <h2 className="text-xl font-semibold text-[var(--color-text-strong)]">{t('dashboard.sessionTitle')}</h2>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-[var(--color-text-muted)]">{t('dashboard.sessionIdLabel')}</dt>
              <dd className="mt-1 break-all font-medium text-[var(--color-text-strong)]">
                {session.sessionId ?? t('dashboard.sessionNotEstablished')}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">{t('dashboard.sessionStartedLabel')}</dt>
              <dd className="mt-1 font-medium text-[var(--color-text-strong)]">
                {session.startedAt ?? t('dashboard.sessionPending')}
              </dd>
            </div>
            <div>
              <dt className="text-[var(--color-text-muted)]">{t('dashboard.sessionLastActiveLabel')}</dt>
              <dd className="mt-1 font-medium text-[var(--color-text-strong)]">
                {session.lastActiveAt ?? t('dashboard.sessionPending')}
              </dd>
            </div>
          </dl>
        </aside>
      </section>
    </div>
  )
}
