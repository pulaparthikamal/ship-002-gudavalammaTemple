import { InputSwitch } from 'primereact/inputswitch'
import { PageHeader } from '@/components/ui/PageHeader'
import { useGetAllLanguagesQuery, useSetLanguageEnabledMutation } from '@/services/api/endpoints/languagesApi'
import { useToast } from '@/hooks/useToast'
import { useStaffTranslation } from '@/i18n/useTranslation'

export function LanguagesPage() {
  const { t } = useStaffTranslation()
  const { data: languages, isLoading } = useGetAllLanguagesQuery()
  const [setLanguageEnabled] = useSetLanguageEnabledMutation()
  const { showToast } = useToast()

  const handleToggle = async (code: string, enabled: boolean) => {
    try {
      await setLanguageEnabled({ code, enabled }).unwrap()
      showToast({
        severity: 'success',
        summary: enabled ? t('Language enabled') : t('Language disabled'),
        detail: enabled
          ? t('Existing content will be translated in the background as it is viewed.')
          : undefined,
      })
    } catch {
      showToast({ severity: 'error', summary: t('Could not update language') })
    }
  }

  return (
    <div className="temple-scope mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={t('Temple Management')}
        title={t('Languages')}
        description={t(
          'Enable any of the 22 official Indian languages for devotees and staff to switch to. Newly enabled languages are translated on demand and cached.',
        )}
      />

      <div className="divide-y divide-[var(--color-border)] rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)]">
        {isLoading && <p className="p-4 text-sm text-[var(--color-text-muted)]">{t('Loading…')}</p>}
        {languages?.map((lang) => (
          <div key={lang.code} className="flex items-center justify-between gap-4 p-4">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-strong)]">
                {lang.name} <span className="text-[var(--color-text-muted)]">({lang.nativeName})</span>
              </p>
              {lang.isDefault && (
                <p className="text-xs text-[var(--color-text-muted)]">{t('Default language — always enabled')}</p>
              )}
            </div>
            <InputSwitch
              checked={lang.enabled}
              disabled={lang.isDefault}
              onChange={(e) => handleToggle(lang.code, e.value)}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
