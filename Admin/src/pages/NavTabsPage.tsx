import { Checkbox } from 'primereact/checkbox'
import { PageHeader } from '@/components/ui/PageHeader'
import { useGetAllNavTabsQuery, useSetNavTabAllowedRolesMutation } from '@/services/api/endpoints/navTabsApi'
import type { NavTab, NavTabRole } from '@/services/api/endpoints/navTabsApi'
import { useToast } from '@/hooks/useToast'
import { useStaffTranslation } from '@/i18n/useTranslation'

const TAB_LABELS: Record<NavTab['key'], string> = {
  home: 'Home',
  darshan: 'Darshan',
  seva: 'Seva',
  accommodation: 'Stay (Accommodation)',
  prasadam: 'Prasadam',
  donations: 'Donations',
  events: 'Events',
  live: 'Live',
  bookings: 'My Bookings',
  facilities: 'Facilities',
  nearbyPlaces: 'Nearby Places',
}

export function NavTabsPage() {
  const { t } = useStaffTranslation()
  const { data: navTabs, isLoading } = useGetAllNavTabsQuery()
  const [setAllowedRoles] = useSetNavTabAllowedRolesMutation()
  const { showToast } = useToast()

  const handleToggle = async (tab: NavTab, role: NavTabRole, checked: boolean) => {
    const allowedRoles = checked
      ? [...tab.allowedRoles, role]
      : tab.allowedRoles.filter((r) => r !== role)

    try {
      await setAllowedRoles({ key: tab.key, allowedRoles }).unwrap()
    } catch {
      showToast({ severity: 'error', summary: t('Could not update nav tab') })
    }
  }

  return (
    <div className="temple-scope mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t('Temple Management')}
        title={t('Nav Tabs')}
        description={t(
          'Choose which devotee-site nav tabs are visible to an anonymous Guest and to a logged-in Devotee.',
        )}
      />

      <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[var(--color-border)] p-4 text-xs font-semibold uppercase text-[var(--color-text-muted)]">
          <span>{t('Tab')}</span>
          <span>{t('Guest')}</span>
          <span>{t('Devotee')}</span>
        </div>
        {isLoading && <p className="p-4 text-sm text-[var(--color-text-muted)]">{t('Loading…')}</p>}
        {navTabs?.map((tab) => (
          <div
            key={tab.key}
            className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-[var(--color-border)] p-4 last:border-b-0"
          >
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">{t(TAB_LABELS[tab.key])}</p>
              {tab.isDefault && (
                <p className="text-xs text-[var(--color-text-muted)]">{t('Always visible to everyone')}</p>
              )}
              {tab.guestLocked && (
                <p className="text-xs text-[var(--color-text-muted)]">{t('Guests can never see this tab')}</p>
              )}
            </div>
            <Checkbox
              checked={tab.allowedRoles.includes('GUEST')}
              disabled={tab.isDefault || tab.guestLocked}
              onChange={(e) => handleToggle(tab, 'GUEST', Boolean(e.checked))}
            />
            <Checkbox
              checked={tab.allowedRoles.includes('USER')}
              disabled={tab.isDefault}
              onChange={(e) => handleToggle(tab, 'USER', Boolean(e.checked))}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
